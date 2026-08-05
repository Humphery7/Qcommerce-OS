/**
 * Utilities.gs
 * ---------------------------------------------------------------------------
 * Shared helper functions used across all backend services.
 * Namespaced as `Utilities_` to avoid colliding with Apps Script's built-in
 * `Utilities` service.
 * ---------------------------------------------------------------------------
 */

const Utilities_ = {
  /**
   * Builds a consistent error object to return to the client so the
   * frontend can show a friendly message instead of a raw stack trace.
   * @param {Error} err
   * @param {string} context Name of the function where the error occurred.
   * @return {{error: string, context: string}}
   */
  buildErrorResponse: function (err, context) {
    const message = (err && err.message) ? err.message : String(err);
    console.error('[' + context + '] ' + message);
    return {
      error: true,
      message: 'Something went wrong while loading data. Please try again in a moment.',
      context: context,
      detail: message
    };
  },

  /**
   * Safely converts a value to a Number, defaulting to 0 for null/undefined/NaN.
   * @param {*} value
   * @return {number}
   */
  toNumber: function (value) {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  },

  /**
   * Safely converts a value to a trimmed string, defaulting to ''.
   * @param {*} value
   * @return {string}
   */
  toSafeString: function (value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  },

  /**
   * Computes a ratio (numerator / denominator) safely, avoiding
   * divide-by-zero errors. Returns 0 if the denominator is 0.
   * @param {number} numerator
   * @param {number} denominator
   * @return {number}
   */
  safeRatio: function (numerator, denominator) {
    const num = Utilities_.toNumber(numerator);
    const den = Utilities_.toNumber(denominator);
    if (den === 0) return 0;
    return num / den;
  },

  /**
   * Rounds a decimal ratio (e.g. 0.8843) to a percentage string with a
   * fixed number of decimal places (e.g. "88.4%").
   * @param {number} ratio
   * @param {number} decimals
   * @return {string}
   */
  formatPercent: function (ratio, decimals) {
    const d = (decimals === undefined) ? 1 : decimals;
    return (Utilities_.toNumber(ratio) * 100).toFixed(d) + '%';
  },

  /**
   * Returns a fully-qualified BigQuery table reference, e.g.
   * `my-project.my_dataset.my_table`, safe to interpolate into a
   * standard SQL query with backticks.
   * @param {string} tableName
   * @param {string} [dataset] Dataset to qualify against. Defaults to
   *   CONFIG.BQ_DATASET so every existing call site (which never passed
   *   this argument) keeps behaving exactly as before. Pass e.g.
   *   CONFIG.BQ_DATASET_MFC to reach a table in a different dataset
   *   within the same project.
   * @return {string}
   */
  qualifiedTable: function (tableName, dataset) {
    const ds = dataset || CONFIG.BQ_DATASET;
    return '`' + CONFIG.BQ_PROJECT_ID + '.' + ds + '.' + tableName + '`';
  },

  /**
   * Builds a `WHERE ...` clause (including the leading keyword and a
   * trailing space) from an array of already-built SQL condition
   * strings, skipping any falsy entries so callers can push conditions
   * conditionally without pre-filtering. Returns '' (no WHERE at all)
   * when every condition was skipped.
   * @param {Array<string>} conditions
   * @return {string}
   */
  buildWhereClause: function (conditions) {
    const clean = (conditions || []).filter(function (c) { return !!c; });
    if (clean.length === 0) return '';
    return 'WHERE ' + clean.join(' AND ') + ' ';
  },

  /**
   * Builds a case-insensitive exact-match condition for a string filter
   * value, e.g. `Utilities_.equalsFilter('warehouse', 'Lagos')` ->
   * "LOWER(warehouse) = LOWER('Lagos')". Returns '' if value is empty,
   * so callers can push the result straight into buildWhereClause().
   * @param {string} column
   * @param {*} value
   * @return {string}
   */
  equalsFilter: function (column, value) {
    const clean = Utilities_.toSafeString(value);
    if (!clean) return '';
    return 'LOWER(' + column + ') = LOWER(\'' + Utilities_.escapeSqlString(clean) + '\')';
  },

  /**
   * Builds a case-insensitive substring-match condition for a search box
   * style filter across one or more columns, e.g.
   * Utilities_.searchFilter(['product_name', 'product_sku'], 'oil') ->
   * "(LOWER(product_name) LIKE LOWER('%oil%') OR LOWER(product_sku) LIKE LOWER('%oil%'))".
   * Returns '' if value is empty.
   * @param {Array<string>} columns
   * @param {*} value
   * @return {string}
   */
  searchFilter: function (columns, value) {
    const clean = Utilities_.toSafeString(value);
    if (!clean || !columns || columns.length === 0) return '';
    const escaped = Utilities_.escapeSqlString(clean);
    const parts = columns.map(function (col) {
      return 'LOWER(' + col + ") LIKE LOWER('%" + escaped + "%')";
    });
    return '(' + parts.join(' OR ') + ')';
  },

  /**
   * Escapes single quotes in a string value so it can be safely embedded
   * inside a BigQuery standard SQL string literal. BigQueryService still
   * prefers parameterized queries where possible; this is a fallback for
   * simple identifier-like values (e.g. supplier names).
   * @param {string} value
   * @return {string}
   */
  escapeSqlString: function (value) {
    return Utilities_.toSafeString(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },

  /**
   * Reads from CacheService (script cache) and returns the parsed JSON,
   * or null if not present / parsing fails.
   * @param {string} key
   * @return {*}
   */
  getCache: function (key) {
    try {
      const cache = CacheService.getScriptCache();
      const raw = cache.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Cache read failed for key ' + key + ': ' + err.message);
      return null;
    }
  },

  /**
   * Writes a JSON-serializable value to CacheService (script cache).
   * Silently no-ops on failure (cache is a performance optimization,
   * never a correctness requirement).
   * @param {string} key
   * @param {*} value
   * @param {number} ttlSeconds
   */
  setCache: function (key, value, ttlSeconds) {
    try {
      const cache = CacheService.getScriptCache();
      const ttl = ttlSeconds || CONFIG.CACHE_TTL_SECONDS;
      // CacheService has a 100KB per-value limit; guard against oversized payloads.
      const serialized = JSON.stringify(value);
      if (serialized.length < 95000) {
        cache.put(key, serialized, ttl);
      }
    } catch (err) {
      console.warn('Cache write failed for key ' + key + ': ' + err.message);
    }
  },

  /**
   * Removes one or more keys from CacheService (script cache). Used after
   * writes (e.g. supplier price add/update/delete) to invalidate any
   * cached API payloads that were derived from the changed data.
   * @param {Array<string>} keys
   */
  clearCache: function (keys) {
    try {
      CacheService.getScriptCache().removeAll(keys);
    } catch (err) {
      console.warn('Cache clear failed for keys ' + keys.join(', ') + ': ' + err.message);
    }
  },

  /**
   * Formats a month string like "2026-04" into a short label like "Apr".
   * @param {string} yyyyMm
   * @return {string}
   */
  monthLabel: function (yyyyMm) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = Utilities_.toSafeString(yyyyMm).split('-');
    if (parts.length !== 2) return yyyyMm;
    const idx = parseInt(parts[1], 10) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return months[idx];
  }
};
