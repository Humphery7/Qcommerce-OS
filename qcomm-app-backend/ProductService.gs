/**
 * ProductService.gs
 * ---------------------------------------------------------------------------
 * Serves Page 3 (Products). Two responsibilities:
 *
 *   1. getSupplierList() - populates the supplier dropdown. Reads from
 *      supplier_summary_snapshot (cheap, pre-aggregated) rather than the
 *      raw performance table.
 *
 *   2. getProductsForSupplier() - the ONLY place in the app that queries
 *      supplier_product_performance directly, and only for a single
 *      supplier at a time, per the performance requirements.
 * ---------------------------------------------------------------------------
 */

const ProductService = {
  /**
   * Returns the distinct list of supplier names for the dropdown,
   * sourced from the daily snapshot table (avoids scanning the much
   * larger supplier_product_performance table just to list names).
   * @return {Object}
   */
  getSupplierList: function () {
    const cacheKey = 'supplier_list';
    const cached = Utilities_.getCache(cacheKey);

    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_LIST_SNAPSHOT);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);
    console.log(JSON.stringify(rows, null, 2));
    const suppliers = rows.map(function (r) {
      return Utilities_.toSafeString(r.supplier_name);
    });

    const result = { error: false, suppliers: suppliers };
    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * Returns product-level performance rows for a single supplier, plus
   * a rolled-up summary block (products assigned / quantity ordered /
   * quantity received / fill rate) for the header area of the page.
   *
   * This queries supplier_product_performance directly (not cached, since
   * the requirement is "only query when loading the Products page or
   * changing suppliers" - i.e. on demand, not proactively).
   *
   * @param {string} supplierName
   * @return {Object}
   */
  getProductsForSupplier: function (supplierName) {
    const cleanName = Utilities_.toSafeString(supplierName);
    if (!cleanName) {
      return { error: false, supplierName: '', summary: ProductService._emptySummary(), products: [] };
    }

    const table = Utilities_.qualifiedTable(CONFIG.TABLES.PRODUCTS_FOR_SUPPLIER_SNAPSHOT);
    const escapedName = Utilities_.escapeSqlString(cleanName);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      "WHERE supplier_name = '" + escapedName + "' " +
      'ORDER BY product_name ASC';

    const rows = BigQueryService.runQuery(sql);
    // console.log(JSON.stringify(rows, null, 2));

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

    const summary = ProductService._buildSummary(products);

    return {
      error: false,
      supplierName: cleanName,
      summary: summary,
      products: products,
      isEmpty: products.length === 0
    };
  },

  /**
   * Rolls up product-level rows into the header summary block, using
   * the same SUM/SUM fill-rate rule as the daily snapshot (never an
   * average of per-product fill rates).
   * @param {Array<Object>} products
   * @return {Object}
   * @private
   */
  _buildSummary: function (products) {
    if (!products || products.length === 0) {
      return ProductService._emptySummary();
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
   * @return {Object} An empty summary block for when no supplier is selected
   *   or a supplier has no products.
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
