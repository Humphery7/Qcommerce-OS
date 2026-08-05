/**
 * RecommendationService.gs
 * ---------------------------------------------------------------------------
 * Supplier recommendations are materialized into a `recommendations` table
 * (CREATE OR REPLACE TABLE, same pattern as SnapshotService.gs) rather than
 * being computed by joining supplier_prices / supplier_product_performance /
 * supplier_summary_snapshot on every page read. This keeps the expensive
 * three-way join + per-SKU normalization + ranking off the hot read path:
 *
 *   - rebuildSnapshot()    runs the heavy join and rewrites the table.
 *                          Called once a day via SnapshotService's daily
 *                          trigger, and immediately after any supplier
 *                          price add/edit/delete (see SupplierPriceService.gs)
 *                          so the Recommendations page reflects price
 *                          changes right away without recomputing on every
 *                          read.
 *   - getRecommendations() only ever does a plain SELECT * FROM
 *                          recommendations, cached like every other read
 *                          in this app.
 * ---------------------------------------------------------------------------
 */

const RecommendationService = {
  /**
   * Reads the pre-computed recommendations table. Cheap: no joins, no
   * window functions, just a SELECT off an already-ranked table.
   * @return {Object}
   */
  getRecommendations: function () {
    const cacheKey = 'recommendations';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.TABLES.RECOMMENDATIONS);
    const sql =
      'SELECT sku, product_name, supplier_id, supplier_name, trade_price, ' +
      '  product_fill_rate, overall_fill_rate, score, supplier_rank, snapshot_generated_at ' +
      'FROM ' + table + ' ' +
      'ORDER BY sku ASC, supplier_rank ASC';

    const rows = BigQueryService.runQuery(sql);
    const products = RecommendationService._groupByProduct(rows);
    const lastUpdated = rows.length > 0 ? rows[0].snapshot_generated_at : null;

    const result = {
      error: false,
      products: products,
      isEmpty: products.length === 0,
      lastUpdated: lastUpdated
    };

    Utilities_.setCache(cacheKey, result, CONFIG.CACHE_TTL_SECONDS);
    return result;
  },

  /**
   * Rebuilds the `recommendations` table from scratch: joins supplier_prices
   * with supplier_product_performance (product-level fill rate per
   * supplier) and supplier_summary_snapshot (overall fill rate per
   * supplier), normalizes Trade_Price within each SKU, blends the three
   * signals into a score per CONFIG.RECOMMENDATION_WEIGHTS, ranks suppliers
   * per SKU, and keeps only the top 3. This is the one place the heavy join
   * actually runs.
   */
  rebuildSnapshot: function () {
    const pricesTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRICES);
    const performanceTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRODUCT_PERFORMANCE);
    const summaryTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_SUMMARY_SNAPSHOT);
    const targetTable = Utilities_.qualifiedTable(CONFIG.TABLES.RECOMMENDATIONS);
    const w = CONFIG.RECOMMENDATION_WEIGHTS;

    // Score expression is repeated (SELECT + ORDER BY of the window
    // function) since BigQuery doesn't allow referencing a SELECT alias
    // inside the same-level window function's ORDER BY.
    const scoreExpr =
      '(product_fill_rate * ' + w.productFillRate + ') + ' +
      '(overall_fill_rate * ' + w.overallFillRate + ') + ' +
      '((1 - normalized_price) * ' + w.priceScore + ')';

    const sql =
      'CREATE OR REPLACE TABLE ' + targetTable + ' AS ' +
      'WITH joined AS ( ' +
      '  SELECT ' +
      '    sp.SKU AS sku, ' +
      '    sp.Product_Name AS product_name, ' +
      '    sp.Supplier_ID AS supplier_id, ' +
      '    sp.Supplier_Name AS supplier_name, ' +
      '    sp.Trade_Price AS trade_price, ' +
      '    IFNULL(spp.fill_rate, 0) AS product_fill_rate, ' +
      '    IFNULL(sss.fill_rate, 0) AS overall_fill_rate ' +
      '  FROM ' + pricesTable + ' AS sp ' +
      '  LEFT JOIN ' + performanceTable + ' AS spp ' +
      '    ON spp.product_sku = sp.SKU AND spp.supplier_name = sp.Supplier_Name ' +
      '  LEFT JOIN ' + summaryTable + ' AS sss ' +
      '    ON sss.supplier_name = sp.Supplier_Name ' +
      '), ' +
      'normalized AS ( ' +
      '  SELECT ' +
      '    *, ' +
      '    MIN(trade_price) OVER (PARTITION BY sku) AS min_price, ' +
      '    MAX(trade_price) OVER (PARTITION BY sku) AS max_price ' +
      '  FROM joined ' +
      '), ' +
      'scored AS ( ' +
      '  SELECT ' +
      '    *, ' +
      '    CASE WHEN max_price = min_price THEN 0 ' +
      '         ELSE (trade_price - min_price) / (max_price - min_price) ' +
      '    END AS normalized_price ' +
      '  FROM normalized ' +
      '), ' +
      'ranked AS ( ' +
      '  SELECT ' +
      '    sku, product_name, supplier_id, supplier_name, trade_price, ' +
      '    product_fill_rate, overall_fill_rate, ' +
      '    ' + scoreExpr + ' AS score, ' +
      '    RANK() OVER (PARTITION BY sku ORDER BY ' + scoreExpr + ' DESC) AS supplier_rank ' +
      '  FROM scored ' +
      ') ' +
      'SELECT sku, product_name, supplier_id, supplier_name, trade_price, ' +
      '  product_fill_rate, overall_fill_rate, score, supplier_rank, ' +
      '  CURRENT_TIMESTAMP() AS snapshot_generated_at ' +
      'FROM ranked ' +
      'WHERE supplier_rank <= 3 '+
      'ORDER BY sku';

    BigQueryService.runQuery(sql);
    Utilities_.clearCache(['recommendations']);
  },

  /**
   * Groups flat (sku, supplier_rank) rows into one object per product, each
   * with its ordered list of top-3 suppliers.
   * @param {Array<Object>} rows
   * @return {Array<Object>}
   * @private
   */
  _groupByProduct: function (rows) {
    const productsBySku = {};
    const skuOrder = [];

    rows.forEach(function (r) {
      const sku = Utilities_.toSafeString(r.sku);
      if (!productsBySku[sku]) {
        productsBySku[sku] = {
          sku: sku,
          productName: Utilities_.toSafeString(r.product_name),
          suppliers: []
        };
        skuOrder.push(sku);
      }

      productsBySku[sku].suppliers.push({
        rank: Utilities_.toNumber(r.supplier_rank),
        supplierId: Utilities_.toSafeString(r.supplier_id),
        supplierName: Utilities_.toSafeString(r.supplier_name),
        productFillRate: Utilities_.toNumber(r.product_fill_rate),
        overallFillRate: Utilities_.toNumber(r.overall_fill_rate),
        tradePrice: Utilities_.toNumber(r.trade_price),
        score: Utilities_.toNumber(r.score)
      });
    });

    return skuOrder.map(function (sku) {
      return productsBySku[sku];
    });
  }
};
