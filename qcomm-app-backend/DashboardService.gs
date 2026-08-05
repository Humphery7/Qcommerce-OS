/**
 * DashboardService.gs
 * ---------------------------------------------------------------------------
 * Assembles all data needed for Page 1 (Dashboard): availability KPI cards,
 * the second-row summary cards, product availability loss table, supplier
 * fill rate section, the charts, and the "Last Updated" timestamp.
 *
 * Reads from availability_summary, dashboard_snapshot, and
 * supplier_summary_snapshot (all cheap, pre-aggregated tables), plus the
 * new products_availability_loss and supplier_monthly_metrics tables.
 * Never touches supplier_product_performance directly, per the
 * performance requirements.
 * ---------------------------------------------------------------------------
 */

const DashboardService = {
  /**
   * Returns the full payload the Dashboard page needs in a single call.
   * Cached briefly to keep repeat loads fast.
   * @return {Object}
   */
  getDashboardData: function () {
    const cacheKey = 'dashboard_data';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const availability = DashboardService._getAvailabilityTrend();
    const snapshot = DashboardService._getDashboardSnapshot();
    const snapshotWeekly = DashboardService._getDashboardSnapshotWeekly();
    const topSuppliers = DashboardService._getTopSuppliersByQuantity();
    const topSuppliersWeekly = DashboardService._getTopSuppliersByQuantityWeekly();
    const bottomSuppliers = DashboardService._getBottomSuppliersByFillRate();
    const productAvailabilityLoss = DashboardService._getProductAvailabilityLoss();
    const supplierMonthlyMetrics = DashboardService._getSupplierMonthlyMetrics();
    const supplierWeeklyMetrics = DashboardService._getSupplierWeeklyMetrics();

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
   * Pulls every row of availability_summary (small table, one row/month),
   * sorts it chronologically, and derives:
   *  - a chart-ready trend array
   *  - the "card" data for UltraFresh, LOSF1, and MNLF1 availability, each
   *    with a `monthly` and a `weekly` sub-object of identical shape
   *    ({hasData, latestValue, latestLabel, direction, percentChange, prior}),
   *    so the frontend can render either period through one generic function.
   * @return {{trend: Array, ultrafreshCard: Object, losf1Card: Object, mnlf1Card: Object}}
   * @private
   */
  _getAvailabilityTrend: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.AVAILABILITY_TREND_SNAPSHOT);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);

    const trend = rows.map(function (r) {
      return {
        month: r.inventory_month,
        monthLabel: Utilities_.monthLabel(r.inventory_month),
        // Generic label field mirrored from monthLabel so the chart-drawing
        // code can render either the monthly trend or the weekly trend
        // (built below) through the same function.
        label: Utilities_.monthLabel(r.inventory_month),
        ultrafreshAvailability: Utilities_.toNumber(r.ultrafresh_availability),
        losf1Availability: Utilities_.toNumber(r.losf1_availability),
        mnlf1Availability: Utilities_.toNumber(r.mnlf1_availability)
      };
    });

    // Weekly figures (current / last week / two weeks ago) live as columns
    // on the latest row - a point-in-time snapshot, not a monthly series -
    // so only the most recent raw row is used to build the weekly card
    // and the weekly trend (a 3-point series instead of a full history).
    const latestRawRow = rows.length > 0 ? rows[rows.length - 1] : null;
    const weeklyTrend = DashboardService._buildWeeklyTrend(latestRawRow);

    return {
      trend: trend,
      weeklyTrend: weeklyTrend,
      ultrafreshCard: {
        monthly: DashboardService._buildMonthlyCard(trend, 'ultrafreshAvailability'),
        weekly: DashboardService._buildWeeklyCard(latestRawRow,
          'current_week_ultrafresh_availability', 'last_week_ultrafresh_availability', 'two_weeks_ago_ultrafresh_availability')
      },
      losf1Card: {
        monthly: DashboardService._buildMonthlyCard(trend, 'losf1Availability'),
        weekly: DashboardService._buildWeeklyCard(latestRawRow,
          'current_week_losf1_availability', 'last_week_losf1_availability', 'two_weeks_ago_losf1_availability')
      },
      mnlf1Card: {
        monthly: DashboardService._buildMonthlyCard(trend, 'mnlf1Availability'),
        weekly: DashboardService._buildWeeklyCard(latestRawRow,
          'current_week_mnlf1_availability', 'last_week_mnlf1_availability', 'two_weeks_ago_mnlf1_availability')
      }
    };
  },

  /**
   * Builds the "Monthly" side of a KPI card: latest month's value, its
   * direction/percent-point change vs the prior month, and the two months
   * before that for the small muted "prior" text.
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
    const change = DashboardService._computeChange(latestValue, previous ? previous[metricKey] : null);

    // Last Month and 2 Months Ago, in chronological order, for the small
    // muted text (e.g. "May 81.1 • Jun 85.5").
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
   * Builds the "Weekly" side of a KPI card: This Week's value, its
   * direction/percent-point change vs Last Week, and Last Week + 2 Weeks
   * Ago for the small muted "prior" text - the exact weekly counterpart of
   * _buildMonthlyCard, read from three columns on the latest row instead
   * of separate rows.
   * @param {Object} latestRawRow Raw (unconverted) BigQuery row for the most recent month, or null.
   * @param {string} currentCol Column holding this metric's current-week value.
   * @param {string} lastWeekCol Column holding this metric's last-week value.
   * @param {string} twoWeeksAgoCol Column holding this metric's two-weeks-ago value.
   * @return {Object}
   * @private
   */
  _buildWeeklyCard: function (latestRawRow, currentCol, lastWeekCol, twoWeeksAgoCol) {
    // Distinguish "column is null / not yet populated" from a genuine 0%,
    // by checking the raw row before Utilities_.toNumber() collapses
    // null/undefined to 0.
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

    const change = DashboardService._computeChange(latestValue, lastWeekValue);

    // 2 Weeks Ago and Last Week, in chronological order, mirroring how
    // _buildMonthlyCard orders its "prior" list.
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
   * Builds the "Availability Trend" chart data for the Weekly period: a
   * 3-point series (2 Weeks Ago, Last Week, This Week) for all three
   * locations, read from the same current/last/two-weeks-ago columns on
   * the latest row that _buildWeeklyCard uses for the KPI cards. This is
   * the weekly counterpart of the `trend` array built above from the
   * full monthly row history - a shorter series since only a
   * point-in-time snapshot (not a full weekly history) is available.
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
        // A period only makes it into the trend if at least one of the
        // three metrics actually has data for it.
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
   * Shared delta calculation used by both _buildMonthlyCard and
   * _buildWeeklyCard: direction ('up'/'down'/'flat') and the percentage-
   * point change vs a previous value. Returns direction/percentChange as
   * null when there's no previous value to compare against (rather than a
   * misleading "flat 0.0pp"), so the frontend can render no delta at all.
   * @param {number} latestValue
   * @param {?number} previousValue
   * @return {{direction: ?string, percentChange: ?number}}
   * @private
   */
  _computeChange: function (latestValue, previousValue) {
    if (previousValue === null || previousValue === undefined) {
      return { direction: null, percentChange: null };
    }
    const diff = latestValue - previousValue; // percentage-point difference
    let direction = 'flat';
    if (diff > 0.0001) direction = 'up';
    else if (diff < -0.0001) direction = 'down';
    return { direction: direction, percentChange: diff * 100 };
  },

  /**
   * Reads the single row from dashboard_snapshot.
   * @return {Object}
   * @private
   */
  _getDashboardSnapshot: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_SNAPSHOT);
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
   * Weekly counterpart of _getDashboardSnapshot, for the secondary KPI
   * row (Total Suppliers / Products Assigned / Quantity Ordered /
   * Quantity Received / Overall Fill Rate). Unlike the monthly version,
   * there is no pre-built weekly snapshot table, so this aggregates
   * directly from supplier_product_performance_week - the weekly
   * counterpart of the source table dashboard_snapshot itself is built
   * from (see SnapshotService._rebuildDashboardSnapshot). No separate
   * daily rebuild job is needed since this table is already scoped to a
   * single week's rows.
   * @return {Object}
   * @private
   */
  _getDashboardSnapshotWeekly: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_WEEKLY_SNAPSHOT);
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
   * Top 10 suppliers by total quantity ordered, from the daily snapshot.
   * @return {Array<Object>}
   * @private
   */
  _getTopSuppliersByQuantity: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_TOP_SUPPLIERS_SNAPSHOT);
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
   * Weekly counterpart of _getTopSuppliersByQuantity: top 10 suppliers by
   * current-week quantity ordered, from supplier_weekly_metrics, with
   * both ordered and received quantities for the grouped bar chart.
   * @return {Array<Object>}
   * @private
   */
  _getTopSuppliersByQuantityWeekly: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_TOP_SUPPLIERS_WEEKLY_SNAPSHOT);
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
   * Bottom 10 suppliers by fill rate, from the daily snapshot.
   * Excludes suppliers with zero quantity ordered (fill rate undefined)
   * to avoid misleading 0% entries caused by no orders rather than
   * poor performance.
   * @return {Array<Object>}
   * @private
   */
  _getBottomSuppliersByFillRate: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_BOTTOM_SUPPLIERS_SNAPSHOT);
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
   * Product-level availability loss, from products_availability_loss.
   * Worst offenders (highest availability_loss) first.
   * @return {Array<Object>}
   * @private
   */
  _getProductAvailabilityLoss: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_PRODUCT_LOSS_SNAPSHOT);
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
   * Supplier fill rate for Current, Last Month, and Last 2 Months, from
   * supplier_monthly_metrics. Returns every period on every row so the
   * frontend can switch periods without another round trip.
   * @return {Array<Object>}
   * @private
   */
  _getSupplierMonthlyMetrics: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_MONTHLY_METRICS_SNAPSHOT);
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
   * Supplier fill rate for Current Week, Last Week, and Last 2 Weeks, from
   * supplier_weekly_metrics. The weekly counterpart of
   * _getSupplierMonthlyMetrics - reuses the exact same object shape
   * (`current` / `lastMonth` / `twoMonthsAgo`, each {ordered, received,
   * fillRate}) so the frontend's existing period-toggle and chart code
   * can render either monthly or weekly data with no changes; only the
   * visible labels differ (handled client-side).
   * @return {Array<Object>}
   * @private
   */
  _getSupplierWeeklyMetrics: function () {
    const table = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_WEEKLY_METRICS_SNAPSHOT);
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
