/**
 * PriceGuardService.gs
 * ---------------------------------------------------------------------------
 * Composes the Price Guard dashboard payload from
 * PriceGuardMetricSnapshotService.getLatestMetricsSnapshot() (the
 * computed_daily_metrics snapshot table) plus the alerts/matches/
 * recommendations snapshot reads - mirrors the original project's
 * getCompositeDashboardData() / getDashboardSummary() / getProductsList()
 * / getCategoryHealth() / getSupplierHealth() RPC bodies in Code.gs,
 * just reassembled behind api_* wrappers instead of google.script.run.
 * ---------------------------------------------------------------------------
 */

const PriceGuardService = {
  /**
   * Returns everything the dashboard page needs in one call: summary
   * cards, full product list, supplier/category health, alerts,
   * matches, and pending recommendations. Cached briefly, same as
   * DashboardService.getDashboardData().
   * @return {Object}
   */
  getCompositeDashboardData: function () {
    const cacheKey = 'price_guard_dashboard_data';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const products = PriceGuardMetricSnapshotService.getLatestMetricsSnapshot();
    const summary = computePriceGuardSummaryFromProducts(products);
    const suppliers = computePriceGuardSupplierHealthFromProducts(products);
    const categories = computePriceGuardCategoryHealthFromProducts(products);
    const alerts = PriceGuardAnomalyService.getLatestAlerts();
    const matches = PriceGuardMatchingService.getMatches();
    const pendingRecommendations = PriceGuardPricingActionService.getRecommendations();
    const settings = PriceGuardSettingsService.getSettings();

    const result = {
      error: false,
      summary: summary,
      products: products,
      suppliers: suppliers,
      categories: categories,
      alerts: alerts.alerts,
      matches: matches.matches,
      pricingActions: pendingRecommendations.recommendations,
      settings: settings
    };

    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * Returns just the dashboard summary cards.
   * @return {Object}
   */
  getDashboardSummary: function () {
    const products = PriceGuardMetricSnapshotService.getLatestMetricsSnapshot();
    return { error: false, summary: computePriceGuardSummaryFromProducts(products) };
  },

  /**
   * Returns the full product catalog with computed metrics, optionally
   * filtered client-side over the (already in-memory) snapshot array by
   * category, supplier name, and/or a free-text search across product
   * name/SKU. Filtering happens in JS rather than SQL since the
   * snapshot is already fully materialized by getLatestMetricsSnapshot()
   * - the original getProductsList() RPC returned this same array
   *   completely unfiltered; filters are additive, not a change to what
   *   data is computed.
   * @param {Object} filters {category, supplierName, search}
   * @return {Object}
   */
  getProducts: function (filters) {
    const f = filters || {};
    let products = PriceGuardMetricSnapshotService.getLatestMetricsSnapshot();

    if (f.category) {
      const wantCategory = String(f.category).toLowerCase();
      products = products.filter(function (p) {
        return (p.category_level_1 || '').toLowerCase() === wantCategory;
      });
    }
    if (f.supplierName) {
      const wantSupplier = String(f.supplierName).toLowerCase();
      products = products.filter(function (p) {
        return (p.supplier_name || '').toLowerCase() === wantSupplier;
      });
    }
    if (f.search) {
      const wantSearch = String(f.search).toLowerCase();
      products = products.filter(function (p) {
        return (p.product_name || '').toLowerCase().indexOf(wantSearch) > -1 ||
               (p.product_sku || '').toLowerCase().indexOf(wantSearch) > -1;
      });
    }

    return { error: false, products: products, isEmpty: products.length === 0 };
  },

  /**
   * Returns category-level health scorecards.
   * @return {Object}
   */
  getCategoryHealth: function () {
    const products = PriceGuardMetricSnapshotService.getLatestMetricsSnapshot();
    return { error: false, categories: computePriceGuardCategoryHealthFromProducts(products) };
  },

  /**
   * Returns supplier-level health scorecards.
   * @return {Object}
   */
  getSupplierHealth: function () {
    const products = PriceGuardMetricSnapshotService.getLatestMetricsSnapshot();
    return { error: false, suppliers: computePriceGuardSupplierHealthFromProducts(products) };
  }
};
