/**
 * PriceGuardPricingActionService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's
 * PricingActionService.gs.
 *
 * Read side: the original queried price_recommendations live, filtered
 * by status, on every request. Per this migration's goal of minimizing
 * BigQuery reads, getRecommendations()/getRecommendationHistory() now
 * read price_recommendations_pending_snapshot /
 * price_recommendations_history_snapshot instead - rebuilt immediately
 * after every write (see _rebuildSnapshots below), the same pattern
 * SupplierPriceService already uses for supplier_prices_snapshot.
 * Briefly cached (PRICE_GUARD_RECOMMENDATIONS_CACHE_TTL_SECONDS = 60s),
 * matching getAllPrices' cache TTL for the same reason: actively edited
 * from the UI, should still feel responsive after a write.
 *
 * getProductMetrics(sku) reads computed_daily_metrics directly, filtered
 * to one SKU and the latest snapshot_date - a cheap filtered read, no
 * cache, same as getProductsForSupplier.
 *
 * Write side: preserved, with two pre-existing gaps fixed (flagged, not
 * silently patched):
 *   1. The original called a BigQueryService.runParameterizedQuery()
 *      that was never defined anywhere in the project - getProductMetrics,
 *      approveRecommendation, and rejectRecommendation would all have
 *      thrown at runtime. Rewritten here using the same safe string
 *      escaping (Utilities_.escapeSqlString) every other write endpoint
 *      in this codebase already uses (see SupplierPriceService.gs).
 *   2. Code.gs called PricingActionService.approveRecommendations(ids)
 *      (plural, bulk) but PricingActionService only ever exported the
 *      singular approveRecommendation(id) - the bulk-approve button in
 *      index.html would have thrown. Implemented here as a loop over
 *      the same single-row UPDATE.
 * ---------------------------------------------------------------------------
 */

