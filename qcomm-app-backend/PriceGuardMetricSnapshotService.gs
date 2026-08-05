/**
 * PriceGuardMetricSnapshotService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's
 * MetricSnapshotService.gs. Precomputes metrics and alerts once a day
 * (via PriceGuardSnapshotService.runDailyPipeline()) and writes them to
 * computed_daily_metrics / daily_alerts - both already snapshot-shaped
 * in the original design (a snapshot_date column, queried filtered to
 * MAX(snapshot_date)), so they keep their original names here rather
 * than being renamed to "_snapshot".
 *
 * getLatestMetricsSnapshot() is the read path every product/summary/
 * health GET endpoint goes through - PriceGuardService never calls
 * PriceGuardMetricService.getComputedData() directly except as the
 * same defensive fallback the original had.
 * ---------------------------------------------------------------------------
 */

const PriceGuardMetricSnapshotService = {
  /**
   * Rounds a value to a fixed decimal scale (BigQuery NUMERIC-safe).
   * @param {number} val
   * @param {number} [decimals]
   * @return {number}
   * @private
   */
  _roundNumeric: function (val, decimals) {
    if (val === undefined || val === null || isNaN(val)) return 0;
    const dec = decimals !== undefined ? decimals : 4;
    const factor = Math.pow(10, dec);
    return Math.round(val * factor) / factor;
  },

  /**
   * Computes the full product metrics set and writes it to
   * computed_daily_metrics (WRITE_TRUNCATE-equivalent via
   * BigQueryService.overwriteRows, i.e. truncate + insert).
   * @return {Object} {success, product_count, message}
   */
  computeAndPersistDailyMetrics: function () {
    Logger.log('PriceGuardMetricSnapshotService: Computing daily metrics...');

    try {
      const computedProducts = PriceGuardMetricService.getComputedData();
      Logger.log('Computed products: ' + computedProducts.length);

      if (!computedProducts || computedProducts.length === 0) {
        Logger.log('PriceGuardMetricSnapshotService: No products to persist.');
        return { success: true, product_count: 0, message: 'No products computed.' };
      }

      const today = Utilities.formatDate(new Date(), 'GMT+1', 'yyyy-MM-dd');
      const self = PriceGuardMetricSnapshotService;
      const rows = computedProducts.map(function (p) {
        return {
          snapshot_date: today,
          product_sku: p.product_sku || '',
          product_name: p.product_name || '',
          supplier_name: p.supplier_name || '',
          category_level_1: p.category_level_1 || '',
          category_level_2: p.category_level_2 || '',
          category_level_3: p.category_level_3 || '',
          selling_price_today: self._roundNumeric(p.selling_price_today, 2),
          cost_price_today: self._roundNumeric(p.cost_price_today, 2),
          selling_price_last_month: self._roundNumeric(p.selling_price_last_month, 2),
          cost_price_last_month: self._roundNumeric(p.cost_price_last_month, 2),
          margin_today: self._roundNumeric(p.margin_today, 4),
          margin_last_month: self._roundNumeric(p.margin_last_month, 4),
          margin_last_2_months: self._roundNumeric(p.margin_last_2_months, 4),
          quantity_sold_latest: self._roundNumeric(p.quantity_sold_latest, 2),
          revenue_latest: self._roundNumeric(p.revenue_latest, 2),
          gross_profit_latest: self._roundNumeric(p.gross_profit_latest, 2),
          gross_profit_last_month: self._roundNumeric(p.gross_profit_last_month, 2),
          market_median_price: self._roundNumeric(p.market_median_price, 2),
          price_index: self._roundNumeric(p.price_index, 2),
          competitor_gap: self._roundNumeric(p.competitor_gap, 2),
          competitor_count: Math.round(p.competitor_count || 0),
          revenue_at_risk: self._roundNumeric(p.revenue_at_risk, 2),
          margin_leakage: self._roundNumeric(p.margin_leakage, 2),
          opportunity_score: Math.round(p.opportunity_score || 0),
          risk_score: Math.round(p.risk_score || 0),

          avg_margin_this_month: self._roundNumeric(p.avg_margin_this_month, 4),
          avg_margin_last_month: self._roundNumeric(p.avg_margin_last_month, 4),
          avg_margin_this_week: self._roundNumeric(p.avg_margin_this_week, 4),
          avg_margin_last_week: self._roundNumeric(p.avg_margin_last_week, 4),

          avg_margin_this_month_losf1: self._roundNumeric(p.avg_margin_this_month_losf1, 4),
          avg_margin_last_month_losf1: self._roundNumeric(p.avg_margin_last_month_losf1, 4),
          avg_margin_this_week_losf1: self._roundNumeric(p.avg_margin_this_week_losf1, 4),
          avg_margin_last_week_losf1: self._roundNumeric(p.avg_margin_last_week_losf1, 4),

          avg_margin_this_month_mnlf1: self._roundNumeric(p.avg_margin_this_month_mnlf1, 4),
          avg_margin_last_month_mnlf1: self._roundNumeric(p.avg_margin_last_month_mnlf1, 4),
          avg_margin_this_week_mnlf1: self._roundNumeric(p.avg_margin_this_week_mnlf1, 4),
          avg_margin_last_week_mnlf1: self._roundNumeric(p.avg_margin_last_week_mnlf1, 4)
        };
      });

      const fullTableId = CONFIG.BQ_PROJECT_ID + '.' + CONFIG.BQ_DATASET_PRICE_GUARD + '.' + CONFIG.PG_TABLES.COMPUTED_DAILY_METRICS;
      const success = BigQueryService.overwriteRows(fullTableId, rows);

      if (success) {
        Logger.log('PriceGuardMetricSnapshotService: Persisted ' + rows.length + ' product metrics for ' + today + '.');
        return { success: true, product_count: rows.length, message: 'Metrics snapshot saved to BigQuery.' };
      }
      Logger.log('PriceGuardMetricSnapshotService: Failed to persist metrics.');
      return { success: false, product_count: 0, message: 'BigQuery insert failed.' };
    } catch (err) {
      Logger.log('PriceGuardMetricSnapshotService: Metric computation error: ' + err.toString());
      return { success: false, product_count: 0, message: 'Error: ' + err.toString() };
    }
  },

  /**
   * Runs anomaly detection and writes the results to daily_alerts.
   * @return {Object} {success, alert_count, message}
   */
  computeAndPersistAlerts: function () {
    Logger.log('PriceGuardMetricSnapshotService: Computing daily alerts...');

    try {
      const alerts = PriceGuardAnomalyService.detectAlerts();

      if (!alerts || alerts.length === 0) {
        Logger.log('PriceGuardMetricSnapshotService: No anomalies detected today.');
        return { success: true, alert_count: 0, message: 'No anomalies detected.' };
      }

      const today = Utilities.formatDate(new Date(), 'GMT+1', 'yyyy-MM-dd');
      const self = PriceGuardMetricSnapshotService;
      const rows = alerts.map(function (a) {
        return {
          snapshot_date: today,
          product_sku: a.product_sku || '',
          product_name: a.product_name || '',
          alert_type: a.alert_type || '',
          details: a.details || '',
          severity: a.severity || 'warning',
          revenue_latest: self._roundNumeric(a.revenue_latest, 2),
          created_at: a.timestamp || new Date().toISOString()
        };
      });

      const fullTableId = CONFIG.BQ_PROJECT_ID + '.' + CONFIG.BQ_DATASET_PRICE_GUARD + '.' + CONFIG.PG_TABLES.DAILY_ALERTS;
      const success = BigQueryService.overwriteRows(fullTableId, rows);

      if (success) {
        Logger.log('PriceGuardMetricSnapshotService: Persisted ' + rows.length + ' alerts for ' + today + '.');
        return { success: true, alert_count: rows.length, message: 'Alerts snapshot saved to BigQuery.' };
      }
      Logger.log('PriceGuardMetricSnapshotService: Failed to persist alerts.');
      return { success: false, alert_count: 0, message: 'BigQuery insert failed.' };
    } catch (err) {
      Logger.log('PriceGuardMetricSnapshotService: Alert computation error: ' + err.toString());
      return { success: false, alert_count: 0, message: 'Error: ' + err.toString() };
    }
  },

  /**
   * Reads the latest computed_daily_metrics rows (filtered to
   * MAX(snapshot_date)), cast back to numbers. Falls back to live
   * PriceGuardMetricService.getComputedData() if no snapshot exists yet,
   * matching the original's graceful-degradation behavior.
   * @return {Array<Object>}
   */
  getLatestMetricsSnapshot: function () {
    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.COMPUTED_DAILY_METRICS, CONFIG.BQ_DATASET_PRICE_GUARD);

    try {
      const sql =
        'SELECT * FROM ' + table + ' ' +
        'WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM ' + table + ') ' +
        'ORDER BY product_name';
      const results = BigQueryService.runQuery(sql);

      if (results && results.length > 0) {
        return results.map(function (r) {
          return {
            product_sku: r.product_sku,
            product_name: r.product_name,
            supplier_name: r.supplier_name,
            category_level_1: r.category_level_1,
            category_level_2: r.category_level_2,
            category_level_3: r.category_level_3,
            selling_price_today: Utilities_.toNumber(r.selling_price_today),
            cost_price_today: Utilities_.toNumber(r.cost_price_today),
            selling_price_last_month: Utilities_.toNumber(r.selling_price_last_month),
            cost_price_last_month: Utilities_.toNumber(r.cost_price_last_month),
            margin_today: Utilities_.toNumber(r.margin_today),
            margin_last_month: Utilities_.toNumber(r.margin_last_month),
            margin_last_2_months: Utilities_.toNumber(r.margin_last_2_months),
            quantity_sold_latest: Utilities_.toNumber(r.quantity_sold_latest),
            revenue_latest: Utilities_.toNumber(r.revenue_latest),
            gross_profit_latest: Utilities_.toNumber(r.gross_profit_latest),
            gross_profit_last_month: Utilities_.toNumber(r.gross_profit_last_month),
            market_median_price: Utilities_.toNumber(r.market_median_price),
            price_index: r.price_index !== null && r.price_index !== undefined && r.price_index !== '' ? Utilities_.toNumber(r.price_index) : 100,
            competitor_gap: Utilities_.toNumber(r.competitor_gap),
            competitor_count: parseInt(r.competitor_count, 10) || 0,
            revenue_at_risk: Utilities_.toNumber(r.revenue_at_risk),
            margin_leakage: Utilities_.toNumber(r.margin_leakage),
            opportunity_score: Utilities_.toNumber(r.opportunity_score),
            risk_score: Utilities_.toNumber(r.risk_score),

            avg_margin_this_month: Utilities_.toNumber(r.avg_margin_this_month),
            avg_margin_last_month: Utilities_.toNumber(r.avg_margin_last_month),
            avg_margin_this_week: Utilities_.toNumber(r.avg_margin_this_week),
            avg_margin_last_week: Utilities_.toNumber(r.avg_margin_last_week),

            avg_margin_this_month_losf1: Utilities_.toNumber(r.avg_margin_this_month_losf1),
            avg_margin_last_month_losf1: Utilities_.toNumber(r.avg_margin_last_month_losf1),
            avg_margin_this_week_losf1: Utilities_.toNumber(r.avg_margin_this_week_losf1),
            avg_margin_last_week_losf1: Utilities_.toNumber(r.avg_margin_last_week_losf1),

            avg_margin_this_month_mnlf1: Utilities_.toNumber(r.avg_margin_this_month_mnlf1),
            avg_margin_last_month_mnlf1: Utilities_.toNumber(r.avg_margin_last_month_mnlf1),
            avg_margin_this_week_mnlf1: Utilities_.toNumber(r.avg_margin_this_week_mnlf1),
            avg_margin_last_week_mnlf1: Utilities_.toNumber(r.avg_margin_last_week_mnlf1)
          };
        });
      }

      Logger.log('PriceGuardMetricSnapshotService: No snapshot found. Falling back to live computation.');
      return PriceGuardMetricService.getComputedData();
    } catch (err) {
      Logger.log('PriceGuardMetricSnapshotService: Snapshot read failed: ' + err.toString() + '. Falling back to live.');
      return PriceGuardMetricService.getComputedData();
    }
  }
};
