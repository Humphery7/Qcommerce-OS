/**
 * SupplierPriceService.gs
 * ---------------------------------------------------------------------------
 * Backend support for the supplier_prices table (SKU, Product_Name,
 * Supplier_ID, Supplier_Name, Trade_Price). This table is maintained
 * directly by users from the Recommendations page's "Update Prices"
 * modal - there is no dedicated Supplier Prices page.
 *
 * (SKU, Supplier_ID) is the natural key: one supplier can quote a price
 * for a product only once. addOrUpdatePrice() uses a BigQuery MERGE on
 * that key so the same call works for both "add" and "edit".
 * ---------------------------------------------------------------------------
 */

const SupplierPriceService = {
  /**
   * Returns every row of supplier_prices, cached briefly (~60s) since the
   * table is small but actively edited from the UI.
   * @return {Object}
   */
  getAllPrices: function () {
    const cacheKey = 'supplier_prices';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRICES_SNAPSHOT);
    const sql = 'SELECT * FROM ' + table;

    const rows = BigQueryService.runQuery(sql);

    const prices = rows.map(function (r) {
      return {
        sku: Utilities_.toSafeString(r.SKU),
        productName: Utilities_.toSafeString(r.Product_Name),
        supplierId: Utilities_.toSafeString(r.Supplier_ID),
        supplierName: Utilities_.toSafeString(r.Supplier_Name),
        tradePrice: Utilities_.toNumber(r.Trade_Price)
      };
    });

    const result = {
      error: false,
      prices: prices,
      isEmpty: prices.length === 0
    };

    Utilities_.setCache(cacheKey, result, CONFIG.SUPPLIER_PRICES_CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * Inserts a new supplier price, or updates Product_Name and Trade_Price
   * for an existing (SKU, Supplier_ID) pair, via a single BigQuery MERGE.
   * @param {Object} priceData {sku, productName, supplierId, supplierName, tradePrice}
   * @return {{success: boolean}}
   */
  addOrUpdatePrice: function (priceData) {
    const data = priceData || {};
    const sku = Utilities_.toSafeString(data.sku);
    const productName = Utilities_.toSafeString(data.productName);
    const supplierId = Utilities_.toSafeString(data.supplierId);
    const supplierName = Utilities_.toSafeString(data.supplierName);
    const tradePrice = Utilities_.toNumber(data.tradePrice);

    if (!sku || !supplierId) {
      throw new Error('SKU and Supplier ID are required to save a supplier price.');
    }

    const table = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRICES);
    const sql =
      'MERGE ' + table + ' AS target ' +
      'USING (SELECT ' +
      "  '" + Utilities_.escapeSqlString(sku) + "' AS SKU, " +
      "  '" + Utilities_.escapeSqlString(productName) + "' AS Product_Name, " +
      "  '" + Utilities_.escapeSqlString(supplierId) + "' AS Supplier_ID, " +
      "  '" + Utilities_.escapeSqlString(supplierName) + "' AS Supplier_Name, " +
      '  ' + tradePrice + ' AS Trade_Price' +
      ') AS source ' +
      'ON target.SKU = source.SKU AND target.Supplier_ID = source.Supplier_ID ' +
      'WHEN MATCHED THEN ' +
      '  UPDATE SET target.Product_Name = source.Product_Name, target.Trade_Price = source.Trade_Price ' +
      'WHEN NOT MATCHED THEN ' +
      '  INSERT (SKU, Product_Name, Supplier_ID, Supplier_Name, Trade_Price) ' +
      '  VALUES (source.SKU, source.Product_Name, source.Supplier_ID, source.Supplier_Name, source.Trade_Price)';

    BigQueryService.runQuery(sql);
    SupplierPriceService._clearDependentCaches();
    return { success: true };
  },

  /**
   * Deletes a single supplier price by its (SKU, Supplier_ID) key.
   * @param {string} sku
   * @param {string} supplierId
   * @return {{success: boolean}}
   */
  deletePrice: function (sku, supplierId) {
    const cleanSku = Utilities_.toSafeString(sku);
    const cleanSupplierId = Utilities_.toSafeString(supplierId);

    if (!cleanSku || !cleanSupplierId) {
      throw new Error('SKU and Supplier ID are required to delete a supplier price.');
    }

    const table = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRICES);
    const sql =
      'DELETE FROM ' + table + ' ' +
      "WHERE SKU = '" + Utilities_.escapeSqlString(cleanSku) + "' " +
      "  AND Supplier_ID = '" + Utilities_.escapeSqlString(cleanSupplierId) + "'";

    BigQueryService.runQuery(sql);
    SupplierPriceService._clearDependentCaches();
    return { success: true };
  },

  /**
   * Any write to supplier_prices invalidates the raw price cache and
   * rebuilds the materialized `recommendations` table (see
   * RecommendationService.gs) so the Recommendations page reflects the
   * change immediately. Recommendations are otherwise only rebuilt once a
   * day by the snapshot trigger, so this keeps the (rare, user-initiated)
   * write path in sync without putting the expensive join back on every
   * page read.
   *
   * Also rebuilds WeightedAvailabilityRecommendationService's table -
   * supplier_prices is shared between both tools (not duplicated), so a
   * price edit legitimately changes both tools' recommendation scores.
   * @private
   */
  _clearDependentCaches: function () {
    SnapshotService.rebuildSupplierPricesSnapshot();
    RecommendationService.rebuildSnapshot();
    WeightedAvailabilityRecommendationService.rebuildSnapshot();
    Utilities_.clearCache(['supplier_prices']);
  }
};
