/**
 * MfcAnalyticsService.gs
 * ---------------------------------------------------------------------------
 * Serves the MFC Nigeria reporting tables, all in the mfcnigeria_analytics
 * dataset (CONFIG.BQ_DATASET_MFC), passed explicitly to
 * Utilities_.qualifiedTable() since it defaults to CONFIG.BQ_DATASET
 * (availability_and_ultrafresh):
 *
 *   - mfc_category_sales_report_snapshot   - category-level 7-day sales,
 *     split by overall / LOSF1 / MNLF1.
 *   - mfc_product_sales_report_snapshot    - product-level counterpart.
 *   - orders_snapshot                      - single-row orders summary
 *     (yesterday, current week, last week, month-to-date, plus run
 *     rates), overall and split by LOSF1 / MNLF1.
 *   - mfc_product_threshold_report_snapshot - per-product weekly/monthly
 *     delivery thresholds and whether they were met, overall and split
 *     by LOSF1 / MNLF1.
 *
 * Like every other GET endpoint in the app, these read exclusively from
 * the pre-built _snapshot tables (rebuilt daily by SnapshotService into
 * the same mfcnigeria_analytics dataset), never from the raw source
 * tables. orders_snapshot is read the same way DashboardService reads its
 * single-row snapshot tables (SELECT * ... LIMIT 1).
 * ---------------------------------------------------------------------------
 */

