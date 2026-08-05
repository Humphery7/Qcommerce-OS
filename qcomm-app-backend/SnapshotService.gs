
/**
 * SnapshotService.gs
 * ---------------------------------------------------------------------------
 * Rebuilds the pre-aggregated snapshot tables (dashboard_snapshot,
 * supplier_summary_snapshot, and recommendations) from their source
 * tables. Run once a day via the dailySnapshotTrigger() in Code.gs, or
 * manually via api_runSnapshotNow().
 *
 * NOTE: like BigQueryService.gs, this file was missing from the project
 * (Code.gs calls SnapshotService.runDailySnapshot(), but no file defined
 * it) even though the file name existed. This is a from-scratch
 * implementation that reconstructs the two original snapshot tables to
 * match the exact columns DashboardService/SupplierService/ProductService
 * already expect to read (see the SELECT lists in those files).
 * ---------------------------------------------------------------------------
 */

const SnapshotService = {
  /**
   * Rebuilds ALL snapshot tables from source data, then clears the cached
   * API payloads so the next page load reflects fresh data.
   *
   * Execution order respects dependencies:
   *   - supplier_summary_snapshot must exist before
   *     dashboard_top_suppliers / dashboard_bottom_suppliers / supplier_list
   *     can read from it.
   *   - RecommendationService.rebuildSnapshot() reads both
   *     supplier_summary_snapshot and supplier_prices, so it runs after
   *     both are rebuilt.
   */
  runDailySnapshot: function () {
    // 1. Core snapshots (from supplier_product_performance)
    SnapshotService._rebuildSupplierSummarySnapshot();
    SnapshotService._rebuildDashboardSnapshot();

    // 2. Dashboard sub-snapshots (from source tables & supplier_summary)
    SnapshotService._rebuildAvailabilityTrendSnapshot();
    SnapshotService._rebuildDashboardTopSuppliersSnapshot();
    SnapshotService._rebuildDashboardTopSuppliersWeeklySnapshot();
    SnapshotService._rebuildDashboardBottomSuppliersSnapshot();
    SnapshotService._rebuildDashboardProductLossSnapshot();
    SnapshotService._rebuildDashboardWeeklySnapshot();

    // 3. Supplier & product snapshots
    SnapshotService._rebuildSupplierMonthlyMetricsSnapshot();
    SnapshotService._rebuildSupplierWeeklyMetricsSnapshot();
    SnapshotService._rebuildSupplierListSnapshot();
    SnapshotService._rebuildProductsForSupplierSnapshot();

    // 4. Forecasting ("Are we ordering enough?") and MFC Nigeria reporting
    // snapshots — no dependencies on anything above, straight copies of
    // their source tables.
    SnapshotService._rebuildForecastingProductsSnapshot();
    SnapshotService._rebuildMfcCategorySalesReportSnapshot();
    SnapshotService._rebuildMfcProductSalesReportSnapshot();
    SnapshotService._rebuildMfcOrdersSnapshot();
    SnapshotService._rebuildMfcProductThresholdReportSnapshot();

    // 5. Weighted Availability — exact mirror of steps 1-3 above, reading
    // from CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY. Supplier summary +
    // dashboard first (everything else in this group either reads one of
    // those or is independent), same dependency shape as the original.
    SnapshotService._rebuildWaSupplierSummarySnapshot();
    SnapshotService._rebuildWaDashboardSnapshot();
    SnapshotService._rebuildWaAvailabilityTrendSnapshot();
    SnapshotService._rebuildWaDashboardTopSuppliersSnapshot();
    SnapshotService._rebuildWaDashboardTopSuppliersWeeklySnapshot();
    SnapshotService._rebuildWaDashboardBottomSuppliersSnapshot();
    SnapshotService._rebuildWaDashboardProductLossSnapshot();
    SnapshotService._rebuildWaDashboardWeeklySnapshot();
    SnapshotService._rebuildWaSupplierMonthlyMetricsSnapshot();
    SnapshotService._rebuildWaSupplierWeeklyMetricsSnapshot();
    SnapshotService._rebuildWaSupplierListSnapshot();
    SnapshotService._rebuildWaProductsForSupplierSnapshot();
    SnapshotService._rebuildWaForecastingProductsSnapshot();

    // 6. Prices snapshot — needed by BOTH recommendation rebuilds below,
    // since UF and Weighted Availability recommendations share the same
    // underlying supplier_prices table.
    SnapshotService.rebuildSupplierPricesSnapshot();

    // 7. Recommendations depend on their own supplier_summary snapshot
    // (steps 1 / 5) + prices (step 6) — everything's ready now.
    RecommendationService.rebuildSnapshot();
    WeightedAvailabilityRecommendationService.rebuildSnapshot();

    // 8. Invalidate all cached API payloads
    SnapshotService._clearDependentCaches();
  },

  // ------------------------------------------------------------------
  // Existing snapshot rebuilds (unchanged logic)
  // ------------------------------------------------------------------

  _rebuildSupplierSummarySnapshot: function () {
    const sourceTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRODUCT_PERFORMANCE);
    const targetTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_SUMMARY_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + targetTable + ' AS ' +
      'SELECT ' +
      '  supplier_name, ' +
      '  COUNT(DISTINCT product_sku) AS product_count, ' +
      '  SUM(quantity_ordered) AS quantity_ordered, ' +
      '  SUM(quantity_received) AS quantity_received, ' +
      '  SAFE_DIVIDE(SUM(quantity_received), SUM(quantity_ordered)) AS fill_rate, ' +
      '  ROUND(SAFE_DIVIDE(SUM(latest_cost * quantity_received), SUM(quantity_received)), 2) AS weighted_avg_latest_cost ' +
      'FROM ' + sourceTable + ' ' +
      'GROUP BY supplier_name'
    );
  },

  _rebuildDashboardSnapshot: function () {
    const sourceTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRODUCT_PERFORMANCE);
    const targetTable = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + targetTable + ' AS ' +
      'SELECT ' +
      '  COUNT(DISTINCT supplier_name) AS total_suppliers, ' +
      '  COUNT(DISTINCT product_sku) AS total_products, ' +
      '  SUM(quantity_ordered) AS total_quantity_ordered, ' +
      '  SUM(quantity_received) AS total_quantity_received, ' +
      '  SAFE_DIVIDE(SUM(quantity_received), SUM(quantity_ordered)) AS overall_fill_rate, ' +
      '  CURRENT_TIMESTAMP() AS last_updated ' +
      'FROM ' + sourceTable
    );
  },

  // ------------------------------------------------------------------
  // New snapshot rebuilds (all data pre-computed at 8am)
  // ------------------------------------------------------------------

  /**
   * Pre-computes availability trend data (copy of availability_summary).
   */
  _rebuildAvailabilityTrendSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.AVAILABILITY_SUMMARY);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.AVAILABILITY_TREND_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY inventory_month ASC'
    );
  },

  /**
   * Top 10 suppliers by total quantity ordered (monthly).
   */
  _rebuildDashboardTopSuppliersSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_SUMMARY_SNAPSHOT);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_TOP_SUPPLIERS_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT supplier_name, quantity_ordered, quantity_received ' +
      'FROM ' + src + ' ' +
      'WHERE quantity_ordered > 0 ' +
      'ORDER BY quantity_ordered DESC ' +
      'LIMIT 10'
    );
  },

  /**
   * Top 10 suppliers by current-week quantity ordered.
   */
  _rebuildDashboardTopSuppliersWeeklySnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_WEEKLY_METRICS);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_TOP_SUPPLIERS_WEEKLY_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT supplier_name, ordered_current AS quantity_ordered, received_current AS quantity_received ' +
      'FROM ' + src + ' ' +
      'WHERE ordered_current > 0 ' +
      'ORDER BY ordered_current DESC ' +
      'LIMIT 10'
    );
  },

  /**
   * Bottom 10 suppliers by fill rate.
   */
  _rebuildDashboardBottomSuppliersSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_SUMMARY_SNAPSHOT);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_BOTTOM_SUPPLIERS_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT supplier_name, fill_rate ' +
      'FROM ' + src + ' ' +
      'WHERE quantity_ordered > 0 ' +
      'ORDER BY fill_rate ASC ' +
      'LIMIT 10'
    );
  },

  /**
   * Product availability loss, worst first.
   */
  _rebuildDashboardProductLossSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.PRODUCTS_AVAILABILITY_LOSS);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_PRODUCT_LOSS_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT sku, name, availability, corrected_fcst, percent_of_forecast, availability_loss ' +
      'FROM ' + src + ' ' +
      'ORDER BY availability_loss DESC'
    );
  },

  /**
   * Single-row weekly snapshot rollup (from supplier_product_performance_week).
   */
  _rebuildDashboardWeeklySnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRODUCT_PERFORMANCE_WEEK);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.DASHBOARD_WEEKLY_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT ' +
      '  COUNT(DISTINCT supplier_name) AS total_suppliers, ' +
      '  COUNT(DISTINCT product_sku) AS total_products, ' +
      '  SUM(quantity_ordered) AS total_quantity_ordered, ' +
      '  SUM(quantity_received) AS total_quantity_received, ' +
      '  SAFE_DIVIDE(SUM(quantity_received), SUM(quantity_ordered)) AS overall_fill_rate ' +
      'FROM ' + src
    );
  },

  /**
   * Pre-computed copy of supplier_monthly_metrics.
   */
  _rebuildSupplierMonthlyMetricsSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_MONTHLY_METRICS);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_MONTHLY_METRICS_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC'
    );
  },

  /**
   * Pre-computed copy of supplier_weekly_metrics.
   */
  _rebuildSupplierWeeklyMetricsSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_WEEKLY_METRICS);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_WEEKLY_METRICS_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC'
    );
  },

  /**
   * Distinct supplier names for the dropdown.
   */
  _rebuildSupplierListSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_SUMMARY_SNAPSHOT);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_LIST_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT DISTINCT supplier_name ' +
      'FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC'
    );
  },

  /**
   * All product performance data, indexed by supplier_name for fast
   * per-supplier filtering at read time.
   */
  _rebuildProductsForSupplierSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRODUCT_PERFORMANCE);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.PRODUCTS_FOR_SUPPLIER_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT ' +
      '  supplier_name, product_sku, product_name, ' +
      '  product_category_level_one, product_category_level_two, product_category_level_three, ' +
      '  quantity_ordered, quantity_received, fill_rate, average_cost, latest_cost, ' +
      '  week_minus_5, week_minus_4, week_minus_3, week_minus_2, week_minus_1, current_week ' +
      'FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC, product_name ASC'
    );
  },

  /**
   * Rebuilds the supplier_prices snapshot from the live prices table.
   * Called during daily snapshot AND after every price write.
   * Public so SupplierPriceService can call it on writes.
   */
  rebuildSupplierPricesSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRICES);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRICES_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT SKU, Product_Name, Supplier_ID, Supplier_Name, Trade_Price ' +
      'FROM ' + src + ' ' +
      'ORDER BY SKU ASC, Supplier_Name ASC'
    );
  },

  _clearDependentCaches: function () {
    CacheService.getScriptCache().removeAll([
      'dashboard_data', 'supplier_summary_combined', 'supplier_list',
      'supplier_prices', 'recommendations',
      'forecasting_filter_options', 'mfc_orders',
      'wa_dashboard_data', 'wa_supplier_summary_combined', 'wa_supplier_list',
      'wa_recommendations', 'wa_forecasting_filter_options'
    ]);
  },

  // ------------------------------------------------------------------
  // Forecasting ("Are we ordering enough?") snapshot
  // ------------------------------------------------------------------

  /**
   * Straight copy of forecasting_products into forecasting_products_snapshot
   * (same dataset). ForecastingService filters this snapshot at read time
   * by warehouse / category / sku / search — never the source table.
   */
  _rebuildForecastingProductsSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.TABLES.FORECASTING_PRODUCTS);
    const tgt = Utilities_.qualifiedTable(CONFIG.TABLES.FORECASTING_PRODUCTS_SNAPSHOT);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY warehouse ASC, product_name ASC'
    );
  },

  // ------------------------------------------------------------------
  // Weighted Availability snapshots (dataset: CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY)
  // ------------------------------------------------------------------
  // Exact mirror of the "Existing snapshot rebuilds" + "New snapshot
  // rebuilds" sections above (same aggregation SQL, same dependency
  // shape), just reading from CONFIG.WA_TABLES / the weighted-availability
  // dataset instead of CONFIG.TABLES / CONFIG.BQ_DATASET. Deliberately
  // preserves the one quirk from the original: _rebuildWaDashboardTopSuppliersWeeklySnapshot
  // reads the raw SUPPLIER_WEEKLY_METRICS source table, not its own
  // snapshot, same as _rebuildDashboardTopSuppliersWeeklySnapshot does.

  _rebuildWaSupplierSummarySnapshot: function () {
    const sourceTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_PRODUCT_PERFORMANCE, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const targetTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_SUMMARY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + targetTable + ' AS ' +
      'SELECT ' +
      '  supplier_name, ' +
      '  COUNT(DISTINCT product_sku) AS product_count, ' +
      '  SUM(quantity_ordered) AS quantity_ordered, ' +
      '  SUM(quantity_received) AS quantity_received, ' +
      '  SAFE_DIVIDE(SUM(quantity_received), SUM(quantity_ordered)) AS fill_rate, ' +
      '  ROUND(SAFE_DIVIDE(SUM(latest_cost * quantity_received), SUM(quantity_received)), 2) AS weighted_avg_latest_cost ' +
      'FROM ' + sourceTable + ' ' +
      'GROUP BY supplier_name'
    );
  },

  _rebuildWaDashboardSnapshot: function () {
    const sourceTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_PRODUCT_PERFORMANCE, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const targetTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + targetTable + ' AS ' +
      'SELECT ' +
      '  COUNT(DISTINCT supplier_name) AS total_suppliers, ' +
      '  COUNT(DISTINCT product_sku) AS total_products, ' +
      '  SUM(quantity_ordered) AS total_quantity_ordered, ' +
      '  SUM(quantity_received) AS total_quantity_received, ' +
      '  SAFE_DIVIDE(SUM(quantity_received), SUM(quantity_ordered)) AS overall_fill_rate, ' +
      '  CURRENT_TIMESTAMP() AS last_updated ' +
      'FROM ' + sourceTable
    );
  },

  _rebuildWaAvailabilityTrendSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.AVAILABILITY_SUMMARY, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.AVAILABILITY_TREND_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY inventory_month ASC'
    );
  },

  _rebuildWaDashboardTopSuppliersSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_SUMMARY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_TOP_SUPPLIERS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT supplier_name, quantity_ordered, quantity_received ' +
      'FROM ' + src + ' ' +
      'WHERE quantity_ordered > 0 ' +
      'ORDER BY quantity_ordered DESC ' +
      'LIMIT 10'
    );
  },

  _rebuildWaDashboardTopSuppliersWeeklySnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_WEEKLY_METRICS, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_TOP_SUPPLIERS_WEEKLY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT supplier_name, ordered_current AS quantity_ordered, received_current AS quantity_received ' +
      'FROM ' + src + ' ' +
      'WHERE ordered_current > 0 ' +
      'ORDER BY ordered_current DESC ' +
      'LIMIT 10'
    );
  },

  _rebuildWaDashboardBottomSuppliersSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_SUMMARY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_BOTTOM_SUPPLIERS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT supplier_name, fill_rate ' +
      'FROM ' + src + ' ' +
      'WHERE quantity_ordered > 0 ' +
      'ORDER BY fill_rate ASC ' +
      'LIMIT 10'
    );
  },

  _rebuildWaDashboardProductLossSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.PRODUCTS_AVAILABILITY_LOSS, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_PRODUCT_LOSS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT sku, name, availability, corrected_fcst, percent_of_forecast, availability_loss ' +
      'FROM ' + src + ' ' +
      'ORDER BY availability_loss DESC'
    );
  },

  _rebuildWaDashboardWeeklySnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_PRODUCT_PERFORMANCE_WEEK, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.DASHBOARD_WEEKLY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT ' +
      '  COUNT(DISTINCT supplier_name) AS total_suppliers, ' +
      '  COUNT(DISTINCT product_sku) AS total_products, ' +
      '  SUM(quantity_ordered) AS total_quantity_ordered, ' +
      '  SUM(quantity_received) AS total_quantity_received, ' +
      '  SAFE_DIVIDE(SUM(quantity_received), SUM(quantity_ordered)) AS overall_fill_rate ' +
      'FROM ' + src
    );
  },

  _rebuildWaSupplierMonthlyMetricsSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_MONTHLY_METRICS, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_MONTHLY_METRICS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC'
    );
  },

  _rebuildWaSupplierWeeklyMetricsSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_WEEKLY_METRICS, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_WEEKLY_METRICS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC'
    );
  },

  _rebuildWaSupplierListSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_SUMMARY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_LIST_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT DISTINCT supplier_name ' +
      'FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC'
    );
  },

  _rebuildWaProductsForSupplierSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_PRODUCT_PERFORMANCE, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.PRODUCTS_FOR_SUPPLIER_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT ' +
      '  supplier_name, product_sku, product_name, ' +
      '  product_category_level_one, product_category_level_two, product_category_level_three, ' +
      '  quantity_ordered, quantity_received, fill_rate, average_cost, latest_cost, ' +
      '  week_minus_5, week_minus_4, week_minus_3, week_minus_2, week_minus_1, current_week ' +
      'FROM ' + src + ' ' +
      'ORDER BY supplier_name ASC, product_name ASC'
    );
  },

  _rebuildWaForecastingProductsSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.WA_TABLES.FORECASTING_PRODUCTS, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const tgt = Utilities_.qualifiedTable(CONFIG.WA_TABLES.FORECASTING_PRODUCTS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY warehouse ASC, product_name ASC'
    );
  },

  // ------------------------------------------------------------------
  // MFC Nigeria reporting snapshots (dataset: CONFIG.BQ_DATASET_MFC)
  // ------------------------------------------------------------------

  /**
   * Straight copy of mfc_category_sales_report into its _snapshot table,
   * within the same mfcnigeria_analytics dataset.
   */
  _rebuildMfcCategorySalesReportSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.CATEGORY_SALES_REPORT, CONFIG.BQ_DATASET_MFC);
    const tgt = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.CATEGORY_SALES_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY current_week_qty_delivered DESC'
    );
  },

  /**
   * Straight copy of mfc_product_sales_report into its _snapshot table.
   */
  _rebuildMfcProductSalesReportSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.PRODUCT_SALES_REPORT, CONFIG.BQ_DATASET_MFC);
    const tgt = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.PRODUCT_SALES_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY current_week_qty_delivered DESC'
    );
  },

  /**
   * Straight copy of the single-row orders table into its _snapshot table.
   */
  _rebuildMfcOrdersSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.ORDERS, CONFIG.BQ_DATASET_MFC);
    const tgt = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.ORDERS_SNAPSHOT, CONFIG.BQ_DATASET_MFC);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src
    );
  },

  /**
   * Straight copy of mfc_product_threshold_report into its _snapshot table.
   */
  _rebuildMfcProductThresholdReportSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.PRODUCT_THRESHOLD_REPORT, CONFIG.BQ_DATASET_MFC);
    const tgt = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.PRODUCT_THRESHOLD_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY product_category_level_one ASC, product_name_local ASC'
    );
  },

  // ------------------------------------------------------------------
  // Price Guard snapshots (dataset: CONFIG.BQ_DATASET_PRICE_GUARD)
  // ------------------------------------------------------------------
  // NOT part of runDailySnapshot() above - Price Guard runs its own
  // independent daily pipeline (schema bootstrap, metrics/alerts
  // computation, scraper dispatch, email digest) on its own trigger,
  // see PriceGuardSnapshotService.runDailyPipeline(), which calls these
  // two rebuilds directly. Kept here anyway, alongside every other
  // CREATE OR REPLACE TABLE AS SELECT rebuild in this file, rather than
  // in their own file, purely for consistency of "where snapshot SQL
  // lives" - the same reason MFC's snapshots live here too.

  /**
   * Straight copy of competitor_table_matches (Python matching engine
   * output - never written by this backend) into matches_snapshot, so
   * PriceGuardMatchingService.getMatches() stops querying it live on
   * every request.
   */
  rebuildMatchesSnapshot: function () {
    const src = Utilities_.qualifiedTable(CONFIG.PG_TABLES.COMPETITOR_TABLE_MATCHES, CONFIG.BQ_DATASET_PRICE_GUARD);
    const tgt = Utilities_.qualifiedTable(CONFIG.PG_TABLES.MATCHES_SNAPSHOT, CONFIG.BQ_DATASET_PRICE_GUARD);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      'ORDER BY match_confidence DESC'
    );
  },

  /**
   * Splits price_recommendations into two pre-filtered snapshots
   * (pending / history) so PriceGuardPricingActionService's reads never
   * filter the live workflow table. Called during Price Guard's daily
   * pipeline AND immediately after every recommendation write (submit/
   * approve/reject) - same pattern as rebuildSupplierPricesSnapshot.
   */
  rebuildRecommendationsSnapshots: function () {
    const src = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS, CONFIG.BQ_DATASET_PRICE_GUARD);

    const pendingTgt = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS_PENDING_SNAPSHOT, CONFIG.BQ_DATASET_PRICE_GUARD);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + pendingTgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      "WHERE status = 'Pending' " +
      'ORDER BY created_at DESC'
    );

    const historyTgt = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS_HISTORY_SNAPSHOT, CONFIG.BQ_DATASET_PRICE_GUARD);
    BigQueryService.runQuery(
      'CREATE OR REPLACE TABLE ' + historyTgt + ' AS ' +
      'SELECT * FROM ' + src + ' ' +
      "WHERE status IN ('Approved', 'Rejected') " +
      'ORDER BY updated_at DESC'
    );
  }
};
