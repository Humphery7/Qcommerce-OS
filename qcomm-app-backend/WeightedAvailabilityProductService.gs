/**
 * WeightedAvailabilityProductService.gs
 * ---------------------------------------------------------------------------
 * Exact mirror of ProductService.gs for the "Weighted Availability" tool.
 * Two responsibilities:
 *
 *   1. getSupplierList() - populates the supplier dropdown. Reads from
 *      CONFIG.WA_TABLES.SUPPLIER_SUMMARY_SNAPSHOT.
 *
 *   2. getProductsForSupplier() - reads CONFIG.WA_TABLES.PRODUCTS_FOR_SUPPLIER_SNAPSHOT
 *      for a single supplier at a time.
 * ---------------------------------------------------------------------------
 */

const WeightedAvailabilityProductService = {
  /**
   * @return {Object}
   */
  getSupplierList: function () {
    const cacheKey = 'wa_supplier_list';
    const cached = Utilities_.getCache(cacheKey);

    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_LIST_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    const suppliers = rows.map(function (r) {
      return Utilities_.toSafeString(r.supplier_name);
    });

    const result = { error: false, suppliers: suppliers };
    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * @param {string} supplierName
   * @return {Object}
   */
  getProductsForSupplier: function (supplierName) {
    const cleanName = Utilities_.toSafeString(supplierName);
    if (!cleanName) {
      return { error: false, supplierName: '', summary: WeightedAvailabilityProductService._emptySummary(), products: [] };
    }

    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.PRODUCTS_FOR_SUPPLIER_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const escapedName = Utilities_.escapeSqlString(cleanName);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      "WHERE supplier_name = '" + escapedName + "' " +
      'ORDER BY product_name ASC';

    const rows = BigQueryService.runQuery(sql);

    const products = rows.map(function (r) {
      return {
        sku: Utilities_.toSafeString(r.product_sku),
        productName: Utilities_.toSafeString(r.product_name),
        categoryLevelOne: Utilities_.toSafeString(r.product_category_level_one),
        categoryLevelTwo: Utilities_.toSafeString(r.product_category_level_two),
        categoryLevelThree: Utilities_.toSafeString(r.product_category_level_three),
        quantityOrdered: Utilities_.toNumber(r.quantity_ordered),
        quantityReceived: Utilities_.toNumber(r.quantity_received),
        fillRate: Utilities_.toNumber(r.fill_rate),
        averageCost: Utilities_.toNumber(r.average_cost),
        latestCost: Utilities_.toNumber(r.latest_cost),
        currentAvailability: Utilities_.toNumber(r.current_week),
        weeklyTrend: [
          { label: 'Wk -5', value: Utilities_.toNumber(r.week_minus_5) },
          { label: 'Wk -4', value: Utilities_.toNumber(r.week_minus_4) },
          { label: 'Wk -3', value: Utilities_.toNumber(r.week_minus_3) },
          { label: 'Wk -2', value: Utilities_.toNumber(r.week_minus_2) },
          { label: 'Wk -1', value: Utilities_.toNumber(r.week_minus_1) },
          { label: 'Current', value: Utilities_.toNumber(r.current_week) }
        ]
      };
    });

    const summary = WeightedAvailabilityProductService._buildSummary(products);

    return {
      error: false,
      supplierName: cleanName,
      summary: summary,
      products: products,
      isEmpty: products.length === 0
    };
  },

  /**
   * @param {Array<Object>} products
   * @return {Object}
   * @private
   */
  _buildSummary: function (products) {
    if (!products || products.length === 0) {
      return WeightedAvailabilityProductService._emptySummary();
    }
    let quantityOrdered = 0;
    let quantityReceived = 0;
    products.forEach(function (p) {
      quantityOrdered += p.quantityOrdered;
      quantityReceived += p.quantityReceived;
    });
    return {
      productsAssigned: products.length,
      quantityOrdered: quantityOrdered,
      quantityReceived: quantityReceived,
      fillRate: Utilities_.safeRatio(quantityReceived, quantityOrdered)
    };
  },

  /**
   * @return {Object}
   * @private
   */
  _emptySummary: function () {
    return {
      productsAssigned: 0,
      quantityOrdered: 0,
      quantityReceived: 0,
      fillRate: 0
    };
  }
};