const PriceGuardPricingActionService = {
  /**
   * Returns pending recommendations from price_recommendations_pending_snapshot.
   * @return {Object}
   */
  getRecommendations: function () {
    const cacheKey = 'price_guard_recommendations_pending';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS_PENDING_SNAPSHOT, CONFIG.BQ_DATASET_PRICE_GUARD);
    const rows = BigQueryService.runQuery('SELECT * FROM ' + table + ' ORDER BY created_at DESC');

    const result = { error: false, recommendations: rows, isEmpty: rows.length === 0 };
    Utilities_.setCache(cacheKey, result, CONFIG.PRICE_GUARD_RECOMMENDATIONS_CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * Returns approved/rejected recommendation history from
   * price_recommendations_history_snapshot.
   * @return {Object}
   */
  getRecommendationHistory: function () {
    const cacheKey = 'price_guard_recommendations_history';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS_HISTORY_SNAPSHOT, CONFIG.BQ_DATASET_PRICE_GUARD);
    const rows = BigQueryService.runQuery('SELECT * FROM ' + table + ' ORDER BY updated_at DESC');

    const result = { error: false, recommendations: rows, isEmpty: rows.length === 0 };
    Utilities_.setCache(cacheKey, result, CONFIG.PRICE_GUARD_RECOMMENDATIONS_CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * Returns the precomputed metrics for a single SKU (from
   * computed_daily_metrics, filtered to the latest snapshot_date), used
   * to auto-populate the "New Recommendation" form.
   * @param {string} sku
   * @return {Object}
   */
  getProductMetrics: function (sku) {
    const cleanSku = Utilities_.toSafeString(sku);
    if (!cleanSku) {
      throw new Error('SKU is required to look up product metrics.');
    }

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.COMPUTED_DAILY_METRICS, CONFIG.BQ_DATASET_PRICE_GUARD);
    const sql =
      'SELECT * FROM ' + table + ' ' +
      "WHERE product_sku = '" + Utilities_.escapeSqlString(cleanSku) + "' " +
      '  AND snapshot_date = (SELECT MAX(snapshot_date) FROM ' + table + ') ' +
      'LIMIT 1';

    const rows = BigQueryService.runQuery(sql);
    return { error: false, hasData: rows.length > 0, metrics: rows.length > 0 ? rows[0] : null };
  },

  /**
   * Inserts a new pricing recommendation (status = Pending), then
   * rebuilds the pending/history snapshots so it shows up immediately.
   * @param {Object} data Recommendation payload from the frontend.
   * @return {Object}
   */
  submitRecommendation: function (data) {
    const payload = data || {};
    const now = new Date().toISOString();

    const row = {
      recommendation_id: Utilities.getUuid(),
      recommendation_date: Utilities_.toSafeString(payload.recommendation_date) || Utilities.formatDate(new Date(), 'GMT+1', 'yyyy-MM-dd'),
      product_sku: Utilities_.toSafeString(payload.product_sku),
      product_name: Utilities_.toSafeString(payload.product_name),
      supplier_name: Utilities_.toSafeString(payload.supplier_name),
      category_level_1: Utilities_.toSafeString(payload.category_level_1),
      action_type: Utilities_.toSafeString(payload.action_type),
      current_price: Utilities_.toNumber(payload.current_price),
      recommended_price: Utilities_.toNumber(payload.recommended_price),
      expected_margin: Utilities_.toNumber(payload.expected_margin),
      expected_profit_impact: Utilities_.toNumber(payload.expected_profit_impact),
      reason: Utilities_.toSafeString(payload.reason),
      requested_by: Session.getActiveUser().getEmail(),
      status: 'Pending',
      created_at: now,
      updated_at: now
    };

    if (!row.product_sku) {
      throw new Error('product_sku is required to submit a pricing recommendation.');
    }

    const fullTableId = CONFIG.BQ_PROJECT_ID + '.' + CONFIG.BQ_DATASET_PRICE_GUARD + '.' + CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS;
    const success = BigQueryService.insertRows(fullTableId, [row]);

    if (success) {
      PriceGuardPricingActionService._rebuildSnapshots();
    }

    return { success: success, recommendation_id: row.recommendation_id };
  },

  /**
   * Approves a single pending recommendation by ID.
   * @param {string} id
   * @return {Object}
   */
  approveRecommendation: function (id) {
    const cleanId = Utilities_.toSafeString(id);
    if (!cleanId) {
      throw new Error('recommendation_id is required to approve a recommendation.');
    }

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS, CONFIG.BQ_DATASET_PRICE_GUARD);
    const sql =
      'UPDATE ' + table + ' SET ' +
      "status = 'Approved', " +
      'approved_at = CURRENT_TIMESTAMP(), ' +
      'updated_at = CURRENT_TIMESTAMP() ' +
      "WHERE recommendation_id = '" + Utilities_.escapeSqlString(cleanId) + "'";

    BigQueryService.runQuery(sql);
    PriceGuardPricingActionService._rebuildSnapshots();
    return { success: true };
  },

  /**
   * Approves multiple pending recommendations by ID. Not present in the
   * original PricingActionService (only the singular existed, despite
   * Code.gs calling the plural) - implemented as a loop over the same
   * single-row UPDATE, rebuilding snapshots once at the end rather than
   * once per row.
   * @param {Array<string>} ids
   * @return {Object}
   */
  approveRecommendations: function (ids) {
    const list = Array.isArray(ids) ? ids : [];
    if (list.length === 0) {
      return { success: true, approved_count: 0 };
    }

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS, CONFIG.BQ_DATASET_PRICE_GUARD);
    const escapedIds = list
      .map(function (id) { return Utilities_.toSafeString(id); })
      .filter(function (id) { return !!id; })
      .map(function (id) { return "'" + Utilities_.escapeSqlString(id) + "'"; });

    if (escapedIds.length === 0) {
      return { success: true, approved_count: 0 };
    }

    const sql =
      'UPDATE ' + table + ' SET ' +
      "status = 'Approved', " +
      'approved_at = CURRENT_TIMESTAMP(), ' +
      'updated_at = CURRENT_TIMESTAMP() ' +
      'WHERE recommendation_id IN (' + escapedIds.join(', ') + ')';

    BigQueryService.runQuery(sql);
    PriceGuardPricingActionService._rebuildSnapshots();
    return { success: true, approved_count: escapedIds.length };
  },

  /**
   * Rejects a single pending recommendation by ID.
   * @param {string} id
   * @return {Object}
   */
  rejectRecommendation: function (id) {
    const cleanId = Utilities_.toSafeString(id);
    if (!cleanId) {
      throw new Error('recommendation_id is required to reject a recommendation.');
    }

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRICE_RECOMMENDATIONS, CONFIG.BQ_DATASET_PRICE_GUARD);
    const sql =
      'UPDATE ' + table + ' SET ' +
      "status = 'Rejected', " +
      'rejected_at = CURRENT_TIMESTAMP(), ' +
      'updated_at = CURRENT_TIMESTAMP() ' +
      "WHERE recommendation_id = '" + Utilities_.escapeSqlString(cleanId) + "'";

    BigQueryService.runQuery(sql);
    PriceGuardPricingActionService._rebuildSnapshots();
    return { success: true };
  },

  /**
   * Rebuilds both recommendation snapshot tables and clears their
   * caches. Called after every write, same pattern as
   * SupplierPriceService._clearDependentCaches().
   * @private
   */
  _rebuildSnapshots: function () {
    PriceGuardSnapshotService.rebuildRecommendationsSnapshots();
    Utilities_.clearCache(['price_guard_recommendations_pending', 'price_guard_recommendations_history']);
  }
};
