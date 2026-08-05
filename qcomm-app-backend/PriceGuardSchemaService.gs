/**
 * PriceGuardSchemaService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's SchemaService.gs.
 * Ensures the 4 GAS-owned BigQuery tables exist before any pipeline
 * step runs. Uses CREATE TABLE IF NOT EXISTS - safe to call repeatedly.
 *
 * GAS-owned tables (this service manages):
 *   - computed_daily_metrics  (daily precomputed metrics snapshot)
 *   - daily_alerts            (daily anomaly alerts)
 *   - product_matches         (match approval/override store)
 *   - price_recommendations   (pricing action recommendations workflow)
 *
 * Externally managed tables (never created/altered here):
 *   - dashboard_table, competitor_table_matches, and everything upstream
 *     of them (internal_products, spar_prices, supersaver_prices,
 *     mano_products, chowstore_products, raw_competitor_products).
 *
 * The 3 new snapshot tables added by this migration (matches_snapshot,
 * price_recommendations_pending_snapshot,
 * price_recommendations_history_snapshot) don't need DDL here - they're
 * auto-created by their own CREATE OR REPLACE TABLE AS SELECT rebuild
 * statements in PriceGuardSnapshotService.gs, same as every other
 * snapshot table in this backend.
 * ---------------------------------------------------------------------------
 */

const PriceGuardSchemaService = {
  /**
   * Ensures all 4 GAS-owned tables exist.
   * @return {Object} {computed_daily_metrics, daily_alerts, product_matches, price_recommendations}
   */
  ensureTablesExist: function () {
    const results = {
      computed_daily_metrics: false,
      daily_alerts: false,
      product_matches: false,
      price_recommendations: false
    };

    const dataset = CONFIG.BQ_DATASET_PRICE_GUARD;
    PriceGuardSchemaService._ensureDatasetExists(dataset);

    results.computed_daily_metrics = PriceGuardSchemaService._createIfNotExists(
      dataset, CONFIG.PG_TABLES.COMPUTED_DAILY_METRICS,
      'snapshot_date DATE,\n' +
      '  product_sku STRING,\n' +
      '  product_name STRING,\n' +
      '  supplier_name STRING,\n' +
      '  category_level_1 STRING,\n' +
      '  category_level_2 STRING,\n' +
      '  category_level_3 STRING,\n' +
      '  selling_price_today NUMERIC,\n' +
      '  cost_price_today NUMERIC,\n' +
      '  selling_price_last_month NUMERIC,\n' +
      '  cost_price_last_month NUMERIC,\n' +
      '  margin_today NUMERIC,\n' +
      '  margin_last_month NUMERIC,\n' +
      '  margin_last_2_months NUMERIC,\n' +
      '  quantity_sold_latest NUMERIC,\n' +
      '  revenue_latest NUMERIC,\n' +
      '  gross_profit_latest NUMERIC,\n' +
      '  gross_profit_last_month NUMERIC,\n' +
      '  market_median_price NUMERIC,\n' +
      '  price_index NUMERIC,\n' +
      '  competitor_gap NUMERIC,\n' +
      '  competitor_count INT64,\n' +
      '  revenue_at_risk NUMERIC,\n' +
      '  margin_leakage NUMERIC,\n' +
      '  opportunity_score NUMERIC,\n' +
      '  risk_score NUMERIC,\n' +
      '  avg_margin_this_month NUMERIC,\n' +
      '  avg_margin_last_month NUMERIC,\n' +
      '  avg_margin_this_week NUMERIC,\n' +
      '  avg_margin_last_week NUMERIC,\n' +
      '  avg_margin_this_month_losf1 NUMERIC,\n' +
      '  avg_margin_last_month_losf1 NUMERIC,\n' +
      '  avg_margin_this_week_losf1 NUMERIC,\n' +
      '  avg_margin_last_week_losf1 NUMERIC,\n' +
      '  avg_margin_this_month_mnlf1 NUMERIC,\n' +
      '  avg_margin_last_month_mnlf1 NUMERIC,\n' +
      '  avg_margin_this_week_mnlf1 NUMERIC,\n' +
      '  avg_margin_last_week_mnlf1 NUMERIC'
    );

    results.daily_alerts = PriceGuardSchemaService._createIfNotExists(
      dataset, CONFIG.PG_TABLES.DAILY_ALERTS,
      'snapshot_date DATE,\n' +
      '  product_sku STRING,\n' +
      '  product_name STRING,\n' +
      '  alert_type STRING,\n' +
      '  details STRING,\n' +
      '  severity STRING,\n' +
      '  revenue_latest NUMERIC,\n' +
      '  created_at TIMESTAMP'
    );

    results.product_matches = PriceGuardSchemaService._createIfNotExists(
      dataset, CONFIG.PG_TABLES.PRODUCT_MATCHES,
      'product_sku STRING,\n' +
      '  competitor STRING,\n' +
      '  competitor_product_name STRING,\n' +
      '  latest_price NUMERIC,\n' +
      '  confidence_score NUMERIC,\n' +
      '  match_method STRING,\n' +
      '  match_explanation STRING,\n' +
      '  is_approved BOOLEAN,\n' +
      '  needs_rematch BOOLEAN,\n' +
      '  last_matched_date TIMESTAMP'
    );

    results.price_recommendations = PriceGuardSchemaService._createIfNotExists(
      dataset, CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS,
      'recommendation_id STRING,\n' +
      '  recommendation_date DATE,\n' +
      '  product_sku STRING,\n' +
      '  product_name STRING,\n' +
      '  supplier_name STRING,\n' +
      '  category_level_1 STRING,\n' +
      '  action_type STRING,\n' +
      '  current_price NUMERIC,\n' +
      '  recommended_price NUMERIC,\n' +
      '  expected_margin NUMERIC,\n' +
      '  expected_profit_impact NUMERIC,\n' +
      '  reason STRING,\n' +
      '  requested_by STRING,\n' +
      '  status STRING,\n' +
      '  approved_by STRING,\n' +
      '  approved_at TIMESTAMP,\n' +
      '  rejected_by STRING,\n' +
      '  rejected_at TIMESTAMP,\n' +
      '  rejection_reason STRING,\n' +
      '  created_at TIMESTAMP,\n' +
      '  updated_at TIMESTAMP'
    );

    return results;
  },

  /**
   * @param {string} dataset
   * @param {string} tableName
   * @param {string} columnsSql Column definitions (without the surrounding parens).
   * @return {boolean}
   * @private
   */
  _createIfNotExists: function (dataset, tableName, columnsSql) {
    try {
      const table = Utilities_.qualifiedTable(tableName, dataset);
      BigQueryService.runQuery('CREATE TABLE IF NOT EXISTS ' + table + ' (\n  ' + columnsSql + '\n)');
      return true;
    } catch (err) {
      console.error('PriceGuardSchemaService: failed to create ' + tableName + ': ' + err.message);
      return false;
    }
  },

  /**
   * Creates the price_guard dataset if it doesn't already exist.
   * @param {string} datasetId
   * @private
   */
  _ensureDatasetExists: function (datasetId) {
    try {
      BigQuery.Datasets.get(CONFIG.BQ_PROJECT_ID, datasetId);
    } catch (err) {
      try {
        BigQuery.Datasets.insert({
          datasetReference: { projectId: CONFIG.BQ_PROJECT_ID, datasetId: datasetId },
          location: CONFIG.BQ_LOCATION
        }, CONFIG.BQ_PROJECT_ID);
      } catch (createErr) {
        console.error('PriceGuardSchemaService: could not create dataset ' + datasetId + ': ' + createErr.message);
      }
    }
  }
};