const MfcAnalyticsService = {
  /**
   * Returns mfc_category_sales_report_snapshot rows, optionally filtered
   * by category and/or a free-text search on category name.
   * @param {Object} filters {category, search}
   * @return {Object}
   */
  getCategorySalesReport: function (filters) {
    const f = filters || {};
    const table = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.CATEGORY_SALES_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);

    const where = Utilities_.buildWhereClause([
      Utilities_.equalsFilter('product_category_level_one', f.category),
      Utilities_.searchFilter(['product_category_level_one'], f.search)
    ]);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      where +
      'ORDER BY current_week_qty_delivered DESC';

    const rows = BigQueryService.runQuery(sql);
    const categories = rows.map(MfcAnalyticsService._mapCategoryRow);

    return {
      error: false,
      categories: categories,
      isEmpty: categories.length === 0
    };
  },

  /**
   * Returns mfc_product_sales_report rows, optionally filtered by
   * category, exact SKU, and/or a free-text search across SKU and the
   * local product name.
   * @param {Object} filters {category, sku, search}
   * @return {Object}
   */
  getProductSalesReport: function (filters) {
    const f = filters || {};
    const table = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.PRODUCT_SALES_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);

    const where = Utilities_.buildWhereClause([
      Utilities_.equalsFilter('product_category_level_one', f.category),
      Utilities_.equalsFilter('product_sku', f.sku),
      Utilities_.searchFilter(['product_name_local', 'product_sku'], f.search)
    ]);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      where +
      'ORDER BY current_week_qty_delivered DESC';

    const rows = BigQueryService.runQuery(sql);
    const products = rows.map(MfcAnalyticsService._mapProductRow);

    return {
      error: false,
      products: products,
      isEmpty: products.length === 0
    };
  },

  /**
   * Returns the single-row `orders` summary table. No filters - there is
   * only ever one row, mirroring how DashboardService reads
   * dashboard_snapshot / dashboard_weekly_snapshot.
   * @return {Object}
   */
  getOrders: function () {
    const cacheKey = 'mfc_orders';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.ORDERS_SNAPSHOT, CONFIG.BQ_DATASET_MFC);
    const sql = 'SELECT * FROM ' + table + ' LIMIT 1';

    const rows = BigQueryService.runQuery(sql);

    const result = {
      error: false,
      hasData: rows.length > 0,
      orders: rows.length > 0 ? MfcAnalyticsService._mapOrdersRow(rows[0]) : MfcAnalyticsService._emptyOrders()
    };

    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * Returns mfc_product_threshold_report_snapshot rows, optionally
   * filtered by category, exact SKU, and/or a free-text search across
   * SKU and the local product name.
   * @param {Object} filters {category, sku, search}
   * @return {Object}
   */
  getProductThresholdReport: function (filters) {
    const f = filters || {};
    const table = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.PRODUCT_THRESHOLD_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);

    const where = Utilities_.buildWhereClause([
      Utilities_.equalsFilter('product_category_level_one', f.category),
      Utilities_.equalsFilter('product_sku', f.sku),
      Utilities_.searchFilter(['product_name_local', 'product_sku'], f.search)
    ]);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      where +
      'ORDER BY product_category_level_one ASC, product_name_local ASC';

    const rows = BigQueryService.runQuery(sql);
    const products = rows.map(MfcAnalyticsService._mapThresholdRow);

    return {
      error: false,
      products: products,
      isEmpty: products.length === 0
    };
  },

  /**
   * @param {Object} r
   * @return {Object}
   * @private
   */
  _mapThresholdRow: function (r) {
    return {
      sku: Utilities_.toSafeString(r.product_sku),
      productNameLocal: Utilities_.toSafeString(r.product_name_local),
      categoryLevelOne: Utilities_.toSafeString(r.product_category_level_one),
      businessCategory: Utilities_.toSafeString(r.business_category),

      deliveredCurrentWeek: Utilities_.toNumber(r.delivered_current_week),
      deliveredMonthToDate: Utilities_.toNumber(r.delivered_month_to_date),

      weeklyThreshold: Utilities_.toNumber(r.weekly_threshold),
      monthlyThreshold: Utilities_.toNumber(r.monthly_threshold),
      weeklyThresholdMet: Utilities_.toSafeString(r.weekly_threshold_met),
      monthlyThresholdMet: Utilities_.toSafeString(r.monthly_threshold_met),

      losf1: {
        deliveredCurrentWeek: Utilities_.toNumber(r.losf1_delivered_current_week),
        deliveredMonthToDate: Utilities_.toNumber(r.losf1_delivered_month_to_date),
        weeklyThresholdMet: Utilities_.toSafeString(r.losf1_weekly_threshold_met),
        monthlyThresholdMet: Utilities_.toSafeString(r.losf1_monthly_threshold_met)
      },
      mnlf1: {
        deliveredCurrentWeek: Utilities_.toNumber(r.mnlf1_delivered_current_week),
        deliveredMonthToDate: Utilities_.toNumber(r.mnlf1_delivered_month_to_date),
        weeklyThresholdMet: Utilities_.toSafeString(r.mnlf1_weekly_threshold_met),
        monthlyThresholdMet: Utilities_.toSafeString(r.mnlf1_monthly_threshold_met)
      }
    };
  },

  /**
   * @param {Object} r
   * @return {Object}
   * @private
   */
  _mapCategoryRow: function (r) {
    return {
      categoryLevelOne: Utilities_.toSafeString(r.product_category_level_one),
      delivered7d: Utilities_.toNumber(r.current_week_qty_delivered),
      orders7d: Utilities_.toNumber(r.orders_7d),
      wowGrowthDelivered: Utilities_.toNumber(r.wow_growth_delivered),
      pctContributionOrders: Utilities_.toNumber(r.pct_contribution_orders),

      losf1: {
        delivered: Utilities_.toNumber(r.losf1_delivered),
        orders: Utilities_.toNumber(r.losf1_orders),
        wowGrowth: Utilities_.toNumber(r.losf1_wow_growth),
        pctContribution: Utilities_.toNumber(r.losf1_pct_contribution)
      },
      mnlf1: {
        delivered: Utilities_.toNumber(r.mnlf1_delivered),
        orders: Utilities_.toNumber(r.mnlf1_orders),
        wowGrowth: Utilities_.toNumber(r.mnlf1_wow_growth),
        pctContribution: Utilities_.toNumber(r.mnlf1_pct_contribution)
      }
    };
  },

  /**
   * @param {Object} r
   * @return {Object}
   * @private
   */
  _mapProductRow: function (r) {
    return {
      sku: Utilities_.toSafeString(r.product_sku),
      productNameLocal: Utilities_.toSafeString(r.product_name_local),
      categoryLevelOne: Utilities_.toSafeString(r.product_category_level_one),
      delivered7d: Utilities_.toNumber(r.current_week_qty_delivered),
      orders7d: Utilities_.toNumber(r.orders_7d),
      wowGrowthDelivered: Utilities_.toNumber(r.wow_growth_delivered),
      pctContributionOrders: Utilities_.toNumber(r.pct_contribution_orders),

      losf1: {
        delivered: Utilities_.toNumber(r.losf1_delivered),
        orders: Utilities_.toNumber(r.losf1_orders),
        wowGrowth: Utilities_.toNumber(r.losf1_wow_growth),
        pctContribution: Utilities_.toNumber(r.losf1_pct_contribution)
      },
      mnlf1: {
        delivered: Utilities_.toNumber(r.mnlf1_delivered),
        orders: Utilities_.toNumber(r.mnlf1_orders),
        wowGrowth: Utilities_.toNumber(r.mnlf1_wow_growth),
        pctContribution: Utilities_.toNumber(r.mnlf1_pct_contribution)
      }
    };
  },

  /**
   * @param {Object} r
   * @return {Object}
   * @private
   */
  _mapOrdersRow: function (r) {
    return {
      total: {
        yesterday: Utilities_.toNumber(r.total_orders_yesterday),
        currentWeek: Utilities_.toNumber(r.total_orders_current_week),
        lastWeek: Utilities_.toNumber(r.total_orders_last_week),
        monthToDate: Utilities_.toNumber(r.total_orders_month_to_date)
      },
      losf1: {
        yesterday: Utilities_.toNumber(r.losf1_orders_yesterday),
        currentWeek: Utilities_.toNumber(r.losf1_orders_current_week),
        lastWeek: Utilities_.toNumber(r.losf1_orders_last_week),
        monthToDate: Utilities_.toNumber(r.losf1_orders_month_to_date)
      },
      mnlf1: {
        yesterday: Utilities_.toNumber(r.mnlf1_orders_yesterday),
        currentWeek: Utilities_.toNumber(r.mnlf1_orders_current_week),
        lastWeek: Utilities_.toNumber(r.mnlf1_orders_last_week),
        monthToDate: Utilities_.toNumber(r.mnlf1_orders_month_to_date)
      },
      totalWeekRunRate: Utilities_.toNumber(r.total_week_run_rate),
      totalMonthRunRate: Utilities_.toNumber(r.total_month_run_rate)
    };
  },

  /**
   * @return {Object} Zeroed-out orders shape for when the table has no rows yet.
   * @private
   */
  _emptyOrders: function () {
    const emptyPeriod = { yesterday: 0, currentWeek: 0, lastWeek: 0, monthToDate: 0 };
    return {
      total: emptyPeriod,
      losf1: emptyPeriod,
      mnlf1: emptyPeriod,
      totalWeekRunRate: 0,
      totalMonthRunRate: 0
    };
  }
};
