/**
 * DebugMfcRawRow.gs - TEMPORARY, delete after use.
 * ---------------------------------------------------------------------------
 * Dumps the full raw row(s) of mfc_category_sales_report_snapshot and
 * mfc_product_sales_report_snapshot - every column BigQuery actually
 * returns, not just the ones MfcAnalyticsService._mapCategoryRow /
 * _mapProductRow currently pick out. Run debugMfcRawRows() from the Apps
 * Script editor (select it in the function dropdown, click Run), then
 * check View -> Logs.
 *
 * Point: to see if a "last week" figure exists anywhere in these tables
 * that isn't currently being read, or if wow_growth_delivered is the only
 * thing published (no retained prior-period total at all).
 * ---------------------------------------------------------------------------
 */
function debugMfcRawRows() {
  const categoryTable = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.CATEGORY_SALES_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);
  const productTable = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.PRODUCT_SALES_REPORT_SNAPSHOT, CONFIG.BQ_DATASET_MFC);

  const categoryRows = BigQueryService.runQuery('SELECT * FROM ' + categoryTable + ' LIMIT 3');
  Logger.log('=== mfc_category_sales_report_snapshot (3 raw rows, all columns) ===');
  Logger.log(JSON.stringify(categoryRows, null, 2));

  const productRows = BigQueryService.runQuery('SELECT * FROM ' + productTable + ' LIMIT 3');
  Logger.log('=== mfc_product_sales_report_snapshot (3 raw rows, all columns) ===');
  Logger.log(JSON.stringify(productRows, null, 2));
}
