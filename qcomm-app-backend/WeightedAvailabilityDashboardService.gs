/**
 * WeightedAvailabilityDashboardService.gs
 * ---------------------------------------------------------------------------
 * Exact mirror of DashboardService.gs for the "Weighted Availability" tool
 * (dataset: CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY / CONFIG.WA_TABLES) -
 * same shape, same columns (availability_summary in the new dataset uses
 * the identical column names as the original), just a different dataset.
 * Serves the Weighted Availability Dashboard page: availability KPI cards,
 * summary cards, product availability loss table, supplier fill rate
 * section, and the "Last Updated" timestamp.
 * ---------------------------------------------------------------------------
 */

const WeightedAvailabilityDashboardService = {
  /**
   * Returns the full payload the Weighted Availability Dashboard page
   * needs in a single call. Cached briefly to keep repeat loads fast.
   * @return {Object}
   */
  getDashboardData: function () {
    const cacheKey = 'wa_dashboard_data';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const availability = WeightedAvailabilityDashboardService._getAvailabilityTrend();
    const snapshot = WeightedAvailabilityDashboardService._getDashboardSnapshot();
    const snapshotWeekly = WeightedAvailabilityDashboardService._getDashboardSnapshotWeekly();
    const topSuppliers = WeightedAvailabilityDashboardService._getTopSuppliersByQuantity();
    const topSuppliersWeekly = WeightedAvailabilityDashboardService._getTopSuppliersByQuantityWeekly();
    const bottomSuppliers = WeightedAvailabilityDashboardService._getBottomSuppliersByFillRate();
    const productAvailabilityLoss = WeightedAvailabilityDashboardService._getProductAvailabilityLoss();
    const supplierMonthlyMetrics = WeightedAvailabilityDashboardService._getSupplierMonthlyMetrics();
    const supplierWeeklyMetrics = WeightedAvailabilityDashboardService._getSupplierWeeklyMetrics();

    const result = {
      error: false,
      availabilityTrend: availability.trend,
      availabilityWeeklyTrend: availability.weeklyTrend,
      ultrafreshAvailabilityCard: availability.ultrafreshCard,
      losf1AvailabilityCard: availability.losf1Card,
      mnlf1AvailabilityCard: availability.mnlf1Card,
      summary: snapshot,
      summaryWeekly: snapshotWeekly,
      topSuppliersByQuantity: topSuppliers,
      topSuppliersByQuantityWeekly: topSuppliersWeekly,
      bottomSuppliersByFillRate: bottomSuppliers,
      productAvailabilityLoss: productAvailabilityLoss,
      supplierMonthlyMetrics: supplierMonthlyMetrics,
      supplierWeeklyMetrics: supplierWeeklyMetrics
    };

    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * @return {{trend: Array, weeklyTrend: Array, ultrafreshCard: Object, losf1Card: Object, mnlf1Card: Object}}
   * @private
   */
  _getAvailabilityTrend: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.AVAILABILITY_TREND_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);

    const trend = rows.map(function (r) {
      return {
        month: r.inventory_month,
        monthLabel: Utilities_.monthLabel(r.inventory_month),
        label: Utilities_.monthLabel(r.inventory_month),
        ultrafreshAvailability: Utilities_.toNumber(r.ultrafresh_availability),
        losf1Availability: Utilities_.toNumber(r.losf1_availability),
        mnlf1Availability: Utilities_.toNumber(r.mnlf1_availability)
      };
    });

    const latestRawRow = rows.length > 0 ? rows[rows.length - 1] : null;
    const weeklyTrend = WeightedAvailabilityDashboardService._buildWeeklyTrend(latestRawRow);

    return {
      trend: trend,
      weeklyTrend: weeklyTrend,
      ultrafreshCard: {
        monthly: WeightedAvailabilityDashboardService._buildMonthlyCard(trend, 'ultrafreshAvailability'),
        weekly: WeightedAvailabilityDashboardService._buildWeeklyCard(latestRawRow,
          'current_week_ultrafresh_availability', 'last_week_ultrafresh_availability', 'two_weeks_ago_ultrafresh_availability')
      },
      losf1Card: {
        monthly: WeightedAvailabilityDashboardService._buildMonthlyCard(trend, 'losf1Availability'),
        weekly: WeightedAvailabilityDashboardService._buildWeeklyCard(latestRawRow,
          'current_week_losf1_availability', 'last_week_losf1_availability', 'two_weeks_ago_losf1_availability')
      },
      mnlf1Card: {
        monthly: WeightedAvailabilityDashboardService._buildMonthlyCard(trend, 'mnlf1Availability'),
        weekly: WeightedAvailabilityDashboardService._buildWeeklyCard(latestRawRow,
          'current_week_mnlf1_availability', 'last_week_mnlf1_availability', 'two_weeks_ago_mnlf1_availability')
      }
    };
  },

  /**
   * @param {Array<Object>} trend Chronologically sorted availability rows.
   * @param {string} metricKey 'ultrafreshAvailability' | 'losf1Availability' | 'mnlf1Availability'
   * @return {Object}
   * @private
   */
  _buildMonthlyCard: function (trend, metricKey) {
    if (!trend || trend.length === 0) {
      return { hasData: false, latestValue: 0, latestLabel: '', direction: 'flat', percentChange: 0, prior: [] };
    }

    const latest = trend[trend.length - 1];
    const previous = trend.length > 1 ? trend[trend.length - 2] : null;
    const latestValue = latest[metricKey];
    const change = WeightedAvailabilityDashboardService._computeChange(latestValue, previous ? previous[metricKey] : null);

    const prior = trend
      .slice(Math.max(0, trend.length - 3), trend.length - 1)
      .map(function (m) {
        return { label: m.monthLabel, value: m[metricKey] };
      });

    return {
      hasData: true,
      latestValue: latestValue,
      latestLabel: latest.monthLabel,
      direction: change.direction,
      percentChange: change.percentChange,
      prior: prior
    };
  },

  /**
   * @param {Object} latestRawRow Raw (unconverted) BigQuery row for the most recent month, or null.
   * @param {string} currentCol Column holding this metric's current-week value.
   * @param {string} lastWeekCol Column holding this metric's last-week value.
   * @param {string} twoWeeksAgoCol Column holding this metric's two-weeks-ago value.
   * @return {Object}
   * @private
   */
  _buildWeeklyCard: function (latestRawRow, currentCol, lastWeekCol, twoWeeksAgoCol) {
    const rawCurrent = latestRawRow ? latestRawRow[currentCol] : null;
    const hasData = rawCurrent !== null && rawCurrent !== undefined && rawCurrent !== '';

    if (!hasData) {
      return { hasData: false, latestValue: 0, latestLabel: '', direction: 'flat', percentChange: 0, prior: [] };
    }

    const latestValue = Utilities_.toNumber(rawCurrent);

    const rawLastWeek = latestRawRow[lastWeekCol];
    const hasLastWeek = rawLastWeek !== null && rawLastWeek !== undefined && rawLastWeek !== '';
    const lastWeekValue = hasLastWeek ? Utilities_.toNumber(rawLastWeek) : null;

    const rawTwoWeeksAgo = latestRawRow[twoWeeksAgoCol];
    const hasTwoWeeksAgo = rawTwoWeeksAgo !== null && rawTwoWeeksAgo !== undefined && rawTwoWeeksAgo !== '';

    const change = WeightedAvailabilityDashboardService._computeChange(latestValue, lastWeekValue);

    const prior = [];
    if (hasTwoWeeksAgo) prior.push({ label: '2 Weeks Ago', value: Utilities_.toNumber(rawTwoWeeksAgo) });
    if (hasLastWeek) prior.push({ label: 'Last Week', value: lastWeekValue });

    return {
      hasData: true,
      latestValue: latestValue,
      latestLabel: 'This Week',
      direction: change.direction,
      percentChange: change.percentChange,
      prior: prior
    };
  },

  /**
   * @param {Object} latestRawRow Raw (unconverted) BigQuery row for the most recent month, or null.
   * @return {Array<Object>} Points shaped like the monthly trend rows ({label, ultrafreshAvailability, losf1Availability, mnlf1Availability}), omitting any period with no data.
   * @private
   */
  _buildWeeklyTrend: function (latestRawRow) {
    if (!latestRawRow) return [];

    const hasValue = function (col) {
      const raw = latestRawRow[col];
      return raw !== null && raw !== undefined && raw !== '';
    };

    const points = [
      {
        label: '2 Weeks Ago',
        ultrafreshCol: 'two_weeks_ago_ultrafresh_availability',
        losf1Col: 'two_weeks_ago_losf1_availability',
        mnlf1Col: 'two_weeks_ago_mnlf1_availability'
      },
      {
        label: 'Last Week',
        ultrafreshCol: 'last_week_ultrafresh_availability',
        losf1Col: 'last_week_losf1_availability',
        mnlf1Col: 'last_week_mnlf1_availability'
      },
      {
        label: 'This Week',
        ultrafreshCol: 'current_week_ultrafresh_availability',
        losf1Col: 'current_week_losf1_availability',
        mnlf1Col: 'current_week_mnlf1_availability'
      }
    ];

    return points
      .filter(function (p) {
        return hasValue(p.ultrafreshCol) || hasValue(p.losf1Col) || hasValue(p.mnlf1Col);
      })
      .map(function (p) {
        return {
          label: p.label,
          ultrafreshAvailability: Utilities_.toNumber(latestRawRow[p.ultrafreshCol]),
          losf1Availability: Utilities_.toNumber(latestRawRow[p.losf1Col]),
          mnlf1Availability: Utilities_.toNumber(latestRawRow[p.mnlf1Col])
        };
      });
  },

  /**
   * @param {number} latestValue
   * @param {?number} previousValue
   * @return {{direction: ?string, percentChange: ?number}}
   * @private
   */
  _computeChange: function (latestValue, previousValue) {
    if (previousValue === null || previousValue === undefined) {
      return { direction: null, percentChange: null };
    }
    const diff = latestValue - previousValue;
    let direction = 'flat';
    if (diff > 0.0001) direction = 'up';
    else if (diff < -0.0001) direction = 'down';
    return { direction: direction, percentChange: diff * 100 };
  },

  /**
   * @return {Object}
   * @private
   */
  _getDashboardSnapshot: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table + ' LIMIT 1';
    const rows = BigQueryService.runQuery(sql);

    if (!rows || rows.length === 0) {
      return {
        hasData: false,
        totalSuppliers: 0,
        totalProducts: 0,
        totalQuantityOrdered: 0,
        totalQuantityReceived: 0,
        overallFillRate: 0,
        lastUpdated: null
      };
    }

    const r = rows[0];
    return {
      hasData: true,
      totalSuppliers: Utilities_.toNumber(r.total_suppliers),
      totalProducts: Utilities_.toNumber(r.total_products),
      totalQuantityOrdered: Utilities_.toNumber(r.total_quantity_ordered),
      totalQuantityReceived: Utilities_.toNumber(r.total_quantity_received),
      overallFillRate: Utilities_.toNumber(r.overall_fill_rate),
      lastUpdated: r.last_updated
    };
  },

  /**
   * @return {Object}
   * @private
   */
  _getDashboardSnapshotWeekly: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_WEEKLY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table + ' LIMIT 1';
    const rows = BigQueryService.runQuery(sql);

    if (!rows || rows.length === 0 || rows[0].total_suppliers === null) {
      return {
        hasData: false,
        totalSuppliers: 0,
        totalProducts: 0,
        totalQuantityOrdered: 0,
        totalQuantityReceived: 0,
        overallFillRate: 0
      };
    }

    const r = rows[0];
    return {
      hasData: true,
      totalSuppliers: Utilities_.toNumber(r.total_suppliers),
      totalProducts: Utilities_.toNumber(r.total_products),
      totalQuantityOrdered: Utilities_.toNumber(r.total_quantity_ordered),
      totalQuantityReceived: Utilities_.toNumber(r.total_quantity_received),
      overallFillRate: Utilities_.toNumber(r.overall_fill_rate)
    };
  },

  /**
   * @return {Array<Object>}
   * @private
   */
  _getTopSuppliersByQuantity: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_TOP_SUPPLIERS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    return rows.map(function (r) {
      return {
        supplierName: r.supplier_name,
        quantityOrdered: Utilities_.toNumber(r.quantity_ordered),
        quantityReceived: Utilities_.toNumber(r.quantity_received)
      };
    });
  },

  /**
   * @return {Array<Object>}
   * @private
   */
  _getTopSuppliersByQuantityWeekly: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_TOP_SUPPLIERS_WEEKLY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    return rows.map(function (r) {
      return {
        supplierName: r.supplier_name,
        quantityOrdered: Utilities_.toNumber(r.quantity_ordered),
        quantityReceived: Utilities_.toNumber(r.quantity_received)
      };
    });
  },

  /**
   * @return {Array<Object>}
   * @private
   */
  _getBottomSuppliersByFillRate: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_BOTTOM_SUPPLIERS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    return rows.map(function (r) {
      return {
        supplierName: r.supplier_name,
        fillRate: Utilities_.toNumber(r.fill_rate)
      };
    });
  },

  /**
   * @return {Array<Object>}
   * @private
   */
  _getProductAvailabilityLoss: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_PRODUCT_LOSS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    return rows.map(function (r) {
      return {
        sku: Utilities_.toSafeString(r.sku),
        name: Utilities_.toSafeString(r.name),
        availability: Utilities_.toNumber(r.availability),
        correctedFcst: Utilities_.toNumber(r.corrected_fcst),
        percentOfForecast: Utilities_.toNumber(r.percent_of_forecast),
        availabilityLoss: Utilities_.toNumber(r.availability_loss)
      };
    });
  },

  /**
   * @return {Array<Object>}
   * @private
   */
  _getSupplierMonthlyMetrics: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_MONTHLY_METRICS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    return rows.map(function (r) {
      return {
        supplierName: Utilities_.toSafeString(r.supplier_name),
        twoMonthsAgo: {
          ordered: Utilities_.toNumber(r.ordered_m2),
          received: Utilities_.toNumber(r.received_m2),
          fillRate: Utilities_.toNumber(r.fill_rate_m2)
        },
        lastMonth: {
          ordered: Utilities_.toNumber(r.ordered_m1),
          received: Utilities_.toNumber(r.received_m1),
          fillRate: Utilities_.toNumber(r.fill_rate_m1)
        },
        current: {
          ordered: Utilities_.toNumber(r.ordered_current),
          received: Utilities_.toNumber(r.received_current),
          fillRate: Utilities_.toNumber(r.fill_rate_current)
        }
      };
    });
  },

  /**
   * @return {Array<Object>}
   * @private
   */
  _getSupplierWeeklyMetrics: function () {
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_WEEKLY_METRICS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    return rows.map(function (r) {
      return {
        supplierName: Utilities_.toSafeString(r.supplier_name),
        twoMonthsAgo: {
          ordered: Utilities_.toNumber(r.ordered_w2),
          received: Utilities_.toNumber(r.received_w2),
          fillRate: Utilities_.toNumber(r.fill_rate_w2)
        },
        lastMonth: {
          ordered: Utilities_.toNumber(r.ordered_w1),
          received: Utilities_.toNumber(r.received_w1),
          fillRate: Utilities_.toNumber(r.fill_rate_w1)
        },
        current: {
          ordered: Utilities_.toNumber(r.ordered_current),
          received: Utilities_.toNumber(r.received_current),
          fillRate: Utilities_.toNumber(r.fill_rate_current)
        }
      };
    });
  }
};
