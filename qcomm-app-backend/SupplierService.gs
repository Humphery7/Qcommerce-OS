/**
 * SupplierService.gs
 * ---------------------------------------------------------------------------
 * Serves Page 2 (Supplier Summary). Reads exclusively from the
 * supplier_monthly_metrics and supplier_weekly_metrics tables, never from
 * the raw supplier_product_performance / supplier_product_performance_week
 * tables, to keep this page fast.
 *
 * supplier_monthly_metrics carries one row per supplier with parallel sets
 * of columns for three periods: the current month (*_current), last month
 * (*_m1), and the last two months (*_m2). supplier_weekly_metrics mirrors
 * that shape for the current week, last week (*_w1), and last two weeks
 * (*_w2). Both tables are joined on supplier_name and all six periods are
 * fetched in a single round trip and returned to the client together, so
 * switching the "Period" filter on the frontend - Monthly or Weekly - is
 * instant and doesn't require another round trip to the server.
 *
 * Sorting, searching, and filtering all happen client-side in
 * SupplierSummary.html / JavaScript.html since the table is small
 * (one row per supplier).
 * ---------------------------------------------------------------------------
 */

const SupplierService = {
  /**
   * Returns every row of supplier_monthly_metrics merged with
   * supplier_weekly_metrics (joined on supplier_name), shaped for the
   * frontend table component. Includes current/m1/m2 (monthly) and
   * current/w1/w2 (weekly) figures for every metric so the client can
   * switch periods - Current Month, Last Month, Last 2 Months, Current
   * Week, Last Week, Last 2 Weeks - without re-querying.
   * @return {Object}
   */
  getSupplierSummary: function () {
    const cacheKey = 'supplier_summary_combined';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const monthlyTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_MONTHLY_METRICS_SNAPSHOT);
    const monthlySql = 'SELECT * FROM ' + monthlyTable;

    const weeklyTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_WEEKLY_METRICS_SNAPSHOT);
    const weeklySql = 'SELECT * FROM ' + weeklyTable;

    const monthlyRows = BigQueryService.runQuery(monthlySql);
    const weeklyRows = BigQueryService.runQuery(weeklySql);

    // Index the weekly rows by supplier name for an O(1) merge into the
    // monthly rows below.
    const weeklyByName = {};
    weeklyRows.forEach(function (r) {
      weeklyByName[Utilities_.toSafeString(r.supplier_name)] = r;
    });

    const suppliers = monthlyRows.map(function (r) {
      const supplierName = Utilities_.toSafeString(r.supplier_name);
      const w = weeklyByName[supplierName];

      return {
        supplierName: supplierName,

        orderedCurrent: Utilities_.toNumber(r.ordered_current),
        receivedCurrent: Utilities_.toNumber(r.received_current),
        fillRateCurrent: Utilities_.toNumber(r.fill_rate_current),
        productCountCurrent: Utilities_.toNumber(r.product_count_current),

        orderedM1: Utilities_.toNumber(r.ordered_m1),
        receivedM1: Utilities_.toNumber(r.received_m1),
        fillRateM1: Utilities_.toNumber(r.fill_rate_m1),
        productCountM1: Utilities_.toNumber(r.product_count_m1),

        orderedM2: Utilities_.toNumber(r.ordered_m2),
        receivedM2: Utilities_.toNumber(r.received_m2),
        fillRateM2: Utilities_.toNumber(r.fill_rate_m2),
        productCountM2: Utilities_.toNumber(r.product_count_m2),

        // Weekly figures - 0 for any supplier that has no row yet in
        // supplier_weekly_metrics, so the table still renders instead of
        // erroring out if the two tables are momentarily out of sync.
        orderedWeekCurrent: Utilities_.toNumber(w && w.ordered_current),
        receivedWeekCurrent: Utilities_.toNumber(w && w.received_current),
        fillRateWeekCurrent: Utilities_.toNumber(w && w.fill_rate_current),
        productCountWeekCurrent: Utilities_.toNumber(w && w.product_count_current),

        orderedW1: Utilities_.toNumber(w && w.ordered_w1),
        receivedW1: Utilities_.toNumber(w && w.received_w1),
        fillRateW1: Utilities_.toNumber(w && w.fill_rate_w1),
        productCountW1: Utilities_.toNumber(w && w.product_count_w1),

        orderedW2: Utilities_.toNumber(w && w.ordered_w2),
        receivedW2: Utilities_.toNumber(w && w.received_w2),
        fillRateW2: Utilities_.toNumber(w && w.fill_rate_w2),
        productCountW2: Utilities_.toNumber(w && w.product_count_w2)
      };
    });

    const result = {
      error: false,
      suppliers: suppliers,
      isEmpty: suppliers.length === 0
    };

    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  }
};













