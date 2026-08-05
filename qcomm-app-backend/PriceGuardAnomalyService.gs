/**
 * PriceGuardAnomalyService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's AnomalyService.gs.
 *
 * detectAlerts() is unchanged rule-based logic: it scans the freshly
 * computed product metrics (PriceGuardMetricService.getComputedData())
 * against the configurable thresholds in PriceGuardSettingsService and
 * produces Cost Spike / Price Spike / Competitor Premium / Negative
 * Margin / Margin Degradation alerts. It is only ever called from the
 * daily snapshot job (PriceGuardMetricSnapshotService
 * .computeAndPersistAlerts()) and, as a defensive fallback, when
 * daily_alerts has no rows yet.
 *
 * getLatestAlerts() is new: it's the read path every GET endpoint
 * actually uses, filtering the daily_alerts snapshot table (already
 * precomputed - never recomputed at read time) by severity/type/search.
 * ---------------------------------------------------------------------------
 */

const PriceGuardAnomalyService = {
  /**
   * Scans the current product metrics and returns rule-based alerts,
   * sorted by severity then revenue impact. Formulas/thresholds
   * unchanged from the original.
   * @return {Array<Object>}
   */
  detectAlerts: function () {
    const products = PriceGuardMetricService.getComputedData();
    const alerts = [];
    const settings = PriceGuardSettingsService.getSettings();

    products.forEach(function (p) {
      const historicalCosts = [];
      if (p.cost_price_last_month > 0) historicalCosts.push(p.cost_price_last_month);
      if (p.cost_price_last_2_months > 0) historicalCosts.push(p.cost_price_last_2_months);

      const historicalSelling = [];
      if (p.selling_price_last_month > 0) historicalSelling.push(p.selling_price_last_month);
      if (p.selling_price_last_2_months > 0) historicalSelling.push(p.selling_price_last_2_months);

      // 1. Cost Price Spike (vs. median of the last 1-2 months' cost)
      if (p.cost_price_today > 0 && historicalCosts.length > 0) {
        const historicalMedianCost = PriceGuardAnomalyService._calculateMedian(historicalCosts);
        const costChange = (p.cost_price_today - historicalMedianCost) / historicalMedianCost;

        if (costChange >= settings.thresholds.cost_spike_critical) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Cost Spike', 'Critical cost increase of ' + Math.round(costChange * 100) + '% MoM.', 'critical'));
        } else if (costChange >= settings.thresholds.cost_spike_high) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Cost Spike', 'High cost increase of ' + Math.round(costChange * 100) + '% MoM.', 'high'));
        } else if (costChange >= settings.thresholds.cost_spike_warning) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Cost Spike', 'Cost increase of ' + Math.round(costChange * 100) + '% MoM.', 'warning'));
        }
      }

      // 2. Selling Price Spike (vs. median of the last 1-2 months' price)
      if (p.selling_price_today > 0 && historicalSelling.length > 0) {
        const historicalMedianSelling = PriceGuardAnomalyService._calculateMedian(historicalSelling);
        const spChange = (p.selling_price_today - historicalMedianSelling) / historicalMedianSelling;

        if (spChange >= settings.thresholds.price_spike_critical) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Price Spike', 'Critical price increase of ' + Math.round(spChange * 100) + '% MoM.', 'critical'));
        } else if (spChange >= settings.thresholds.price_spike_high) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Price Spike', 'High price increase of ' + Math.round(spChange * 100) + '% MoM.', 'high'));
        } else if (spChange >= settings.thresholds.price_spike_warning) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Price Spike', 'Price increase of ' + Math.round(spChange * 100) + '% MoM.', 'warning'));
        }
      }

      // 3. Competitor Premium Gap
      if (p.market_median_price > 0) {
        const premium = (p.selling_price_today - p.market_median_price) / p.market_median_price;
        if (premium >= settings.thresholds.competitor_premium_critical) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Competitor Premium', 'Priced ' + Math.round(premium * 100) + '% higher than market median (Critical).', 'critical'));
        } else if (premium >= settings.thresholds.competitor_premium_high) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Competitor Premium', 'Priced ' + Math.round(premium * 100) + '% higher than market median (High).', 'high'));
        } else if (premium >= settings.thresholds.competitor_premium_warning) {
          alerts.push(PriceGuardAnomalyService._createAlert(p, 'Competitor Premium', 'Priced ' + Math.round(premium * 100) + '% higher than market median (Warning).', 'warning'));
        }
      }

      // 4. Margin Leakage (Direct Loss / Degradation)
      if (p.selling_price_today < p.cost_price_today) {
        alerts.push(PriceGuardAnomalyService._createAlert(p, 'Negative Margin', 'Selling price is below cost (leakage: \u20a6' + (p.cost_price_today - p.selling_price_today) + ' per unit).', 'critical'));
      } else if (p.margin_today < p.margin_last_month - 0.10) {
        alerts.push(PriceGuardAnomalyService._createAlert(p, 'Margin Degradation', 'Margin dropped by ' + Math.round((p.margin_last_month - p.margin_today) * 100) + '% vs last month.', 'high'));
      }
    });

    const severityOrder = { critical: 3, high: 2, warning: 1 };
    alerts.sort(function (a, b) {
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return (b.revenue_latest || 0) - (a.revenue_latest || 0);
    });

    return alerts;
  },

  /**
   * Reads the latest precomputed alerts from daily_alerts (filtered to
   * MAX(snapshot_date)), optionally filtered further by severity,
   * alert type, and/or a free-text search across product name/SKU.
   * Falls back to live detectAlerts() if no snapshot exists yet -
   * matching the original MetricSnapshotService.getLatestAlertsSnapshot()
   * fallback behavior.
   * @param {Object} filters {severity, alertType, search}
   * @return {Object}
   */
  getLatestAlerts: function (filters) {
    const f = filters || {};
    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.DAILY_ALERTS, CONFIG.BQ_DATASET_PRICE_GUARD);

    const where = Utilities_.buildWhereClause([
      'snapshot_date = (SELECT MAX(snapshot_date) FROM ' + table + ')',
      Utilities_.equalsFilter('severity', f.severity),
      Utilities_.equalsFilter('alert_type', f.alertType),
      Utilities_.searchFilter(['product_name', 'product_sku'], f.search)
    ]);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      where +
      "ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END, revenue_latest DESC";

    let rows;
    try {
      rows = BigQueryService.runQuery(sql);
    } catch (err) {
      rows = [];
    }

    if (rows.length === 0 && !f.severity && !f.alertType && !f.search) {
      // No snapshot yet - fall back to live detection, same as the original.
      const live = PriceGuardAnomalyService.detectAlerts();
      return { error: false, alerts: live, isEmpty: live.length === 0 };
    }

    const alerts = rows.map(function (r) {
      return {
        product_sku: Utilities_.toSafeString(r.product_sku),
        product_name: Utilities_.toSafeString(r.product_name),
        alert_type: Utilities_.toSafeString(r.alert_type),
        details: Utilities_.toSafeString(r.details),
        severity: Utilities_.toSafeString(r.severity),
        revenue_latest: Utilities_.toNumber(r.revenue_latest),
        timestamp: r.created_at
      };
    });

    return { error: false, alerts: alerts, isEmpty: alerts.length === 0 };
  },

  /**
   * @param {Array<number>} values
   * @return {number}
   * @private
   */
  _calculateMedian: function (values) {
    if (!values || values.length === 0) return 0;
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[middle];
    return (sorted[middle - 1] + sorted[middle]) / 2;
  },

  /**
   * @param {Object} product
   * @param {string} type
   * @param {string} details
   * @param {string} severity
   * @return {Object}
   * @private
   */
  _createAlert: function (product, type, details, severity) {
    return {
      product_sku: product.product_sku,
      product_name: product.product_name,
      alert_type: type,
      details: details,
      severity: severity,
      revenue_latest: product.revenue_latest,
      timestamp: new Date().toISOString()
    };
  }
};
