/**
 * WeightedAvailabilitySupplierService.gs
 * ---------------------------------------------------------------------------
 * Exact mirror of SupplierService.gs for the "Weighted Availability" tool.
 * Serves the Weighted Availability Supplier Summary page. Reads exclusively
 * from CONFIG.WA_TABLES.SUPPLIER_MONTHLY_METRICS_SNAPSHOT and
 * SUPPLIER_WEEKLY_METRICS_SNAPSHOT (dataset:
 * CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY), never from the raw
 * supplier_product_performance_nonuf / supplier_product_performance_week_nonuf
 * tables, same performance rule as the original.
 * ---------------------------------------------------------------------------
 */

const WeightedAvailabilitySupplierService = {
  /**
   * Returns every row of supplier_monthly_metrics_nonuf merged with
   * supplier_weekly_metrics_nonuf (joined on supplier_name), shaped for
   * the frontend table component - current/m1/m2 (monthly) and
   * current/w1/w2 (weekly) figures for every metric.
   * @return {Object}
   */
  getSupplierSummary: function () {
    const cacheKey = 'wa_supplier_summary_combined';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const monthlyTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_MONTHLY_METRICS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const monthlySql = 'SELECT * FROM ' + monthlyTable;

    const weeklyTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_WEEKLY_METRICS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const weeklySql = 'SELECT * FROM ' + weeklyTable;

    const monthlyRows = BigQueryService.runQuery(monthlySql);
    const weeklyRows = BigQueryService.runQuery(weeklySql);

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
