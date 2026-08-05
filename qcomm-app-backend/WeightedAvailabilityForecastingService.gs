/**
 * WeightedAvailabilityForecastingService.gs
 * ---------------------------------------------------------------------------
 * Exact mirror of ForecastingService.gs for the "Weighted Availability"
 * tool. Serves CONFIG.WA_TABLES.FORECASTING_PRODUCTS_SNAPSHOT (dataset:
 * CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY), answering "Are we ordering
 * enough?" for all products, not just ultrafresh ones.
 *
 * Reads exclusively from the pre-built snapshot table, never from the raw
 * forecasting_nonufproducts source table. SnapshotService rebuilds it once
 * a day (or on demand via runSnapshotNow).
 * ---------------------------------------------------------------------------
 */

const WeightedAvailabilityForecastingService = {
  /**
   * @param {Object} filters {warehouse, category, sku, search}
   * @return {Object}
   */
  getForecastingProducts: function (filters) {
    const f = filters || {};
    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.FORECASTING_PRODUCTS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);

    const where = Utilities_.buildWhereClause([
      Utilities_.equalsFilter('warehouse', f.warehouse),
      Utilities_.equalsFilter('product_category_level_one', f.category),
      Utilities_.equalsFilter('product_sku', f.sku),
      Utilities_.searchFilter(['product_name', 'product_sku'], f.search)
    ]);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      where +
      'ORDER BY warehouse ASC, product_name ASC';

    const rows = BigQueryService.runQuery(sql);
    const products = rows.map(WeightedAvailabilityForecastingService._mapRow);

    return {
      error: false,
      products: products,
      isEmpty: products.length === 0
    };
  },

  /**
   * @return {Object}
   */
  getFilterOptions: function () {
    const cacheKey = 'wa_forecasting_filter_options';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.FORECASTING_PRODUCTS_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql =
      'SELECT DISTINCT warehouse, product_category_level_one ' +
      'FROM ' + table;

    const rows = BigQueryService.runQuery(sql);

    const warehouseSet = {};
    const categorySet = {};
    rows.forEach(function (r) {
      const w = Utilities_.toSafeString(r.warehouse);
      const c = Utilities_.toSafeString(r.product_category_level_one);
      if (w) warehouseSet[w] = true;
      if (c) categorySet[c] = true;
    });

    const result = {
      error: false,
      warehouses: Object.keys(warehouseSet).sort(),
      categories: Object.keys(categorySet).sort()
    };

    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * @param {Object} r
   * @return {Object}
   * @private
   */
  _mapRow: function (r) {
    return {
      warehouse: Utilities_.toSafeString(r.warehouse),
      sku: Utilities_.toSafeString(r.product_sku),
      productName: Utilities_.toSafeString(r.product_name),
      categoryLevelOne: Utilities_.toSafeString(r.product_category_level_one),

      lastWeekSales: Utilities_.toNumber(r.last_week_sales),
      avgDailySales: Utilities_.toNumber(r.avg_daily_sales),
      avgHourlySales: Utilities_.toNumber(r.avg_hourly_sales),

      currentStockOnHand: Utilities_.toNumber(r.current_stock_on_hand),
      totalOrderedLast7Days: Utilities_.toNumber(r.total_ordered_last_7_days),
      totalReceivedLast7Days: Utilities_.toNumber(r.total_received_last_7_days),

      lastOrderDate: Utilities_.toSafeString(r.last_order_date),
      lastQuantityOrdered: Utilities_.toNumber(r.last_quantity_ordered),
      lastReceivedDate: Utilities_.toSafeString(r.last_received_date),
      lastQuantityReceived: Utilities_.toNumber(r.last_quantity_received),

      purchaseOrdersLast30Days: Utilities_.toNumber(r.purchase_orders_last_30_days),
      averageOrderQuantity30Days: Utilities_.toNumber(r.average_order_quantity_30_days),
      typicalDaysBetweenOrders: Utilities_.toNumber(r.typical_days_between_orders),
      averageSupplierDeliveryTime30Days: Utilities_.toNumber(r.average_supplier_delivery_time_30_days),
      supplierFillRate: Utilities_.toNumber(r.supplier_fill_rate),

      daysSinceLastOrder: Utilities_.toNumber(r.days_since_last_order),
      daysSinceLastDelivery: Utilities_.toNumber(r.days_since_last_delivery),

      availableInventory: Utilities_.toNumber(r.available_inventory),
      expectedSalesBeforeDelivery: Utilities_.toNumber(r.expected_sales_before_delivery),
      daysInventoryWillLast: Utilities_.toNumber(r.days_inventory_will_last),
      expectedShortageBeforeDelivery: Utilities_.toNumber(r.expected_shortage_before_delivery),

      orderingPattern: Utilities_.toSafeString(r.ordering_pattern),
      daysUntilNextOrder: Utilities_.toNumber(r.days_until_next_order),
      suggestedNextOrderQuantity: Utilities_.toNumber(r.suggested_next_order_quantity),

      inventoryStatus: Utilities_.toSafeString(r.inventory_status),
      recommendedAction: Utilities_.toSafeString(r.recommended_action)
    };
  }
};
