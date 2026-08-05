/**
 * PriceGuardMetricService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's MetricService.gs.
 * Computes margin, competitive, and risk metrics for every product in
 * `dashboard_table` - the single BigQuery table an external job already
 * joins internal_products with all four competitor price feeds
 * (SPAR, SuperSaver, Mano, Chowstore) into.
 *
 * IMPORTANT: this is the one place in the whole Price Guard migration
 * that still reads dashboard_table directly. That's intentional and
 * matches the source app exactly - this function is only ever called
 * from PriceGuardMetricSnapshotService.computeAndPersistDailyMetrics()
 * (i.e. once a day, from the snapshot job) and, as a defensive
 * fallback, if computed_daily_metrics has no rows yet. No GET endpoint
 * calls this directly - they all read the computed_daily_metrics
 * snapshot table instead. See PriceGuardMetricSnapshotService.gs.
 *
 * All formulas below are unchanged from the original - median
 * competitor price, margins, gross profit, price index, competitor
 * gap, revenue at risk, margin leakage, opportunity score, and the
 * weighted risk score.
 * ---------------------------------------------------------------------------
 */

const PriceGuardMetricService = {
  /**
   * Reads every row of dashboard_table, de-dupes by SKU (keeping the
   * first occurrence, same as the original), and computes the full set
   * of derived metrics for each product.
   * @return {Array<Object>}
   */
  getComputedData: function () {
    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.DASHBOARD_TABLE, CONFIG.BQ_DATASET_PRICE_GUARD);
    let products = BigQueryService.runQuery('SELECT * FROM ' + table + ' ORDER BY product_name');

    // Remove duplicate SKUs (keep the first occurrence) - unchanged from source.
    const seen = {};
    products = products.filter(function (p) {
      if (seen[p.product_sku]) return false;
      seen[p.product_sku] = true;
      return true;
    });

    return products.map(PriceGuardMetricService._computeProductMetrics);
  },

  /**
   * @param {Object} p Raw dashboard_table row.
   * @return {Object} Product with every derived metric attached.
   * @private
   */
  _computeProductMetrics: function (p) {
    const sku = p.product_sku;

    // Ensure numeric types (BigQuery may return strings or nulls)
    const spToday = parseFloat(p.selling_price_today) || 0;
    const cpToday = parseFloat(p.cost_price_today) || 0;
    const spLastMonth = parseFloat(p.selling_price_last_month) || 0;
    const cpLastMonth = parseFloat(p.cost_price_last_month) || 0;
    const spLast2Months = parseFloat(p.selling_price_last_2_months) || 0;
    const cpLast2Months = parseFloat(p.cost_price_last_2_months) || 0;
    const qtySold = parseFloat(p.quantity_sold_latest) || 0;
    const revLatest = parseFloat(p.revenue_latest) || 0;
    const qtyLastMonth = parseFloat(p.quantity_sold_last_month) || 0;

    // Collect competitor prices directly from dashboard_table columns.
    // Each may be null/0 if no match was found for that competitor.
    const compPrices = [
      parseFloat(p.spar_price) || 0,
      parseFloat(p.supersaver_price) || 0,
      parseFloat(p.mano_price) || 0,
      parseFloat(p.chowstore_price) || 0
    ].filter(function (v) { return v > 0; });

    const competitorCount = compPrices.length;
    const marketMedian = PriceGuardMetricService._calculateMedian(compPrices);

    // Basic margins
    const marginToday = spToday > 0 ? (spToday - cpToday) / spToday : 0;
    const marginLastMonth = spLastMonth > 0 ? (spLastMonth - cpLastMonth) / spLastMonth : 0;
    const marginLast2Months = spLast2Months > 0 ? (spLast2Months - cpLast2Months) / spLast2Months : 0;

    // Gross Profits
    const gpLatest = (spToday - cpToday) * qtySold;
    const gpLastMonth = (spLastMonth - cpLastMonth) * qtyLastMonth;

    // Competitive metrics
    const priceIndex = marketMedian > 0 ? (spToday / marketMedian) * 100 : 100;
    const competitorGap = marketMedian > 0 ? (spToday - marketMedian) : 0;

    // Business Impact metrics
    let revenueAtRisk = 0;
    if (priceIndex > 120 && revLatest > 0) {
      revenueAtRisk = revLatest;
    }

    let marginLeakage = 0;
    if (spToday < cpToday) {
      marginLeakage = (cpToday - spToday) * qtySold;
    } else if (priceIndex < 85 && marketMedian > 0) {
      marginLeakage = (marketMedian - spToday) * qtySold;
    }

    let opportunityScore = 0;
    if (priceIndex < 90 && marketMedian > 0 && qtySold > 0) {
      opportunityScore = Math.min(100, Math.round(((marketMedian - spToday) * qtySold) / 1000));
    }

    // Risk score: scales from 0 to 100
    const riskScore = PriceGuardMetricService._calculateProductRiskScore({
      selling_price_today: spToday,
      cost_price_today: cpToday,
      selling_price_last_month: spLastMonth,
      cost_price_last_month: cpLastMonth,
      revenue_latest: revLatest
    }, priceIndex);

    return {
      product_sku: sku,
      product_name: p.product_name,
      supplier_name: p.supplier_name,
      category_level_1: p.product_category_level_one,
      category_level_2: p.product_category_level_two,
      category_level_3: p.product_category_level_three,

      selling_price_today: spToday,
      cost_price_today: cpToday,
      selling_price_last_month: spLastMonth,
      cost_price_last_month: cpLastMonth,
      margin_today: marginToday,
      margin_last_month: marginLastMonth,
      margin_last_2_months: marginLast2Months,
      selling_price_last_2_months: spLast2Months,
      cost_price_last_2_months: cpLast2Months,

      quantity_sold_latest: qtySold,
      revenue_latest: revLatest,
      gross_profit_latest: gpLatest,
      gross_profit_last_month: gpLastMonth,

      // Competitor data (sourced directly from dashboard_table columns)
      spar_price: parseFloat(p.spar_price) || 0,
      spar_match_confidence: parseFloat(p.spar_match_confidence) || 0,
      supersaver_price: parseFloat(p.supersaver_price) || 0,
      supersaver_match_confidence: parseFloat(p.supersaver_match_confidence) || 0,
      mano_price: parseFloat(p.mano_price) || 0,
      mano_match_confidence: parseFloat(p.mano_match_confidence) || 0,
      chowstore_price: parseFloat(p.chowstore_price) || 0,
      chowstore_match_confidence: parseFloat(p.chowstore_match_confidence) || 0,

      market_median_price: marketMedian,
      price_index: priceIndex,
      competitor_gap: competitorGap,
      competitor_count: competitorCount,

      revenue_at_risk: revenueAtRisk,
      margin_leakage: marginLeakage,
      opportunity_score: opportunityScore,
      risk_score: riskScore,

      // Average margin fields (sourced directly from dashboard_table columns)
      avg_margin_this_month: parseFloat(p.avg_margin_this_month) || 0,
      avg_margin_last_month: parseFloat(p.avg_margin_last_month) || 0,
      avg_margin_this_week: parseFloat(p.avg_margin_this_week) || 0,
      avg_margin_last_week: parseFloat(p.avg_margin_last_week) || 0,

      avg_margin_this_month_losf1: parseFloat(p.avg_margin_this_month_losf1) || 0,
      avg_margin_last_month_losf1: parseFloat(p.avg_margin_last_month_losf1) || 0,
      avg_margin_this_week_losf1: parseFloat(p.avg_margin_this_week_losf1) || 0,
      avg_margin_last_week_losf1: parseFloat(p.avg_margin_last_week_losf1) || 0,

      avg_margin_this_month_mnlf1: parseFloat(p.avg_margin_this_month_mnlf1) || 0,
      avg_margin_last_month_mnlf1: parseFloat(p.avg_margin_last_month_mnlf1) || 0,
      avg_margin_this_week_mnlf1: parseFloat(p.avg_margin_this_week_mnlf1) || 0,
      avg_margin_last_week_mnlf1: parseFloat(p.avg_margin_last_week_mnlf1) || 0
    };
  },

  /**
   * Median of an array of numbers. Returns 0 for an empty array.
   * @param {Array<number>} arr
   * @return {number}
   * @private
   */
  _calculateMedian: function (arr) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
  },

  /**
   * Weighted 0-100 risk score: cost spike, selling price spike, margin
   * degradation, competitor overpricing, scaled by a revenue-importance
   * multiplier. Formula unchanged from the original.
   * @param {Object} p
   * @param {number} priceIndex
   * @return {number}
   * @private
   */
  _calculateProductRiskScore: function (p, priceIndex) {
    let score = 0;

    // 1. Cost spike check
    if (p.cost_price_last_month > 0) {
      const costChange = (p.cost_price_today - p.cost_price_last_month) / p.cost_price_last_month;
      if (costChange > 0.40) score += 35; // Critical cost increase
      else if (costChange > 0.20) score += 15; // Warning cost increase
    }

    // 2. Selling Price spike check
    if (p.selling_price_last_month > 0) {
      const spChange = (p.selling_price_today - p.selling_price_last_month) / p.selling_price_last_month;
      if (spChange > 0.40) score += 35;
      else if (spChange > 0.20) score += 15;
    }

    // 3. Margin degradation
    const marginToday = p.selling_price_today > 0 ? (p.selling_price_today - p.cost_price_today) / p.selling_price_today : 0;
    const marginLast = p.selling_price_last_month > 0 ? (p.selling_price_last_month - p.cost_price_last_month) / p.selling_price_last_month : 0;
    if (marginToday < 0) score += 40; // Negative margin
    else if (marginToday < marginLast - 0.05) score += 20; // Margin dropped > 5%

    // 4. Competitor price difference (Overpriced risk)
    if (priceIndex > 140) score += 30;
    else if (priceIndex > 120) score += 15;

    // 5. Volume weight (Revenue importance weight multiplier)
    let importanceMultiplier = 1.0;
    if (p.revenue_latest > 500000) {
      importanceMultiplier = 1.25; // Critical product
    }

    return Math.min(100, Math.round(score * importanceMultiplier));
  }
};
