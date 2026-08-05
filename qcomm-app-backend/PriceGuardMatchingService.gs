/**
 * PriceGuardMatchingService.gs
 * ---------------------------------------------------------------------------
 * Migrated from the standalone Price Guard project's MatchingService.gs.
 *
 * Read side (getMatches): the original queried competitor_table_matches
 * live on every request. That table is populated by an external Python
 * matching engine and never written by this backend, so it's a
 * straight-copy snapshot candidate exactly like ForecastingService's
 * forecasting_products_snapshot - PriceGuardSnapshotService rebuilds
 * matches_snapshot from it daily, and getMatches() reads that instead.
 *
 * Write side (approveMatch/saveManualOverride/triggerRematch): unchanged.
 * These still write to product_matches, the separate manual
 * override/approval store - exactly as in the original. NOTE: the
 * original app never joined product_matches back into what getMatches()
 * reads (competitor_table_matches), so an approval here does not, by
 * itself, change what the match queue shows - see the "Not yet decided"
 * note in README.md. That's a pre-existing characteristic of the
 * source app, preserved as-is rather than silently "fixed".
 * ---------------------------------------------------------------------------
 */

const PriceGuardMatchingService = {
  /**
   * Returns the competitor match queue from matches_snapshot, optionally
   * filtered by SKU, competitor, and/or approval status.
   * @param {Object} filters {sku, competitor, isApproved}
   * @return {Object}
   */
  getMatches: function (filters) {
    const f = filters || {};
    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.MATCHES_SNAPSHOT, CONFIG.BQ_DATASET_PRICE_GUARD);

    const conditions = [
      Utilities_.equalsFilter('product_sku', f.sku),
      Utilities_.equalsFilter('competitor', f.competitor)
    ];
    if (f.isApproved !== undefined && f.isApproved !== null && f.isApproved !== '') {
      const boolVal = (f.isApproved === true || f.isApproved === 'true' || f.isApproved === '1');
      conditions.push('is_approved = ' + (boolVal ? 'TRUE' : 'FALSE'));
    }

    const where = Utilities_.buildWhereClause(conditions);
    const sql = 'SELECT * FROM ' + table + ' ' + where + 'ORDER BY match_confidence DESC';

    const rows = BigQueryService.runQuery(sql);
    return { error: false, matches: rows, isEmpty: rows.length === 0 };
  },

  /**
   * Sets is_approved = TRUE for a given (SKU, competitor) match in the
   * product_matches approval store.
   * @param {string} sku
   * @param {string} competitor
   * @return {Object}
   */
  approveMatch: function (sku, competitor) {
    const cleanSku = Utilities_.toSafeString(sku);
    const cleanCompetitor = Utilities_.toSafeString(competitor);
    if (!cleanSku || !cleanCompetitor) {
      throw new Error('SKU and competitor are required to approve a match.');
    }

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRODUCT_MATCHES, CONFIG.BQ_DATASET_PRICE_GUARD);
    const sql =
      'UPDATE ' + table + ' SET is_approved = TRUE ' +
      "WHERE product_sku = '" + Utilities_.escapeSqlString(cleanSku) + "' " +
      "  AND competitor = '" + Utilities_.escapeSqlString(cleanCompetitor) + "'";

    BigQueryService.runQuery(sql);
    return { success: true };
  },

  /**
   * Manually forces/creates a product match: deletes any existing row
   * for the (SKU, competitor) pair, then inserts a manual_override row
   * with confidence_score = 100.
   * @param {string} sku
   * @param {string} competitor
   * @param {string} productName Competitor product name.
   * @param {number} price
   * @param {string} explanation
   * @return {Object}
   */
  saveManualOverride: function (sku, competitor, productName, price, explanation) {
    const cleanSku = Utilities_.toSafeString(sku);
    const cleanCompetitor = Utilities_.toSafeString(competitor);
    if (!cleanSku || !cleanCompetitor) {
      throw new Error('SKU and competitor are required to save a manual override.');
    }
    const cleanName = Utilities_.toSafeString(productName);
    const cleanPrice = Utilities_.toNumber(price);
    const cleanExplanation = Utilities_.toSafeString(explanation) || 'Manually matched by administrator';

    const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRODUCT_MATCHES, CONFIG.BQ_DATASET_PRICE_GUARD);

    const deleteSql =
      'DELETE FROM ' + table + ' ' +
      "WHERE product_sku = '" + Utilities_.escapeSqlString(cleanSku) + "' " +
      "  AND competitor = '" + Utilities_.escapeSqlString(cleanCompetitor) + "'";
    BigQueryService.runQuery(deleteSql);

    const insertSql =
      'INSERT INTO ' + table + ' ' +
      '(product_sku, competitor, competitor_product_name, latest_price, confidence_score, ' +
      'match_method, match_explanation, is_approved, needs_rematch, last_matched_date) VALUES ' +
      "('" + Utilities_.escapeSqlString(cleanSku) + "', '" + Utilities_.escapeSqlString(cleanCompetitor) + "', '" +
      Utilities_.escapeSqlString(cleanName) + "', " + cleanPrice + ', 100.0, ' +
      "'manual_override', '" + Utilities_.escapeSqlString(cleanExplanation) + "', TRUE, FALSE, CURRENT_TIMESTAMP())";
    BigQueryService.runQuery(insertSql);

    return { success: true };
  },

  /**
   * Flags a SKU for rematching in product_matches and dispatches the
   * GitHub Actions rematch workflow, if github.pat/repo are configured
   * in PriceGuardSettingsService.
   * @param {string} sku
   * @return {Object}
   */
  triggerRematch: function (sku) {
    const cleanSku = Utilities_.toSafeString(sku);
    if (!cleanSku) {
      throw new Error('SKU is required to trigger a rematch.');
    }

    try {
      const table = Utilities_.qualifiedTable(CONFIG.PG_TABLES.PRODUCT_MATCHES, CONFIG.BQ_DATASET_PRICE_GUARD);
      const sql = 'UPDATE ' + table + ' SET needs_rematch = TRUE WHERE product_sku = \'' + Utilities_.escapeSqlString(cleanSku) + '\'';
      BigQueryService.runQuery(sql);

      const settings = PriceGuardSettingsService.getSettings();
      if (settings.github.pat && settings.github.repo) {
        const url = 'https://api.github.com/repos/' + settings.github.repo + '/dispatches';
        const headers = {
          Authorization: 'token ' + settings.github.pat,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PriceGuard-QCommerce-Backend'
        };
        const payload = {
          event_type: 'run_rematch',
          client_payload: { sku: cleanSku }
        };

        const response = UrlFetchApp.fetch(url, {
          method: 'post',
          headers: headers,
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });

        const code = response.getResponseCode();
        if (code === 204 || code === 200 || code === 201) {
          return { success: true, message: 'Rematch triggered successfully via GitHub Actions.' };
        }
        return { success: false, message: 'GitHub API returned code: ' + code + '. Body: ' + response.getContentText() };
      }
      return { success: true, message: 'Product flagged for rematching. GitHub Actions configuration missing, dispatch skipped.' };
    } catch (err) {
      return { success: false, message: 'Rematch dispatch failed: ' + err.toString() };
    }
  }
};
