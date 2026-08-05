/**
 * WeightedAvailabilityRecommendationService.gs
 * ---------------------------------------------------------------------------
 * Exact mirror of RecommendationService.gs for the "Weighted Availability"
 * tool - same materialized-table pattern, same scoring formula
 * (CONFIG.RECOMMENDATION_WEIGHTS), same rebuild-on-price-write trigger
 * (see SupplierPriceService.gs).
 *
 * The one real difference: supplier_prices is NOT duplicated per the
 * user's instruction - prices are shared between both tools. So this
 * join reaches across two datasets in one query: supplier_prices stays
 * qualified against the default dataset (CONFIG.TABLES.SUPPLIER_PRICES /
 * CONFIG.BQ_DATASET), while supplier_product_performance_nonuf and this
 * tool's own supplier_summary_snapshot are qualified against
 * CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY. BigQuery supports
 * cross-dataset joins within the same project natively - no special
 * handling needed beyond qualifying each table correctly.
 *
 * Writes to CONFIG.WA_TABLES.RECOMMENDATIONS (its own table, in the
 * weighted-availability dataset) - NOT the UF recommendations table, since
 * the underlying product fill rates differ even though prices don't.
 * ---------------------------------------------------------------------------
 */

const WeightedAvailabilityRecommendationService = {
  /**
   * @return {Object}
   */
  getRecommendations: function () {
    const cacheKey = 'wa_recommendations';
    const cached = Utilities_.getCache(cacheKey);
    if (cached) return cached;

    const table = Utilities_.qualifiedTable(CONFIG.WA_TABLES.RECOMMENDATIONS, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const sql =
      'SELECT sku, product_name, supplier_id, supplier_name, trade_price, ' +
      '  product_fill_rate, overall_fill_rate, score, supplier_rank, snapshot_generated_at ' +
      'FROM ' + table + ' ' +
      'ORDER BY sku ASC, supplier_rank ASC';

    const rows = BigQueryService.runQuery(sql);
    const products = WeightedAvailabilityRecommendationService._groupByProduct(rows);
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
   * Rebuilds the weighted-availability `recommendations` table from
   * scratch: joins the SHARED supplier_prices with this tool's own
   * supplier_product_performance_nonuf and supplier_summary_snapshot,
   * same scoring/ranking as RecommendationService.rebuildSnapshot().
   */
  rebuildSnapshot: function () {
    const pricesTable = Utilities_.qualifiedTable(CONFIG.TABLES.SUPPLIER_PRICES);
    const performanceTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_PRODUCT_PERFORMANCE, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const summaryTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.SUPPLIER_SUMMARY_SNAPSHOT, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const targetTable = Utilities_.qualifiedTable(CONFIG.WA_TABLES.RECOMMENDATIONS, CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY);
    const w = CONFIG.RECOMMENDATION_WEIGHTS;

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
    Utilities_.clearCache(['wa_recommendations']);
  },

  /**
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
