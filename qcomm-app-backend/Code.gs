// /**
//  * Code.gs
//  * ---------------------------------------------------------------------------
//  * Main entry point for the Supplier Performance Dashboard web app.
//  * Contains global configuration, the doGet() router, and the public
//  * API endpoints that the client-side JavaScript calls via
//  * google.script.run.
//  *
//  * All other .gs files depend on the CONFIG object defined here.
//  * ---------------------------------------------------------------------------
//  */

// /**
//  * ============================================================
//  * GLOBAL CONFIGURATION
//  * ============================================================
//  * Update these values for your environment. See SETUP_INSTRUCTIONS.md
//  * for full details on each setting.
//  */
// const CONFIG = {
//   // Your Google Cloud project that has BigQuery enabled and billing set up.
//   BQ_PROJECT_ID: 'dhub-glovo',

//   // The BigQuery dataset that contains all four tables below.
//   BQ_DATASET: 'availability_and_ultrafresh',

//   // Second dataset, same project, that the MFC Nigeria sales/orders
//   // reporting tables live in. Passed explicitly to Utilities_.qualifiedTable()
//   // wherever it's needed (see MfcAnalyticsService.gs) since CONFIG.BQ_DATASET
//   // above stays the default for every pre-existing call site.
//   BQ_DATASET_MFC: 'mfcnigeria_analytics',

//   // Table names. Change these if your tables are named differently.
//   TABLES: {
//     AVAILABILITY_SUMMARY: 'availability_summary',
//     SUPPLIER_PRODUCT_PERFORMANCE: 'supplier_product_performance',
//     SUPPLIER_SUMMARY_SNAPSHOT: 'supplier_summary_snapshot',
//     DASHBOARD_SNAPSHOT: 'dashboard_snapshot',
//     PRODUCTS_AVAILABILITY_LOSS: 'products_availability_loss',
//     SUPPLIER_MONTHLY_METRICS: 'supplier_monthly_metrics',
//     SUPPLIER_WEEKLY_METRICS: 'supplier_weekly_metrics',
//     SUPPLIER_PRODUCT_PERFORMANCE_WEEK: 'supplier_product_performance_week',
//     SUPPLIER_PRICES: 'supplier_prices',
//     RECOMMENDATIONS: 'recommendations',

//     // "Are we ordering enough?" purchase-order vs demand/stock table.
//     // FORECASTING_PRODUCTS is the raw source table; FORECASTING_PRODUCTS_SNAPSHOT
//     // is what every GET endpoint actually reads from (see below), rebuilt
//     // daily by SnapshotService like everything else.
//     FORECASTING_PRODUCTS: 'forecasting_products',

//     // Snapshot tables (rebuilt daily at 8am by SnapshotService — all
//     // GET endpoints read from these, NOT from source tables)
//     AVAILABILITY_TREND_SNAPSHOT: 'availability_trend_snapshot',
//     DASHBOARD_TOP_SUPPLIERS_SNAPSHOT: 'dashboard_top_suppliers_snapshot',
//     DASHBOARD_TOP_SUPPLIERS_WEEKLY_SNAPSHOT: 'dashboard_top_suppliers_weekly_snapshot',
//     DASHBOARD_BOTTOM_SUPPLIERS_SNAPSHOT: 'dashboard_bottom_suppliers_snapshot',
//     DASHBOARD_PRODUCT_LOSS_SNAPSHOT: 'dashboard_product_loss_snapshot',
//     DASHBOARD_WEEKLY_SNAPSHOT: 'dashboard_weekly_snapshot',
//     SUPPLIER_MONTHLY_METRICS_SNAPSHOT: 'supplier_monthly_metrics_snapshot',
//     SUPPLIER_WEEKLY_METRICS_SNAPSHOT: 'supplier_weekly_metrics_snapshot',
//     SUPPLIER_LIST_SNAPSHOT: 'supplier_list_snapshot',
//     PRODUCTS_FOR_SUPPLIER_SNAPSHOT: 'products_for_supplier_snapshot',
//     SUPPLIER_PRICES_SNAPSHOT: 'supplier_prices_snapshot',
//     FORECASTING_PRODUCTS_SNAPSHOT: 'forecasting_products_snapshot'
//   },

//   // Table names inside BQ_DATASET_MFC (mfcnigeria_analytics). Kept as a
//   // separate map, mirroring TABLES above, so the two datasets' table
//   // lists never get mixed up at a call site. Each source table has a
//   // matching _SNAPSHOT table (rebuilt into the same dataset by
//   // SnapshotService) that every GET endpoint actually reads from.
//   MFC_TABLES: {
//     CATEGORY_SALES_REPORT: 'mfc_category_sales_report',
//     PRODUCT_SALES_REPORT: 'mfc_product_sales_report',
//     ORDERS: 'orders',
//     PRODUCT_THRESHOLD_REPORT: 'mfc_product_threshold_report',

//     CATEGORY_SALES_REPORT_SNAPSHOT: 'mfc_category_sales_report_snapshot',
//     PRODUCT_SALES_REPORT_SNAPSHOT: 'mfc_product_sales_report_snapshot',
//     ORDERS_SNAPSHOT: 'orders_snapshot',
//     PRODUCT_THRESHOLD_REPORT_SNAPSHOT: 'mfc_product_threshold_report_snapshot'
//   },

//   // Third dataset, same project (dhub-glovo), that the Price Guard
//   // pricing-intelligence app's tables live in. Passed explicitly to
//   // Utilities_.qualifiedTable() wherever needed (see PriceGuard*.gs
//   // services) since CONFIG.BQ_DATASET stays the default everywhere else.
//   BQ_DATASET_PRICE_GUARD: 'price_guard',

//   // Table names inside BQ_DATASET_PRICE_GUARD. Mirrors MFC_TABLES' shape:
//   // externally-managed source tables the Price Guard Apps Script project
//   // never wrote to, GAS-owned tables it already read/wrote directly
//   // (these are themselves precomputed daily snapshots in the original
//   // app - computed_daily_metrics carries its own snapshot_date column,
//   // so we keep reading/writing them under their original names rather
//   // than forcing a "_snapshot" rename), and brand-new "_snapshot" tables
//   // added here for the two read paths that used to hit a source/live
//   // table directly on every request (see PriceGuardSnapshotService.gs).
//   PG_TABLES: {
//     // Externally managed source tables (never written by this backend).
//     // DASHBOARD_TABLE is the single source of truth an external job
//     // already joins internal_products with all four competitor feeds
//     // into; COMPETITOR_TABLE_MATCHES is the Python matching engine's
//     // output table.
//     DASHBOARD_TABLE: 'dashboard_table',
//     COMPETITOR_TABLE_MATCHES: 'competitor_table_matches',

//     // GAS-owned tables (this backend creates + writes these - see
//     // PriceGuardSchemaService.gs). Already snapshot-shaped in the
//     // original app (computed_daily_metrics/daily_alerts carry a
//     // snapshot_date column and are only ever queried filtered to
//     // MAX(snapshot_date)), so GET endpoints read these directly,
//     // exactly like the original.
//     COMPUTED_DAILY_METRICS: 'computed_daily_metrics',
//     DAILY_ALERTS: 'daily_alerts',
//     PRODUCT_MATCHES: 'product_matches',
//     PRICE_RECOMMENDATIONS: 'price_recommendations',

//     // New snapshot tables (rebuilt daily by PriceGuardSnapshotService,
//     // and immediately on every write for the recommendations ones -
//     // same pattern as supplier_prices_snapshot). Added so
//     // getMatches/getPricingRecommendations/getRecommendationHistory
//     // stop querying competitor_table_matches / price_recommendations
//     // live on every request, per the cost/latency goals of this
//     // migration.
//     MATCHES_SNAPSHOT: 'matches_snapshot',
//     PRICE_RECOMMENDATIONS_PENDING_SNAPSHOT: 'price_recommendations_pending_snapshot',
//     PRICE_RECOMMENDATIONS_HISTORY_SNAPSHOT: 'price_recommendations_history_snapshot'
//   },

//   // Cache duration (seconds) for the Price Guard recommendations reads.
//   // Short, like SUPPLIER_PRICES_CACHE_TTL_SECONDS, since the queue is
//   // actively worked from the Pricing Actions page.
//   PRICE_GUARD_RECOMMENDATIONS_CACHE_TTL_SECONDS: 60,

//   // BigQuery location (region) that hosts the dataset, e.g. 'US', 'EU'.
//   BQ_LOCATION: 'US',

//   // How many rows to request per BigQuery page. 10,000 is generally safe.
//   BQ_MAX_RESULTS: 10000,

//   // How many seconds to wait between BigQuery job polling attempts.
//   BQ_POLL_INTERVAL_MS: 500,

//   // Maximum time (ms) to wait for a BigQuery job to finish before giving up.
//   BQ_JOB_TIMEOUT_MS: 60000,

//   // Cache duration (seconds) for dashboard/supplier snapshot reads.
//   // Keeps repeat page loads fast without re-querying BigQuery every time.
//   CACHE_TTL_SECONDS: 300,

//   // Cache duration (seconds) for the raw supplier_prices read. Shorter than
//   // CACHE_TTL_SECONDS since prices are actively maintained by users from
//   // the Recommendations page and should feel responsive after an edit.
//   SUPPLIER_PRICES_CACHE_TTL_SECONDS: 60,

//   // Weights used by RecommendationService to blend each supplier's
//   // product-level fill rate, overall fill rate, and normalized price into
//   // a single recommendation score. Must sum to 1 for the score to stay
//   // within a 0-1 range.
//   RECOMMENDATION_WEIGHTS: {
//     productFillRate: 0.5,
//     overallFillRate: 0.2,
//     priceScore: 0.3
//   }
// };

// /**
//  * ============================================================
//  * WEB APP ROUTING (REST / JSON)
//  * ============================================================
//  * The app was converted from an HtmlService UI into a JSON REST API
//  * consumed by an external React + Electron client. Every request -
//  * GET or POST - carries an `action` parameter whose value is the name
//  * of one of the API_ROUTES entries below (deliberately the same name
//  * as the existing api_* function, so there is a 1:1, easy-to-trace
//  * mapping and no separate route table to keep in sync).
//  *
//  * GET  ?action=getDashboardData
//  * POST body: { "action": "addOrUpdatePrice", "params": { ... } }
//  *
//  * All business logic is unchanged - this section only decides which
//  * existing api_* function to call and how to serialize the result.
//  */

// /**
//  * Maps a public action name to the existing api_* function. Kept as a
//  * single lookup table so adding a new endpoint later means adding one
//  * line here (and the api_* function itself), nothing else.
//  */
// const API_ROUTES = {
//   getDashboardData: api_getDashboardData,
//   getSupplierSummary: api_getSupplierSummary,
//   getSupplierList: api_getSupplierList,
//   getProductsForSupplier: api_getProductsForSupplier,
//   getAllPrices: api_getAllPrices,
//   addOrUpdatePrice: api_addOrUpdatePrice,
//   deletePrice: api_deletePrice,
//   getRecommendations: api_getRecommendations,
//   runSnapshotNow: api_runSnapshotNow,

//   // "Are we ordering enough?" (forecasting_products)
//   getForecastingProducts: api_getForecastingProducts,
//   getForecastingFilterOptions: api_getForecastingFilterOptions,

//   // MFC Nigeria sales/orders reporting
//   getMfcCategorySalesReport: api_getMfcCategorySalesReport,
//   getMfcProductSalesReport: api_getMfcProductSalesReport,
//   getMfcOrders: api_getMfcOrders,
//   getMfcProductThresholdReport: api_getMfcProductThresholdReport,
//   getUserInfo: api_getUserInfo,

//   // Price Guard - competitive pricing intelligence (migrated from the
//   // standalone Price Guard Apps Script project; see PriceGuard*.gs)
//   getPriceGuardDashboardData: api_getPriceGuardDashboardData,
//   getPriceGuardDashboardSummary: api_getPriceGuardDashboardSummary,
//   getPriceGuardProducts: api_getPriceGuardProducts,
//   getPriceGuardCategoryHealth: api_getPriceGuardCategoryHealth,
//   getPriceGuardSupplierHealth: api_getPriceGuardSupplierHealth,
//   getPriceGuardAlerts: api_getPriceGuardAlerts,
//   getPriceGuardMatches: api_getPriceGuardMatches,
//   approvePriceGuardMatch: api_approvePriceGuardMatch,
//   savePriceGuardManualOverride: api_savePriceGuardManualOverride,
//   triggerPriceGuardRematch: api_triggerPriceGuardRematch,
//   getPriceGuardSettings: api_getPriceGuardSettings,
//   savePriceGuardSettings: api_savePriceGuardSettings,
//   getPriceGuardPendingRecommendations: api_getPriceGuardPendingRecommendations,
//   getPriceGuardRecommendationHistory: api_getPriceGuardRecommendationHistory,
//   getPriceGuardProductMetrics: api_getPriceGuardProductMetrics,
//   submitPriceGuardRecommendation: api_submitPriceGuardRecommendation,
//   approvePriceGuardRecommendation: api_approvePriceGuardRecommendation,
//   approvePriceGuardRecommendations: api_approvePriceGuardRecommendations,
//   rejectPriceGuardRecommendation: api_rejectPriceGuardRecommendation,
//   runPriceGuardDailySync: api_runPriceGuardDailySync,
//   getPriceGuardPipelineStatus: api_getPriceGuardPipelineStatus,
//   runPriceGuardSnapshotNow: api_runPriceGuardSnapshotNow
// };

// /**
//  * Handles all GET requests. Reads `action` from the query string and,
//  * for endpoints that take simple scalar args (e.g. supplierName, sku),
//  * also reads those directly from the query string.
//  * @param {Object} e Apps Script event object.
//  * @return {TextOutput} JSON response.
//  */
// function doGet(e) {
//   return handleApiRequest_(e, false);
// }

// function api_getUserInfo(){
//   return {email: Session.getActiveUser().getEmail()}
// }

// /**
//  * Handles all POST requests. Reads `action` and a `params` object from
//  * the JSON request body (falls back to query string `action` if the
//  * body isn't present/parseable, so simple POSTs still route correctly).
//  * @param {Object} e Apps Script event object.
//  * @return {TextOutput} JSON response.
//  */
// function doPost(e) {
//   return handleApiRequest_(e, true);
// }

// /**
//  * Shared dispatcher for doGet/doPost: resolves the action, gathers its
//  * arguments, invokes the matching api_* function, and always returns
//  * JSON - including for routing errors (unknown action, bad JSON body)
//  * - so the client never has to branch on response type.
//  * @param {Object} e Apps Script event object.
//  * @param {boolean} isPost Whether this came from doPost (reads params from the JSON body) or doGet (reads params from the query string).
//  * @return {TextOutput}
//  * @private
//  */
// function handleApiRequest_(e, isPost) {
//   try {
//     const params = e && e.parameter ? e.parameter : {};
//     let action = params.action;
//     let body = {};

//     if (isPost && e && e.postData && e.postData.contents) {
//       try {
//         body = JSON.parse(e.postData.contents);
//       } catch (parseErr) {
//         return jsonResponse_(Utilities_.buildErrorResponse(parseErr, 'handleApiRequest_'));
//       }
//       action = body.action || action;
//     }

//     const fn = action ? API_ROUTES[action] : null;
//     if (!fn) {
//       return jsonResponse_({
//         error: true,
//         message: 'Unknown or missing action.',
//         context: 'handleApiRequest_',
//         detail: 'action=' + action
//       });
//     }

//     const args = resolveActionArgs_(action, params, body.params || {});
//     const result = fn.apply(null, args);
//     return jsonResponse_(result);
//   } catch (err) {
//     return jsonResponse_(Utilities_.buildErrorResponse(err, 'handleApiRequest_'));
//   }
// }

// /**
//  * Positional-argument lookup for the handful of endpoints that take
//  * scalar params, so callers can pass them either as query-string values
//  * (GET) or inside the `params` object (POST) without each api_*
//  * function needing to know which.
//  * @param {string} action
//  * @param {Object} queryParams e.parameter from the request.
//  * @param {Object} bodyParams The `params` object from a JSON POST body, if any.
//  * @return {Array} Arguments to apply to the routed function, in order.
//  * @private
//  */
// function resolveActionArgs_(action, queryParams, bodyParams) {
//   const p = function (key) {
//     return bodyParams[key] !== undefined ? bodyParams[key] : queryParams[key];
//   };

//   switch (action) {
//     case 'getProductsForSupplier':
//       return [p('supplierName')];
//     case 'addOrUpdatePrice':
//       // api_addOrUpdatePrice takes a single priceData object.
//       return [Object.keys(bodyParams).length ? bodyParams : queryParams];
//     case 'deletePrice':
//       return [p('sku'), p('supplierId')];
//     case 'getForecastingProducts':
//     case 'getMfcCategorySalesReport':
//     case 'getMfcProductSalesReport':
//     case 'getMfcProductThresholdReport':
//     case 'getPriceGuardProducts':
//     case 'getPriceGuardAlerts':
//     case 'getPriceGuardMatches':
//       // Filter object: GET reads it from the query string (e.g.
//       // ?warehouse=Lagos&search=oil), POST reads it from the JSON body's
//       // `params`, same convention as addOrUpdatePrice above.
//       return [Object.keys(bodyParams).length ? bodyParams : queryParams];
//     case 'approvePriceGuardMatch':
//       return [p('sku'), p('competitor')];
//     case 'savePriceGuardManualOverride':
//       return [p('sku'), p('competitor'), p('name'), p('price'), p('explanation')];
//     case 'triggerPriceGuardRematch':
//     case 'getPriceGuardProductMetrics':
//       return [p('sku')];
//     case 'approvePriceGuardRecommendation':
//     case 'rejectPriceGuardRecommendation':
//       return [p('id')];
//     case 'savePriceGuardSettings':
//       // api_savePriceGuardSettings takes a single settings object.
//       return [Object.keys(bodyParams).length ? bodyParams : queryParams];
//     case 'submitPriceGuardRecommendation':
//       // api_submitPriceGuardRecommendation takes a single recommendation object.
//       return [Object.keys(bodyParams).length ? bodyParams : queryParams];
//     case 'approvePriceGuardRecommendations':
//       // api_approvePriceGuardRecommendations takes an array of ids, sent
//       // as params.ids from a POST body (GET has no natural array syntax
//       // here, so this one is POST-only in practice).
//       return [bodyParams.ids || queryParams.ids || []];
//     default:
//       return [];
//   }
// }

// /**
//  * Serializes a plain object as a JSON TextOutput response.
//  * @param {Object} obj
//  * @return {TextOutput}
//  * @private
//  */
// function jsonResponse_(obj) {
//   return ContentService
//     .createTextOutput(JSON.stringify(obj))
//     .setMimeType(ContentService.MimeType.JSON);
// }

// /**
//  * ============================================================
//  * PUBLIC API ENDPOINTS
//  * ============================================================
//  * These are the only functions the client-side JavaScript should call
//  * via google.script.run. Each one returns a plain JS object (never a
//  * BigQuery-specific type) so it can be safely serialized to the client.
//  *
//  * Every endpoint follows the same defensive pattern:
//  *   try { ...load data... } catch (err) { return { error: ... } }
//  * so the frontend can always check `response.error` first.
//  */

// /**
//  * Returns all data needed to render the Dashboard page.
//  * @return {Object}
//  */
// function api_getDashboardData() {
//   try {
//     Logger.log("Hey");
//     return DashboardService.getDashboardData();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getDashboardData');
//   }
// }

// function testDashboard() {
//   const result = DashboardService.getDashboardData();
//   Logger.log(JSON.stringify(result.topSuppliersByQuantity, null, 2));
// }

// /**
//  * Returns the full supplier summary table (from supplier_summary_snapshot).
//  * @return {Object}
//  */
// function api_getSupplierSummary() {
//   try {
//     return SupplierService.getSupplierSummary();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getSupplierSummary');
//   }
// }

// /**
//  * Returns the distinct list of supplier names for the Products page dropdown.
//  * @return {Object}
//  */
// function api_getSupplierList() {
//   try {
//     return ProductService.getSupplierList();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getSupplierList');
//   }
// }

// /**
//  * Returns product-level performance data for a single supplier.
//  * @param {string} supplierName
//  * @return {Object}
//  */
// function api_getProductsForSupplier(supplierName) {
//   try {
//     return ProductService.getProductsForSupplier(supplierName);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getProductsForSupplier');
//   }
// }

// /**
//  * Manually triggers the daily snapshot process. Exposed so an admin
//  * can force a refresh from the UI (optional) or for testing in the
//  * Apps Script editor.
//  * @return {Object}
//  */
// function api_runSnapshotNow() {
//   try {
//     SnapshotService.runDailySnapshot();
//     return { success: true };
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_runSnapshotNow');
//   }
// }

// /**
//  * Returns every row of supplier_prices, used by the Recommendations
//  * page's "Update Prices" modal to list and manage supplier prices.
//  * @return {Object}
//  */
// function api_getAllPrices() {
//   try {
//     return SupplierPriceService.getAllPrices();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getAllPrices');
//   }
// }

// /**
//  * Inserts a new supplier price, or updates Product_Name / Trade_Price for
//  * an existing (SKU, Supplier_ID) pair.
//  * @param {Object} priceData {sku, productName, supplierId, supplierName, tradePrice}
//  * @return {Object}
//  */
// function api_addOrUpdatePrice(priceData) {
//   try {
//     return SupplierPriceService.addOrUpdatePrice(priceData);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_addOrUpdatePrice');
//   }
// }

// /**
//  * Deletes a supplier price by its (SKU, Supplier_ID) key.
//  * @param {string} sku
//  * @param {string} supplierId
//  * @return {Object}
//  */
// function api_deletePrice(sku, supplierId) {
//   try {
//     return SupplierPriceService.deletePrice(sku, supplierId);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_deletePrice');
//   }
// }

// /**
//  * Returns the top 3 recommended suppliers per product, blending product
//  * fill rate, overall supplier fill rate, and normalized trade price.
//  * @return {Object}
//  */
// function api_getRecommendations() {
//   try {
//     return RecommendationService.getRecommendations();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getRecommendations');
//   }
// }

// /**
//  * Returns forecasting_products rows ("Are we ordering enough?"), optionally
//  * filtered by warehouse, category, SKU, and/or free-text search.
//  * @param {Object} filters {warehouse, category, sku, search}
//  * @return {Object}
//  */
// function api_getForecastingProducts(filters) {
//   try {
//     return ForecastingService.getForecastingProducts(filters);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getForecastingProducts');
//   }
// }

// /**
//  * Returns the distinct warehouse and category lists for the Forecasting
//  * page's filter dropdowns.
//  * @return {Object}
//  */
// function api_getForecastingFilterOptions() {
//   try {
//     return ForecastingService.getFilterOptions();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getForecastingFilterOptions');
//   }
// }

// /**
//  * Returns mfc_category_sales_report rows, optionally filtered by category
//  * and/or free-text search.
//  * @param {Object} filters {category, search}
//  * @return {Object}
//  */
// function api_getMfcCategorySalesReport(filters) {
//   try {
//     return MfcAnalyticsService.getCategorySalesReport(filters);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getMfcCategorySalesReport');
//   }
// }

// /**
//  * Returns mfc_product_sales_report rows, optionally filtered by category,
//  * SKU, and/or free-text search.
//  * @param {Object} filters {category, sku, search}
//  * @return {Object}
//  */
// function api_getMfcProductSalesReport(filters) {
//   try {
//     return MfcAnalyticsService.getProductSalesReport(filters);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getMfcProductSalesReport');
//   }
// }

// /**
//  * Returns the single-row orders summary table (yesterday / week / MTD
//  * figures, overall and split by LOSF1 / MNLF1).
//  * @return {Object}
//  */
// function api_getMfcOrders() {
//   try {
//     return MfcAnalyticsService.getOrders();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getMfcOrders');
//   }
// }

// /**
//  * Returns mfc_product_threshold_report rows, optionally filtered by
//  * category, SKU, and/or free-text search.
//  * @param {Object} filters {category, sku, search}
//  * @return {Object}
//  */
// function api_getMfcProductThresholdReport(filters) {
//   try {
//     return MfcAnalyticsService.getProductThresholdReport(filters);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getMfcProductThresholdReport');
//   }
// }

// /**
//  * ============================================================
//  * PRICE GUARD API ENDPOINTS
//  * ============================================================
//  * Migrated from the standalone Price Guard Apps Script project. Every
//  * RPC function that project's UI called (google.script.run.X) has a
//  * 1:1 api_* counterpart here, wired into API_ROUTES above under a
//  * "PriceGuard"-qualified action name so it can't collide with the
//  * pre-existing supplier/MFC endpoints. Business logic itself lives in
//  * the PriceGuard*.gs service files; these wrappers only route + catch,
//  * exactly like every other api_* function in this file.
//  */

// /**
//  * Returns everything the Price Guard dashboard page needs in one call:
//  * summary cards, full product list, supplier/category health, alerts,
//  * matches, and pending recommendations. Mirrors the original
//  * getCompositeDashboardData() RPC, but every piece now comes from
//  * precomputed snapshot tables instead of a live dashboard_table query.
//  * @return {Object}
//  */
// function api_getPriceGuardDashboardData() {
//   try {
//     return PriceGuardService.getCompositeDashboardData();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardDashboardData');
//   }
// }

// /**
//  * Returns just the Price Guard dashboard summary cards (revenue, gross
//  * profit, margin, revenue at risk, margin leakage, opportunity value,
//  * alert counts by severity).
//  * @return {Object}
//  */
// function api_getPriceGuardDashboardSummary() {
//   try {
//     return PriceGuardService.getDashboardSummary();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardDashboardSummary');
//   }
// }

// /**
//  * Returns the full Price Guard product catalog with computed metrics,
//  * optionally filtered. @param {Object} filters {category, supplierName, search}
//  * @return {Object}
//  */
// function api_getPriceGuardProducts(filters) {
//   try {
//     return PriceGuardService.getProducts(filters);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardProducts');
//   }
// }

// /**
//  * Returns category-level health scorecards computed from the latest
//  * product metrics snapshot.
//  * @return {Object}
//  */
// function api_getPriceGuardCategoryHealth() {
//   try {
//     return PriceGuardService.getCategoryHealth();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardCategoryHealth');
//   }
// }

// /**
//  * Returns supplier-level health scorecards computed from the latest
//  * product metrics snapshot.
//  * @return {Object}
//  */
// function api_getPriceGuardSupplierHealth() {
//   try {
//     return PriceGuardService.getSupplierHealth();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardSupplierHealth');
//   }
// }

// /**
//  * Returns the latest precomputed pricing anomaly alerts, optionally
//  * filtered. @param {Object} filters {severity, alertType, search}
//  * @return {Object}
//  */
// function api_getPriceGuardAlerts(filters) {
//   try {
//     return PriceGuardAnomalyService.getLatestAlerts(filters);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardAlerts');
//   }
// }

// /**
//  * Returns the competitor match queue from matches_snapshot (a daily
//  * copy of the Python matching engine's competitor_table_matches
//  * output), optionally filtered.
//  * @param {Object} filters {sku, competitor, isApproved}
//  * @return {Object}
//  */
// function api_getPriceGuardMatches(filters) {
//   try {
//     return PriceGuardMatchingService.getMatches(filters);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardMatches');
//   }
// }

// /**
//  * Approves a candidate competitor match (writes to product_matches,
//  * the manual override/approval store - NOT matches_snapshot; see the
//  * "Not yet decided" note in README about this pre-existing gap).
//  * @param {string} sku
//  * @param {string} competitor
//  * @return {Object}
//  */
// function api_approvePriceGuardMatch(sku, competitor) {
//   try {
//     return PriceGuardMatchingService.approveMatch(sku, competitor);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_approvePriceGuardMatch');
//   }
// }

// /**
//  * Manually forces/creates a product match (product_matches table).
//  * @param {string} sku
//  * @param {string} competitor
//  * @param {string} name Competitor product name.
//  * @param {number} price
//  * @param {string} explanation
//  * @return {Object}
//  */
// function api_savePriceGuardManualOverride(sku, competitor, name, price, explanation) {
//   try {
//     return PriceGuardMatchingService.saveManualOverride(sku, competitor, name, price, explanation);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_savePriceGuardManualOverride');
//   }
// }

// /**
//  * Flags a product for rematching and dispatches the GitHub Actions
//  * rematch workflow, if configured.
//  * @param {string} sku
//  * @return {Object}
//  */
// function api_triggerPriceGuardRematch(sku) {
//   try {
//     return PriceGuardMatchingService.triggerRematch(sku);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_triggerPriceGuardRematch');
//   }
// }

// /**
//  * Returns the current Price Guard alert thresholds, notification, and
//  * integration settings (Script Properties-backed, deep-merged with
//  * defaults - unchanged from the original SettingsService).
//  * @return {Object}
//  */
// function api_getPriceGuardSettings() {
//   try {
//     return PriceGuardSettingsService.getSettings();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardSettings');
//   }
// }

// /**
//  * Saves the Price Guard settings object.
//  * @param {Object} settings
//  * @return {Object}
//  */
// function api_savePriceGuardSettings(settings) {
//   try {
//     return PriceGuardSettingsService.saveSettings(settings);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_savePriceGuardSettings');
//   }
// }

// /**
//  * Returns pending price recommendations from
//  * price_recommendations_pending_snapshot.
//  * @return {Object}
//  */
// function api_getPriceGuardPendingRecommendations() {
//   try {
//     return PriceGuardPricingActionService.getRecommendations();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardPendingRecommendations');
//   }
// }

// /**
//  * Returns approved/rejected recommendation history from
//  * price_recommendations_history_snapshot.
//  * @return {Object}
//  */
// function api_getPriceGuardRecommendationHistory() {
//   try {
//     return PriceGuardPricingActionService.getRecommendationHistory();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardRecommendationHistory');
//   }
// }

// /**
//  * Returns the precomputed metrics for a single SKU, used to
//  * auto-populate the "New Recommendation" form.
//  * @param {string} sku
//  * @return {Object}
//  */
// function api_getPriceGuardProductMetrics(sku) {
//   try {
//     return PriceGuardPricingActionService.getProductMetrics(sku);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardProductMetrics');
//   }
// }

// /**
//  * Submits a new pricing recommendation (status = Pending).
//  * @param {Object} data
//  * @return {Object}
//  */
// function api_submitPriceGuardRecommendation(data) {
//   try {
//     return PriceGuardPricingActionService.submitRecommendation(data);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_submitPriceGuardRecommendation');
//   }
// }

// /**
//  * Approves a single pending recommendation by ID.
//  * @param {string} id
//  * @return {Object}
//  */
// function api_approvePriceGuardRecommendation(id) {
//   try {
//     return PriceGuardPricingActionService.approveRecommendation(id);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_approvePriceGuardRecommendation');
//   }
// }

// /**
//  * Approves multiple pending recommendations by ID.
//  * @param {Array<string>} ids
//  * @return {Object}
//  */
// function api_approvePriceGuardRecommendations(ids) {
//   try {
//     return PriceGuardPricingActionService.approveRecommendations(ids);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_approvePriceGuardRecommendations');
//   }
// }

// /**
//  * Rejects a single pending recommendation by ID.
//  * @param {string} id
//  * @return {Object}
//  */
// function api_rejectPriceGuardRecommendation(id) {
//   try {
//     return PriceGuardPricingActionService.rejectRecommendation(id);
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_rejectPriceGuardRecommendation');
//   }
// }

// /**
//  * Runs the full Price Guard daily pipeline on demand (schema bootstrap,
//  * metrics + alerts computation and persistence, matches/recommendations
//  * snapshot rebuilds, scraper dispatch, and the email digest) - the same
//  * pipeline the 8am WAT trigger runs. Mirrors the original
//  * runDailySyncJob() RPC.
//  * @return {Object}
//  */
// function api_runPriceGuardDailySync() {
//   try {
//     var report = PriceGuardSnapshotService.runDailyPipeline();
//     return {
//       success: report.overall_success,
//       report: report,
//       timestamp: new Date().toISOString()
//     };
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_runPriceGuardDailySync');
//   }
// }

// /**
//  * Returns Price Guard pipeline run status/last-run metadata, mirroring
//  * the original getPipelineStatus() RPC.
//  * @return {Object}
//  */
// function api_getPriceGuardPipelineStatus() {
//   try {
//     return PriceGuardSnapshotService.getPipelineStatus();
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_getPriceGuardPipelineStatus');
//   }
// }

// /**
//  * Manually triggers just the Price Guard snapshot rebuilds (matches,
//  * recommendations pending/history) without running the full pipeline
//  * (schema bootstrap, scraper dispatch, email digest). Exposed for
//  * quick "refresh reads" use from the dashboard, parallel to the
//  * existing runSnapshotNow for the supplier dashboard.
//  * @return {Object}
//  */
// function api_runPriceGuardSnapshotNow() {
//   try {
//     PriceGuardSnapshotService.rebuildReadSnapshots();
//     return { success: true };
//   } catch (err) {
//     return Utilities_.buildErrorResponse(err, 'api_runPriceGuardSnapshotNow');
//   }
// }

// /**
//  * ============================================================
//  * TIME-DRIVEN TRIGGER TARGET
//  * ============================================================
//  * This is the function you point a daily time-driven trigger at.
//  * See SETUP_INSTRUCTIONS.md for how to install the trigger.
//  */
// function dailySnapshotTrigger() {
//   SnapshotService.runDailySnapshot();
// }

// /**
//  * Time-driven trigger target for the Price Guard pipeline, kept
//  * separate from dailySnapshotTrigger() above since it's a different
//  * multi-step orchestration (schema bootstrap, metrics/alerts
//  * computation, scraper dispatch, email digest) on its own schedule -
//  * install a second daily trigger pointed at this function for 8am WAT,
//  * matching the original Price Guard project's schedule.
//  */
// function priceGuardDailyPipelineTrigger() {
//   var report = PriceGuardSnapshotService.runDailyPipeline();
//   var props = PropertiesService.getScriptProperties();
//   props.setProperty('PRICE_GUARD_LAST_PIPELINE_RUN', new Date().toISOString());
//   props.setProperty('PRICE_GUARD_LAST_PIPELINE_STATUS', report.overall_success ? 'SUCCESS' : 'PARTIAL_FAILURE');
// }

// /**
//  * ============================================================
//  * PRICE GUARD: COMPUTE SUMMARY/HEALTH FROM PRODUCT ARRAY
//  * (Avoids re-querying BigQuery when we already have the data)
//  * ============================================================
//  * Ported byte-for-byte from the original Price Guard Code.gs. Kept as
//  * plain top-level functions (not inside a service object) to match
//  * exactly where this logic lived in the source project; PriceGuardService
//  * calls these directly on the array it reads from computed_daily_metrics_
//  * (via PriceGuardMetricSnapshotService.getLatestMetricsSnapshot()).
//  */

// /**
//  * Compute Price Guard dashboard summary cards from a pre-fetched
//  * product metrics array.
//  * @param {Array<Object>} data
//  * @return {Object}
//  */
// function computePriceGuardSummaryFromProducts(data) {
//   var totalRevenue = 0;
//   var totalCost = 0;
//   var revenueAtRisk = 0;
//   var marginLeakage = 0;
//   var opportunityTotal = 0;

//   var greenCount = 0;
//   var yellowCount = 0;
//   var orangeCount = 0;
//   var redCount = 0;

//   data.forEach(function (p) {
//     totalRevenue += (parseFloat(p.revenue_latest) || 0);
//     totalCost += ((parseFloat(p.cost_price_today) || 0) * (parseFloat(p.quantity_sold_latest) || 0));
//     revenueAtRisk += (parseFloat(p.revenue_at_risk) || 0);
//     marginLeakage += (parseFloat(p.margin_leakage) || 0);

//     if ((parseFloat(p.opportunity_score) || 0) > 50) {
//       opportunityTotal += ((parseFloat(p.market_median_price) || 0) - (parseFloat(p.selling_price_today) || 0)) * (parseFloat(p.quantity_sold_latest) || 0);
//     }

//     var rs = parseFloat(p.risk_score) || 0;
//     if (rs <= 30) greenCount++;
//     else if (rs <= 60) yellowCount++;
//     else if (rs <= 80) orangeCount++;
//     else redCount++;
//   });

//   var grossProfit = totalRevenue - totalCost;

//   // avg_margin_* fields are dashboard-wide rollups broadcast onto every
//   // product row by the upstream dashboard_table join (not a per-product
//   // value), so - same as the old avg_margin_latest field this replaced -
//   // they're read once from the first row rather than averaged/summed
//   // across all products.
//   var first = data.length > 0 ? data[0] : {};
//   var overallMargin = parseFloat(first.avg_margin_this_month) || 0;

//   return {
//     total_revenue: totalRevenue,
//     gross_profit: grossProfit,
//     overall_margin: overallMargin,
//     revenue_at_risk: revenueAtRisk,
//     margin_leakage: marginLeakage,
//     opportunity_value: Math.max(0, opportunityTotal),
//     avg_margin_this_month: parseFloat(first.avg_margin_this_month) || 0,
//     avg_margin_last_month: parseFloat(first.avg_margin_last_month) || 0,
//     avg_margin_this_week: parseFloat(first.avg_margin_this_week) || 0,
//     avg_margin_last_week: parseFloat(first.avg_margin_last_week) || 0,
//     avg_margin_this_month_losf1: parseFloat(first.avg_margin_this_month_losf1) || 0,
//     avg_margin_last_month_losf1: parseFloat(first.avg_margin_last_month_losf1) || 0,
//     avg_margin_this_week_losf1: parseFloat(first.avg_margin_this_week_losf1) || 0,
//     avg_margin_last_week_losf1: parseFloat(first.avg_margin_last_week_losf1) || 0,
//     avg_margin_this_month_mnlf1: parseFloat(first.avg_margin_this_month_mnlf1) || 0,
//     avg_margin_last_month_mnlf1: parseFloat(first.avg_margin_last_month_mnlf1) || 0,
//     avg_margin_this_week_mnlf1: parseFloat(first.avg_margin_this_week_mnlf1) || 0,
//     avg_margin_last_week_mnlf1: parseFloat(first.avg_margin_last_week_mnlf1) || 0,
//     alerts: {
//       green: greenCount,
//       yellow: yellowCount,
//       orange: orangeCount,
//       red: redCount,
//       critical: redCount + orangeCount
//     }
//   };
// }

// /**
//  * Compute Price Guard supplier health scorecards from a pre-fetched
//  * product metrics array.
//  * @param {Array<Object>} data
//  * @return {Array<Object>}
//  */
// function computePriceGuardSupplierHealthFromProducts(data) {
//   var supplierMap = {};

//   data.forEach(function (p) {
//     var s = p.supplier_name || 'Unknown Supplier';
//     if (!supplierMap[s]) {
//       supplierMap[s] = { name: s, count: 0, revenue: 0, profit: 0, totalRisk: 0 };
//     }
//     supplierMap[s].count++;
//     supplierMap[s].revenue += (parseFloat(p.revenue_latest) || 0);
//     supplierMap[s].profit += (parseFloat(p.gross_profit_latest) || 0);
//     supplierMap[s].totalRisk += (parseFloat(p.risk_score) || 0);
//   });

//   return Object.keys(supplierMap).map(function (k) {
//     var s = supplierMap[k];
//     return {
//       supplier_name: s.name,
//       product_count: s.count,
//       revenue: s.revenue,
//       margin_pct: s.revenue > 0 ? (s.profit / s.revenue) : 0,
//       health_score: Math.max(0, 100 - Math.round(s.totalRisk / s.count))
//     };
//   }).sort(function (a, b) { return a.health_score - b.health_score; });
// }

// /**
//  * Compute Price Guard category health scorecards from a pre-fetched
//  * product metrics array.
//  * @param {Array<Object>} data
//  * @return {Array<Object>}
//  */
// function computePriceGuardCategoryHealthFromProducts(data) {
//   var categoryMap = {};

//   data.forEach(function (p) {
//     var c = p.category_level_1 || 'Uncategorized';
//     if (!categoryMap[c]) {
//       categoryMap[c] = { name: c, count: 0, revenue: 0, profit: 0, totalRisk: 0 };
//     }
//     categoryMap[c].count++;
//     categoryMap[c].revenue += (parseFloat(p.revenue_latest) || 0);
//     categoryMap[c].profit += (parseFloat(p.gross_profit_latest) || 0);
//     categoryMap[c].totalRisk += (parseFloat(p.risk_score) || 0);
//   });

//   return Object.keys(categoryMap).map(function (k) {
//     var c = categoryMap[k];
//     return {
//       category_name: c.name,
//       product_count: c.count,
//       revenue: c.revenue,
//       margin_pct: c.revenue > 0 ? (c.profit / c.revenue) : 0,
//       health_score: Math.max(0, 100 - Math.round(c.totalRisk / c.count))
//     };
//   }).sort(function (a, b) { return a.health_score - b.health_score; });
// }













/**
 * Code.gs
 * ---------------------------------------------------------------------------
 * Main entry point for the Supplier Performance Dashboard web app.
 * Contains global configuration, the doGet() router, and the public
 * API endpoints that the client-side JavaScript calls via
 * google.script.run.
 *
 * All other .gs files depend on the CONFIG object defined here.
 * ---------------------------------------------------------------------------
 */

/**
 * ============================================================
 * GLOBAL CONFIGURATION
 * ============================================================
 * Update these values for your environment. See SETUP_INSTRUCTIONS.md
 * for full details on each setting.
 */
const CONFIG = {
  // Your Google Cloud project that has BigQuery enabled and billing set up.
  BQ_PROJECT_ID: 'dhub-glovo',

  // The BigQuery dataset that contains all four tables below.
  BQ_DATASET: 'availability_and_ultrafresh',

  // Second dataset, same project, that the MFC Nigeria sales/orders
  // reporting tables live in. Passed explicitly to Utilities_.qualifiedTable()
  // wherever it's needed (see MfcAnalyticsService.gs) since CONFIG.BQ_DATASET
  // above stays the default for every pre-existing call site.
  BQ_DATASET_MFC: 'mfcnigeria_analytics',

  // Table names. Change these if your tables are named differently.
  TABLES: {
    AVAILABILITY_SUMMARY: 'availability_summary',
    SUPPLIER_PRODUCT_PERFORMANCE: 'supplier_product_performance',
    SUPPLIER_SUMMARY_SNAPSHOT: 'supplier_summary_snapshot',
    DASHBOARD_SNAPSHOT: 'dashboard_snapshot',
    PRODUCTS_AVAILABILITY_LOSS: 'products_availability_loss',
    SUPPLIER_MONTHLY_METRICS: 'supplier_monthly_metrics',
    SUPPLIER_WEEKLY_METRICS: 'supplier_weekly_metrics',
    SUPPLIER_PRODUCT_PERFORMANCE_WEEK: 'supplier_product_performance_week',
    SUPPLIER_PRICES: 'supplier_prices',
    RECOMMENDATIONS: 'recommendations',



    

    // "Are we ordering enough?" purchase-order vs demand/stock table.
    // FORECASTING_PRODUCTS is the raw source table; FORECASTING_PRODUCTS_SNAPSHOT
    // is what every GET endpoint actually reads from (see below), rebuilt
    // daily by SnapshotService like everything else.
    FORECASTING_PRODUCTS: 'forecasting_products',

    // Snapshot tables (rebuilt daily at 8am by SnapshotService — all
    // GET endpoints read from these, NOT from source tables)
    AVAILABILITY_TREND_SNAPSHOT: 'availability_trend_snapshot',
    DASHBOARD_TOP_SUPPLIERS_SNAPSHOT: 'dashboard_top_suppliers_snapshot',
    DASHBOARD_TOP_SUPPLIERS_WEEKLY_SNAPSHOT: 'dashboard_top_suppliers_weekly_snapshot',
    DASHBOARD_BOTTOM_SUPPLIERS_SNAPSHOT: 'dashboard_bottom_suppliers_snapshot',
    DASHBOARD_PRODUCT_LOSS_SNAPSHOT: 'dashboard_product_loss_snapshot',
    DASHBOARD_WEEKLY_SNAPSHOT: 'dashboard_weekly_snapshot',
    SUPPLIER_MONTHLY_METRICS_SNAPSHOT: 'supplier_monthly_metrics_snapshot',
    SUPPLIER_WEEKLY_METRICS_SNAPSHOT: 'supplier_weekly_metrics_snapshot',
    SUPPLIER_LIST_SNAPSHOT: 'supplier_list_snapshot',
    PRODUCTS_FOR_SUPPLIER_SNAPSHOT: 'products_for_supplier_snapshot',
    SUPPLIER_PRICES_SNAPSHOT: 'supplier_prices_snapshot',
    FORECASTING_PRODUCTS_SNAPSHOT: 'forecasting_products_snapshot'
  },

  // Table names inside BQ_DATASET_MFC (mfcnigeria_analytics). Kept as a
  // separate map, mirroring TABLES above, so the two datasets' table
  // lists never get mixed up at a call site. Each source table has a
  // matching _SNAPSHOT table (rebuilt into the same dataset by
  // SnapshotService) that every GET endpoint actually reads from.
  MFC_TABLES: {
    CATEGORY_SALES_REPORT: 'mfc_category_sales_report',
    PRODUCT_SALES_REPORT: 'mfc_product_sales_report',
    ORDERS: 'orders',
    PRODUCT_THRESHOLD_REPORT: 'mfc_product_threshold_report',

    CATEGORY_SALES_REPORT_SNAPSHOT: 'mfc_category_sales_report_snapshot',
    PRODUCT_SALES_REPORT_SNAPSHOT: 'mfc_product_sales_report_snapshot',
    ORDERS_SNAPSHOT: 'orders_snapshot',
    PRODUCT_THRESHOLD_REPORT_SNAPSHOT: 'mfc_product_threshold_report_snapshot'
  },

  // Third dataset, same project (dhub-glovo), that the Price Guard
  // pricing-intelligence app's tables live in. Passed explicitly to
  // Utilities_.qualifiedTable() wherever needed (see PriceGuard*.gs
  // services) since CONFIG.BQ_DATASET stays the default everywhere else.
  BQ_DATASET_PRICE_GUARD: 'price_guard',

  // Table names inside BQ_DATASET_PRICE_GUARD. Mirrors MFC_TABLES' shape:
  // externally-managed source tables the Price Guard Apps Script project
  // never wrote to, GAS-owned tables it already read/wrote directly
  // (these are themselves precomputed daily snapshots in the original
  // app - computed_daily_metrics carries its own snapshot_date column,
  // so we keep reading/writing them under their original names rather
  // than forcing a "_snapshot" rename), and brand-new "_snapshot" tables
  // added here for the two read paths that used to hit a source/live
  // table directly on every request (see PriceGuardSnapshotService.gs).
  PG_TABLES: {
    // Externally managed source tables (never written by this backend).
    // DASHBOARD_TABLE is the single source of truth an external job
    // already joins internal_products with all four competitor feeds
    // into; COMPETITOR_TABLE_MATCHES is the Python matching engine's
    // output table.
    DASHBOARD_TABLE: 'dashboard_table',
    COMPETITOR_TABLE_MATCHES: 'competitor_table_matches',

    // GAS-owned tables (this backend creates + writes these - see
    // PriceGuardSchemaService.gs). Already snapshot-shaped in the
    // original app (computed_daily_metrics/daily_alerts carry a
    // snapshot_date column and are only ever queried filtered to
    // MAX(snapshot_date)), so GET endpoints read these directly,
    // exactly like the original.
    COMPUTED_DAILY_METRICS: 'computed_daily_metrics',
    DAILY_ALERTS: 'daily_alerts',
    PRODUCT_MATCHES: 'product_matches',
    PRICE_RECOMMENDATIONS: 'price_recommendations',

    // New snapshot tables (rebuilt daily by PriceGuardSnapshotService,
    // and immediately on every write for the recommendations ones -
    // same pattern as supplier_prices_snapshot). Added so
    // getMatches/getPricingRecommendations/getRecommendationHistory
    // stop querying competitor_table_matches / price_recommendations
    // live on every request, per the cost/latency goals of this
    // migration.
    MATCHES_SNAPSHOT: 'matches_snapshot',
    PRICE_RECOMMENDATIONS_PENDING_SNAPSHOT: 'price_recommendations_pending_snapshot',
    PRICE_RECOMMENDATIONS_HISTORY_SNAPSHOT: 'price_recommendations_history_snapshot'
  },

  // Cache duration (seconds) for the Price Guard recommendations reads.
  // Short, like SUPPLIER_PRICES_CACHE_TTL_SECONDS, since the queue is
  // actively worked from the Pricing Actions page.
  PRICE_GUARD_RECOMMENDATIONS_CACHE_TTL_SECONDS: 60,

  // BigQuery location (region) that hosts the dataset, e.g. 'US', 'EU'.
  BQ_LOCATION: 'US',

  // How many rows to request per BigQuery page. 10,000 is generally safe.
  BQ_MAX_RESULTS: 10000,

  // How many seconds to wait between BigQuery job polling attempts.
  BQ_POLL_INTERVAL_MS: 500,

  // Maximum time (ms) to wait for a BigQuery job to finish before giving up.
  BQ_JOB_TIMEOUT_MS: 60000,

  // Cache duration (seconds) for dashboard/supplier snapshot reads.
  // Keeps repeat page loads fast without re-querying BigQuery every time.
  CACHE_TTL_SECONDS: 300,

  // Cache duration (seconds) for the raw supplier_prices read. Shorter than
  // CACHE_TTL_SECONDS since prices are actively maintained by users from
  // the Recommendations page and should feel responsive after an edit.
  SUPPLIER_PRICES_CACHE_TTL_SECONDS: 60,

  // Weights used by RecommendationService to blend each supplier's
  // product-level fill rate, overall fill rate, and normalized price into
  // a single recommendation score. Must sum to 1 for the score to stay
  // within a 0-1 range.
  RECOMMENDATION_WEIGHTS: {
    productFillRate: 0.5,
    overallFillRate: 0.2,
    priceScore: 0.3
  },

  // Gemini model used by GeminiService/MfcAiReviewService (WBR-review,
  // daily-review, monthly-review, Ask-AI). 'gemini-flash-latest' is
  // Google's own alias for "whatever the current stable Flash model is" -
  // Flash model ids churn fast (2.0 Flash retired in March 2026), so this
  // is pinned to the alias rather than a specific version to avoid
  // silently breaking later. The actual key lives in Script Properties
  // (GEMINI_API_KEY), never here.
  GEMINI_MODEL: 'gemini-2.5-flash',

  // Fourth dataset, same project (dhub-glovo), for the "Weighted
  // Availability" tool - same shape as availability_and_ultrafresh
  // (CONFIG.BQ_DATASET) but covering ALL products, not just ultrafresh
  // ones. Passed explicitly to Utilities_.qualifiedTable() wherever
  // needed (see WeightedAvailability*.gs services) since CONFIG.BQ_DATASET
  // stays the default everywhere else.
  BQ_DATASET_WEIGHTED_AVAILABILITY: 'availability_and_nonultrafresh',

  // Table names inside BQ_DATASET_WEIGHTED_AVAILABILITY. Mirrors TABLES
  // above field-for-field (same roles: dashboard, supplier summary,
  // products, forecasting), just pointed at the "_nonuf" source tables
  // confirmed against the dataset's actual table list. SUPPLIER_PRICES is
  // deliberately NOT here - prices aren't duplicated per dataset, every
  // price read/write still goes through CONFIG.TABLES.SUPPLIER_PRICES*
  // (see WeightedAvailabilityRecommendationService.gs).
  WA_TABLES: {
    AVAILABILITY_SUMMARY: 'availability_summary',
    SUPPLIER_PRODUCT_PERFORMANCE: 'supplier_product_performance_nonuf',
    SUPPLIER_PRODUCT_PERFORMANCE_WEEK: 'supplier_product_performance_week_nonuf',
    PRODUCTS_AVAILABILITY_LOSS: 'products_availability_loss_nonuf',
    SUPPLIER_MONTHLY_METRICS: 'supplier_monthly_metrics_nonuf',
    SUPPLIER_WEEKLY_METRICS: 'supplier_weekly_metrics_nonuf',
    FORECASTING_PRODUCTS: 'forecasting_nonufproducts',

    // Snapshot/output tables this backend creates in the new dataset
    // (rebuilt daily by SnapshotService, same as every other snapshot in
    // this app). Same simple names as the UF snapshots are fine - they
    // live in a different dataset, so there's no collision.
    SUPPLIER_SUMMARY_SNAPSHOT: 'supplier_summary_snapshot',
    DASHBOARD_SNAPSHOT: 'dashboard_snapshot',
    AVAILABILITY_TREND_SNAPSHOT: 'availability_trend_snapshot',
    DASHBOARD_TOP_SUPPLIERS_SNAPSHOT: 'dashboard_top_suppliers_snapshot',
    DASHBOARD_TOP_SUPPLIERS_WEEKLY_SNAPSHOT: 'dashboard_top_suppliers_weekly_snapshot',
    DASHBOARD_BOTTOM_SUPPLIERS_SNAPSHOT: 'dashboard_bottom_suppliers_snapshot',
    DASHBOARD_PRODUCT_LOSS_SNAPSHOT: 'dashboard_product_loss_snapshot',
    DASHBOARD_WEEKLY_SNAPSHOT: 'dashboard_weekly_snapshot',
    SUPPLIER_MONTHLY_METRICS_SNAPSHOT: 'supplier_monthly_metrics_snapshot',
    SUPPLIER_WEEKLY_METRICS_SNAPSHOT: 'supplier_weekly_metrics_snapshot',
    SUPPLIER_LIST_SNAPSHOT: 'supplier_list_snapshot',
    PRODUCTS_FOR_SUPPLIER_SNAPSHOT: 'products_for_supplier_snapshot',
    FORECASTING_PRODUCTS_SNAPSHOT: 'forecasting_products_snapshot',
    RECOMMENDATIONS: 'recommendations'
  }
};

/**
 * ============================================================
 * WEB APP ROUTING (REST / JSON)
 * ============================================================
 * The app was converted from an HtmlService UI into a JSON REST API
 * consumed by an external React + Electron client. Every request -
 * GET or POST - carries an `action` parameter whose value is the name
 * of one of the API_ROUTES entries below (deliberately the same name
 * as the existing api_* function, so there is a 1:1, easy-to-trace
 * mapping and no separate route table to keep in sync).
 *
 * GET  ?action=getDashboardData
 * POST body: { "action": "addOrUpdatePrice", "params": { ... } }
 *
 * All business logic is unchanged - this section only decides which
 * existing api_* function to call and how to serialize the result.
 */

/**
 * Maps a public action name to the existing api_* function. Kept as a
 * single lookup table so adding a new endpoint later means adding one
 * line here (and the api_* function itself), nothing else.
 */
const API_ROUTES = {
  getDashboardData: api_getDashboardData,
  getSupplierSummary: api_getSupplierSummary,
  getSupplierList: api_getSupplierList,
  getProductsForSupplier: api_getProductsForSupplier,
  getAllPrices: api_getAllPrices,
  addOrUpdatePrice: api_addOrUpdatePrice,
  deletePrice: api_deletePrice,
  getRecommendations: api_getRecommendations,
  runSnapshotNow: api_runSnapshotNow,

  // "Are we ordering enough?" (forecasting_products)
  getForecastingProducts: api_getForecastingProducts,
  getForecastingFilterOptions: api_getForecastingFilterOptions,

  // Weighted Availability - full mirror of the Ultrafresh Availability
  // tool above, reading from CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY /
  // CONFIG.WA_TABLES instead. Prices are NOT duplicated - price reads/
  // writes reuse getAllPrices/addOrUpdatePrice/deletePrice above as-is.
  getWeightedAvailabilityDashboardData: api_getWeightedAvailabilityDashboardData,
  getWeightedAvailabilitySupplierSummary: api_getWeightedAvailabilitySupplierSummary,
  getWeightedAvailabilitySupplierList: api_getWeightedAvailabilitySupplierList,
  getWeightedAvailabilityProductsForSupplier: api_getWeightedAvailabilityProductsForSupplier,
  getWeightedAvailabilityForecastingProducts: api_getWeightedAvailabilityForecastingProducts,
  getWeightedAvailabilityForecastingFilterOptions: api_getWeightedAvailabilityForecastingFilterOptions,
  getWeightedAvailabilityRecommendations: api_getWeightedAvailabilityRecommendations,

  // MFC Nigeria sales/orders reporting
  getMfcCategorySalesReport: api_getMfcCategorySalesReport,
  getMfcProductSalesReport: api_getMfcProductSalesReport,
  getMfcOrders: api_getMfcOrders,
  getMfcProductThresholdReport: api_getMfcProductThresholdReport,
  getUserInfo: api_getUserInfo,

  // MFC AI intelligence: WBR-review (weekly), daily-review, monthly-review,
  // Ask-AI. The get* actions just read the last generated review (instant,
  // no Gemini call) - generation happens on a time-driven trigger (see
  // weeklyWbrReviewTrigger/dailyReviewTrigger/monthlyReviewTrigger below)
  // or on-demand via the *Now actions, same "precompute then read" split
  // as runSnapshotNow.
  getMfcWbrReview: api_getMfcWbrReview,
  getMfcDailyReview: api_getMfcDailyReview,
  getMfcMonthlyReview: api_getMfcMonthlyReview,
  generateMfcWbrReviewNow: api_generateMfcWbrReviewNow,
  generateMfcDailyReviewNow: api_generateMfcDailyReviewNow,
  generateMfcMonthlyReviewNow: api_generateMfcMonthlyReviewNow,
  askMfcAi: api_askMfcAi,

  // Price Guard - competitive pricing intelligence (migrated from the
  // standalone Price Guard Apps Script project; see PriceGuard*.gs)
  getPriceGuardDashboardData: api_getPriceGuardDashboardData,
  getPriceGuardDashboardSummary: api_getPriceGuardDashboardSummary,
  getPriceGuardProducts: api_getPriceGuardProducts,
  getPriceGuardCategoryHealth: api_getPriceGuardCategoryHealth,
  getPriceGuardSupplierHealth: api_getPriceGuardSupplierHealth,
  getPriceGuardAlerts: api_getPriceGuardAlerts,
  getPriceGuardMatches: api_getPriceGuardMatches,
  approvePriceGuardMatch: api_approvePriceGuardMatch,
  savePriceGuardManualOverride: api_savePriceGuardManualOverride,
  triggerPriceGuardRematch: api_triggerPriceGuardRematch,
  getPriceGuardSettings: api_getPriceGuardSettings,
  savePriceGuardSettings: api_savePriceGuardSettings,
  getPriceGuardPendingRecommendations: api_getPriceGuardPendingRecommendations,
  getPriceGuardRecommendationHistory: api_getPriceGuardRecommendationHistory,
  getPriceGuardProductMetrics: api_getPriceGuardProductMetrics,
  submitPriceGuardRecommendation: api_submitPriceGuardRecommendation,
  approvePriceGuardRecommendation: api_approvePriceGuardRecommendation,
  approvePriceGuardRecommendations: api_approvePriceGuardRecommendations,
  rejectPriceGuardRecommendation: api_rejectPriceGuardRecommendation,
  runPriceGuardDailySync: api_runPriceGuardDailySync,
  getPriceGuardPipelineStatus: api_getPriceGuardPipelineStatus,
  runPriceGuardSnapshotNow: api_runPriceGuardSnapshotNow
};

/**
 * Handles all GET requests. Reads `action` from the query string and,
 * for endpoints that take simple scalar args (e.g. supplierName, sku),
 * also reads those directly from the query string.
 * @param {Object} e Apps Script event object.
 * @return {TextOutput} JSON response.
 */
function doGet(e) {
  return handleApiRequest_(e, false);
}

function api_getUserInfo(){
  return {email: Session.getActiveUser().getEmail()}
}

/**
 * Handles all POST requests. Reads `action` and a `params` object from
 * the JSON request body (falls back to query string `action` if the
 * body isn't present/parseable, so simple POSTs still route correctly).
 * @param {Object} e Apps Script event object.
 * @return {TextOutput} JSON response.
 */
function doPost(e) {
  return handleApiRequest_(e, true);
}

/**
 * Shared dispatcher for doGet/doPost: resolves the action, gathers its
 * arguments, invokes the matching api_* function, and always returns
 * JSON - including for routing errors (unknown action, bad JSON body)
 * - so the client never has to branch on response type.
 * @param {Object} e Apps Script event object.
 * @param {boolean} isPost Whether this came from doPost (reads params from the JSON body) or doGet (reads params from the query string).
 * @return {TextOutput}
 * @private
 */
function handleApiRequest_(e, isPost) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    let action = params.action;
    let body = {};

    if (isPost && e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return jsonResponse_(Utilities_.buildErrorResponse(parseErr, 'handleApiRequest_'));
      }
      action = body.action || action;
    }

    const fn = action ? API_ROUTES[action] : null;
    if (!fn) {
      return jsonResponse_({
        error: true,
        message: 'Unknown or missing action.',
        context: 'handleApiRequest_',
        detail: 'action=' + action
      });
    }

    const args = resolveActionArgs_(action, params, body.params || {});
    const result = fn.apply(null, args);
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_(Utilities_.buildErrorResponse(err, 'handleApiRequest_'));
  }
}

/**
 * Positional-argument lookup for the handful of endpoints that take
 * scalar params, so callers can pass them either as query-string values
 * (GET) or inside the `params` object (POST) without each api_*
 * function needing to know which.
 * @param {string} action
 * @param {Object} queryParams e.parameter from the request.
 * @param {Object} bodyParams The `params` object from a JSON POST body, if any.
 * @return {Array} Arguments to apply to the routed function, in order.
 * @private
 */
function resolveActionArgs_(action, queryParams, bodyParams) {
  const p = function (key) {
    return bodyParams[key] !== undefined ? bodyParams[key] : queryParams[key];
  };

  switch (action) {
    case 'getProductsForSupplier':
    case 'getWeightedAvailabilityProductsForSupplier':
      return [p('supplierName')];
    case 'addOrUpdatePrice':
      // api_addOrUpdatePrice takes a single priceData object.
      return [Object.keys(bodyParams).length ? bodyParams : queryParams];
    case 'deletePrice':
      return [p('sku'), p('supplierId')];
    case 'getForecastingProducts':
    case 'getWeightedAvailabilityForecastingProducts':
    case 'getMfcCategorySalesReport':
    case 'getMfcProductSalesReport':
    case 'getMfcProductThresholdReport':
    case 'getPriceGuardProducts':
    case 'getPriceGuardAlerts':
    case 'getPriceGuardMatches':
      // Filter object: GET reads it from the query string (e.g.
      // ?warehouse=Lagos&search=oil), POST reads it from the JSON body's
      // `params`, same convention as addOrUpdatePrice above.
      return [Object.keys(bodyParams).length ? bodyParams : queryParams];
    case 'approvePriceGuardMatch':
      return [p('sku'), p('competitor')];
    case 'savePriceGuardManualOverride':
      return [p('sku'), p('competitor'), p('name'), p('price'), p('explanation')];
    case 'triggerPriceGuardRematch':
    case 'getPriceGuardProductMetrics':
      return [p('sku')];
    case 'approvePriceGuardRecommendation':
    case 'rejectPriceGuardRecommendation':
      return [p('id')];
    case 'savePriceGuardSettings':
      // api_savePriceGuardSettings takes a single settings object.
      return [Object.keys(bodyParams).length ? bodyParams : queryParams];
    case 'submitPriceGuardRecommendation':
      // api_submitPriceGuardRecommendation takes a single recommendation object.
      return [Object.keys(bodyParams).length ? bodyParams : queryParams];
    case 'approvePriceGuardRecommendations':
      // api_approvePriceGuardRecommendations takes an array of ids, sent
      // as params.ids from a POST body (GET has no natural array syntax
      // here, so this one is POST-only in practice).
      return [bodyParams.ids || queryParams.ids || []];
    case 'askMfcAi':
      // POST-only (history is an array, doesn't belong in a query string).
      return [p('question'), bodyParams.history || []];
    default:
      return [];
  }
}

/**
 * Serializes a plain object as a JSON TextOutput response.
 * @param {Object} obj
 * @return {TextOutput}
 * @private
 */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================
 * PUBLIC API ENDPOINTS
 * ============================================================
 * These are the only functions the client-side JavaScript should call
 * via google.script.run. Each one returns a plain JS object (never a
 * BigQuery-specific type) so it can be safely serialized to the client.
 *
 * Every endpoint follows the same defensive pattern:
 *   try { ...load data... } catch (err) { return { error: ... } }
 * so the frontend can always check `response.error` first.
 */

/**
 * Returns all data needed to render the Dashboard page.
 * @return {Object}
 */
function api_getDashboardData() {
  try {
    Logger.log("Hey");
    return DashboardService.getDashboardData();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getDashboardData');
  }
}

function testDashboard() {
  const result = DashboardService.getDashboardData();
  Logger.log(JSON.stringify(result.topSuppliersByQuantity, null, 2));
}

/**
 * Returns the full supplier summary table (from supplier_summary_snapshot).
 * @return {Object}
 */
function api_getSupplierSummary() {
  try {
    return SupplierService.getSupplierSummary();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getSupplierSummary');
  }
}

/**
 * Returns the distinct list of supplier names for the Products page dropdown.
 * @return {Object}
 */
function api_getSupplierList() {
  try {
    return ProductService.getSupplierList();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getSupplierList');
  }
}

/**
 * Returns product-level performance data for a single supplier.
 * @param {string} supplierName
 * @return {Object}
 */
function api_getProductsForSupplier(supplierName) {
  try {
    return ProductService.getProductsForSupplier(supplierName);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getProductsForSupplier');
  }
}

/**
 * Manually triggers the daily snapshot process. Exposed so an admin
 * can force a refresh from the UI (optional) or for testing in the
 * Apps Script editor.
 * @return {Object}
 */
function api_runSnapshotNow() {
  try {
    SnapshotService.runDailySnapshot();
    return { success: true };
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_runSnapshotNow');
  }
}

/**
 * Returns every row of supplier_prices, used by the Recommendations
 * page's "Update Prices" modal to list and manage supplier prices.
 * @return {Object}
 */
function api_getAllPrices() {
  try {
    return SupplierPriceService.getAllPrices();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getAllPrices');
  }
}

/**
 * Inserts a new supplier price, or updates Product_Name / Trade_Price for
 * an existing (SKU, Supplier_ID) pair.
 * @param {Object} priceData {sku, productName, supplierId, supplierName, tradePrice}
 * @return {Object}
 */
function api_addOrUpdatePrice(priceData) {
  try {
    return SupplierPriceService.addOrUpdatePrice(priceData);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_addOrUpdatePrice');
  }
}

/**
 * Deletes a supplier price by its (SKU, Supplier_ID) key.
 * @param {string} sku
 * @param {string} supplierId
 * @return {Object}
 */
function api_deletePrice(sku, supplierId) {
  try {
    return SupplierPriceService.deletePrice(sku, supplierId);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_deletePrice');
  }
}

/**
 * Returns the top 3 recommended suppliers per product, blending product
 * fill rate, overall supplier fill rate, and normalized trade price.
 * @return {Object}
 */
function api_getRecommendations() {
  try {
    return RecommendationService.getRecommendations();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getRecommendations');
  }
}

/**
 * Returns forecasting_products rows ("Are we ordering enough?"), optionally
 * filtered by warehouse, category, SKU, and/or free-text search.
 * @param {Object} filters {warehouse, category, sku, search}
 * @return {Object}
 */
function api_getForecastingProducts(filters) {
  try {
    return ForecastingService.getForecastingProducts(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getForecastingProducts');
  }
}

/**
 * Returns the distinct warehouse and category lists for the Forecasting
 * page's filter dropdowns.
 * @return {Object}
 */
function api_getForecastingFilterOptions() {
  try {
    return ForecastingService.getFilterOptions();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getForecastingFilterOptions');
  }
}

/**
 * ============================================================
 * WEIGHTED AVAILABILITY API ENDPOINTS
 * ============================================================
 * Full mirror of the Ultrafresh Availability endpoints above, reading
 * from CONFIG.BQ_DATASET_WEIGHTED_AVAILABILITY / CONFIG.WA_TABLES.
 * Business logic lives in WeightedAvailability*.gs; these wrappers only
 * route + catch, same as every other api_* function in this file.
 */

/**
 * Returns all data needed to render the Weighted Availability Dashboard page.
 * @return {Object}
 */
function api_getWeightedAvailabilityDashboardData() {
  try {
    return WeightedAvailabilityDashboardService.getDashboardData();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailabilityDashboardData');
  }
}

/**
 * Returns the full weighted-availability supplier summary table.
 * @return {Object}
 */
function api_getWeightedAvailabilitySupplierSummary() {
  try {
    return WeightedAvailabilitySupplierService.getSupplierSummary();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailabilitySupplierSummary');
  }
}

/**
 * Returns the distinct list of supplier names for the weighted-availability
 * Products page dropdown.
 * @return {Object}
 */
function api_getWeightedAvailabilitySupplierList() {
  try {
    return WeightedAvailabilityProductService.getSupplierList();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailabilitySupplierList');
  }
}

/**
 * Returns weighted-availability product-level performance data for a
 * single supplier.
 * @param {string} supplierName
 * @return {Object}
 */
function api_getWeightedAvailabilityProductsForSupplier(supplierName) {
  try {
    return WeightedAvailabilityProductService.getProductsForSupplier(supplierName);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailabilityProductsForSupplier');
  }
}

/**
 * Returns weighted-availability forecasting_nonufproducts rows ("Are we
 * ordering enough?"), optionally filtered.
 * @param {Object} filters {warehouse, category, sku, search}
 * @return {Object}
 */
function api_getWeightedAvailabilityForecastingProducts(filters) {
  try {
    return WeightedAvailabilityForecastingService.getForecastingProducts(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailabilityForecastingProducts');
  }
}

/**
 * Returns the distinct warehouse and category lists for the weighted-
 * availability Forecasting page's filter dropdowns.
 * @return {Object}
 */
function api_getWeightedAvailabilityForecastingFilterOptions() {
  try {
    return WeightedAvailabilityForecastingService.getFilterOptions();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailabilityForecastingFilterOptions');
  }
}

/**
 * Returns the top 3 recommended suppliers per product for the weighted-
 * availability tool, blending product fill rate, overall supplier fill
 * rate, and normalized trade price (shared supplier_prices data).
 * @return {Object}
 */
function api_getWeightedAvailabilityRecommendations() {
  try {
    return WeightedAvailabilityRecommendationService.getRecommendations();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailabilityRecommendations');
  }
}

/**
 * Returns mfc_category_sales_report rows, optionally filtered by category
 * and/or free-text search.
 * @param {Object} filters {category, search}
 * @return {Object}
 */
function api_getMfcCategorySalesReport(filters) {
  try {
    return MfcAnalyticsService.getCategorySalesReport(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getMfcCategorySalesReport');
  }
}

/**
 * Returns mfc_product_sales_report rows, optionally filtered by category,
 * SKU, and/or free-text search.
 * @param {Object} filters {category, sku, search}
 * @return {Object}
 */
function api_getMfcProductSalesReport(filters) {
  try {
    return MfcAnalyticsService.getProductSalesReport(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getMfcProductSalesReport');
  }
}

/**
 * Returns the single-row orders summary table (yesterday / week / MTD
 * figures, overall and split by LOSF1 / MNLF1).
 * @return {Object}
 */
function api_getMfcOrders() {
  try {
    return MfcAnalyticsService.getOrders();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getMfcOrders');
  }
}

/**
 * Returns mfc_product_threshold_report rows, optionally filtered by
 * category, SKU, and/or free-text search.
 * @param {Object} filters {category, sku, search}
 * @return {Object}
 */
function api_getMfcProductThresholdReport(filters) {
  try {
    return MfcAnalyticsService.getProductThresholdReport(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getMfcProductThresholdReport');
  }
}

/**
 * ============================================================
 * MFC AI INTELLIGENCE ENDPOINTS
 * ============================================================
 * WBR-review, daily-review, monthly-review, and Ask-AI. Business logic
 * lives in MfcAiReviewService.gs / GeminiService.gs; these wrappers only
 * route + catch, exactly like every other api_* function in this file.
 */

/**
 * Returns the last generated WBR-review (no Gemini call - just reads what
 * weeklyWbrReviewTrigger / generateMfcWbrReviewNow last stored).
 * @return {Object}
 */
function api_getMfcWbrReview() {
  try {
    return MfcAiReviewService.getWbrReview();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getMfcWbrReview');
  }
}

/**
 * Returns the last generated daily-review (no Gemini call).
 * @return {Object}
 */
function api_getMfcDailyReview() {
  try {
    return MfcAiReviewService.getDailyReview();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getMfcDailyReview');
  }
}

/**
 * Returns the last generated monthly-review (no Gemini call).
 * @return {Object}
 */
function api_getMfcMonthlyReview() {
  try {
    return MfcAiReviewService.getMonthlyReview();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getMfcMonthlyReview');
  }
}

/**
 * Forces a WBR-review regeneration right now (calls Gemini). Exposed so
 * the UI's "Regenerate" button works without waiting for Monday, same
 * role as runSnapshotNow.
 * @return {Object}
 */
function api_generateMfcWbrReviewNow() {
  try {
    return MfcAiReviewService.generateWbrReview();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_generateMfcWbrReviewNow');
  }
}

/**
 * Forces a daily-review regeneration right now (calls Gemini).
 * @return {Object}
 */
function api_generateMfcDailyReviewNow() {
  try {
    return MfcAiReviewService.generateDailyReview();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_generateMfcDailyReviewNow');
  }
}

/**
 * Forces a monthly-review regeneration right now (calls Gemini).
 * @return {Object}
 */
function api_generateMfcMonthlyReviewNow() {
  try {
    return MfcAiReviewService.generateMonthlyReview();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_generateMfcMonthlyReviewNow');
  }
}

/**
 * Answers a grounded, multi-turn Ask-AI question about the MFC business.
 * @param {string} question
 * @param {Array<{role: string, text: string}>} history Prior turns this
 *   session, oldest first - the client resends the full transcript each
 *   call since this backend keeps no session state.
 * @return {Object}
 */
function api_askMfcAi(question, history) {
  try {
    return MfcAiReviewService.askAi(question, history);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_askMfcAi');
  }
}

/**
 * ============================================================
 * PRICE GUARD API ENDPOINTS
 * ============================================================
 * Migrated from the standalone Price Guard Apps Script project. Every
 * RPC function that project's UI called (google.script.run.X) has a
 * 1:1 api_* counterpart here, wired into API_ROUTES above under a
 * "PriceGuard"-qualified action name so it can't collide with the
 * pre-existing supplier/MFC endpoints. Business logic itself lives in
 * the PriceGuard*.gs service files; these wrappers only route + catch,
 * exactly like every other api_* function in this file.
 */

/**
 * Returns everything the Price Guard dashboard page needs in one call:
 * summary cards, full product list, supplier/category health, alerts,
 * matches, and pending recommendations. Mirrors the original
 * getCompositeDashboardData() RPC, but every piece now comes from
 * precomputed snapshot tables instead of a live dashboard_table query.
 * @return {Object}
 */
function api_getPriceGuardDashboardData() {
  try {
    return PriceGuardService.getCompositeDashboardData();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardDashboardData');
  }
}

/**
 * Returns just the Price Guard dashboard summary cards (revenue, gross
 * profit, margin, revenue at risk, margin leakage, opportunity value,
 * alert counts by severity).
 * @return {Object}
 */
function api_getPriceGuardDashboardSummary() {
  try {
    return PriceGuardService.getDashboardSummary();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardDashboardSummary');
  }
}

/**
 * Returns the full Price Guard product catalog with computed metrics,
 * optionally filtered. @param {Object} filters {category, supplierName, search}
 * @return {Object}
 */
function api_getPriceGuardProducts(filters) {
  try {
    return PriceGuardService.getProducts(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardProducts');
  }
}

/**
 * Returns category-level health scorecards computed from the latest
 * product metrics snapshot.
 * @return {Object}
 */
function api_getPriceGuardCategoryHealth() {
  try {
    return PriceGuardService.getCategoryHealth();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardCategoryHealth');
  }
}

/**
 * Returns supplier-level health scorecards computed from the latest
 * product metrics snapshot.
 * @return {Object}
 */
function api_getPriceGuardSupplierHealth() {
  try {
    return PriceGuardService.getSupplierHealth();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardSupplierHealth');
  }
}

/**
 * Returns the latest precomputed pricing anomaly alerts, optionally
 * filtered. @param {Object} filters {severity, alertType, search}
 * @return {Object}
 */
function api_getPriceGuardAlerts(filters) {
  try {
    return PriceGuardAnomalyService.getLatestAlerts(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardAlerts');
  }
}

/**
 * Returns the competitor match queue from matches_snapshot (a daily
 * copy of the Python matching engine's competitor_table_matches
 * output), optionally filtered.
 * @param {Object} filters {sku, competitor, isApproved}
 * @return {Object}
 */
function api_getPriceGuardMatches(filters) {
  try {
    return PriceGuardMatchingService.getMatches(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardMatches');
  }
}

/**
 * Approves a candidate competitor match (writes to product_matches,
 * the manual override/approval store - NOT matches_snapshot; see the
 * "Not yet decided" note in README about this pre-existing gap).
 * @param {string} sku
 * @param {string} competitor
 * @return {Object}
 */
function api_approvePriceGuardMatch(sku, competitor) {
  try {
    return PriceGuardMatchingService.approveMatch(sku, competitor);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_approvePriceGuardMatch');
  }
}

/**
 * Manually forces/creates a product match (product_matches table).
 * @param {string} sku
 * @param {string} competitor
 * @param {string} name Competitor product name.
 * @param {number} price
 * @param {string} explanation
 * @return {Object}
 */
function api_savePriceGuardManualOverride(sku, competitor, name, price, explanation) {
  try {
    return PriceGuardMatchingService.saveManualOverride(sku, competitor, name, price, explanation);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_savePriceGuardManualOverride');
  }
}

/**
 * Flags a product for rematching and dispatches the GitHub Actions
 * rematch workflow, if configured.
 * @param {string} sku
 * @return {Object}
 */
function api_triggerPriceGuardRematch(sku) {
  try {
    return PriceGuardMatchingService.triggerRematch(sku);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_triggerPriceGuardRematch');
  }
}

/**
 * Returns the current Price Guard alert thresholds, notification, and
 * integration settings (Script Properties-backed, deep-merged with
 * defaults - unchanged from the original SettingsService).
 * @return {Object}
 */
function api_getPriceGuardSettings() {
  try {
    return PriceGuardSettingsService.getSettings();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardSettings');
  }
}

/**
 * Saves the Price Guard settings object.
 * @param {Object} settings
 * @return {Object}
 */
function api_savePriceGuardSettings(settings) {
  try {
    return PriceGuardSettingsService.saveSettings(settings);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_savePriceGuardSettings');
  }
}

/**
 * Returns pending price recommendations from
 * price_recommendations_pending_snapshot.
 * @return {Object}
 */
function api_getPriceGuardPendingRecommendations() {
  try {
    return PriceGuardPricingActionService.getRecommendations();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardPendingRecommendations');
  }
}

/**
 * Returns approved/rejected recommendation history from
 * price_recommendations_history_snapshot.
 * @return {Object}
 */
function api_getPriceGuardRecommendationHistory() {
  try {
    return PriceGuardPricingActionService.getRecommendationHistory();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardRecommendationHistory');
  }
}

/**
 * Returns the precomputed metrics for a single SKU, used to
 * auto-populate the "New Recommendation" form.
 * @param {string} sku
 * @return {Object}
 */
function api_getPriceGuardProductMetrics(sku) {
  try {
    return PriceGuardPricingActionService.getProductMetrics(sku);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardProductMetrics');
  }
}

/**
 * Submits a new pricing recommendation (status = Pending).
 * @param {Object} data
 * @return {Object}
 */
function api_submitPriceGuardRecommendation(data) {
  try {
    return PriceGuardPricingActionService.submitRecommendation(data);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_submitPriceGuardRecommendation');
  }
}

/**
 * Approves a single pending recommendation by ID.
 * @param {string} id
 * @return {Object}
 */
function api_approvePriceGuardRecommendation(id) {
  try {
    return PriceGuardPricingActionService.approveRecommendation(id);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_approvePriceGuardRecommendation');
  }
}

/**
 * Approves multiple pending recommendations by ID.
 * @param {Array<string>} ids
 * @return {Object}
 */
function api_approvePriceGuardRecommendations(ids) {
  try {
    return PriceGuardPricingActionService.approveRecommendations(ids);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_approvePriceGuardRecommendations');
  }
}

/**
 * Rejects a single pending recommendation by ID.
 * @param {string} id
 * @return {Object}
 */
function api_rejectPriceGuardRecommendation(id) {
  try {
    return PriceGuardPricingActionService.rejectRecommendation(id);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_rejectPriceGuardRecommendation');
  }
}

/**
 * Runs the full Price Guard daily pipeline on demand (schema bootstrap,
 * metrics + alerts computation and persistence, matches/recommendations
 * snapshot rebuilds, scraper dispatch, and the email digest) - the same
 * pipeline the 8am WAT trigger runs. Mirrors the original
 * runDailySyncJob() RPC.
 * @return {Object}
 */
function api_runPriceGuardDailySync() {
  try {
    var report = PriceGuardSnapshotService.runDailyPipeline();
    return {
      success: report.overall_success,
      report: report,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_runPriceGuardDailySync');
  }
}

/**
 * Returns Price Guard pipeline run status/last-run metadata, mirroring
 * the original getPipelineStatus() RPC.
 * @return {Object}
 */
function api_getPriceGuardPipelineStatus() {
  try {
    return PriceGuardSnapshotService.getPipelineStatus();
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getPriceGuardPipelineStatus');
  }
}

/**
 * Manually triggers just the Price Guard snapshot rebuilds (matches,
 * recommendations pending/history) without running the full pipeline
 * (schema bootstrap, scraper dispatch, email digest). Exposed for
 * quick "refresh reads" use from the dashboard, parallel to the
 * existing runSnapshotNow for the supplier dashboard.
 * @return {Object}
 */
function api_runPriceGuardSnapshotNow() {
  try {
    PriceGuardSnapshotService.rebuildReadSnapshots();
    return { success: true };
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_runPriceGuardSnapshotNow');
  }
}

/**
 * ============================================================
 * TIME-DRIVEN TRIGGER TARGET
 * ============================================================
 * This is the function you point a daily time-driven trigger at.
 * See SETUP_INSTRUCTIONS.md for how to install the trigger.
 */
function dailySnapshotTrigger() {
  SnapshotService.runDailySnapshot();
}

/**
 * Time-driven trigger target for the Price Guard pipeline, kept
 * separate from dailySnapshotTrigger() above since it's a different
 * multi-step orchestration (schema bootstrap, metrics/alerts
 * computation, scraper dispatch, email digest) on its own schedule -
 * install a second daily trigger pointed at this function for 8am WAT,
 * matching the original Price Guard project's schedule.
 */
function priceGuardDailyPipelineTrigger() {
  var report = PriceGuardSnapshotService.runDailyPipeline();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('PRICE_GUARD_LAST_PIPELINE_RUN', new Date().toISOString());
  props.setProperty('PRICE_GUARD_LAST_PIPELINE_STATUS', report.overall_success ? 'SUCCESS' : 'PARTIAL_FAILURE');
}

/**
 * ============================================================
 * MFC AI REVIEW TRIGGER TARGETS
 * ============================================================
 * All three scheduled 9am-10am - one hour after dailySnapshotTrigger's and
 * priceGuardDailyPipelineTrigger's 8am-9am window, so the data they read
 * is guaranteed fresh (Apps Script doesn't guarantee ordering between
 * triggers scheduled in the same hour).
 */

/**
 * Generates the WBR-review. Install as a Week timer trigger, Monday,
 * 9am-10am - reviews the week that just finished.
 */
function weeklyWbrReviewTrigger() {
  MfcAiReviewService.generateWbrReview();
}

/**
 * Generates the daily-review. Install as a Day timer trigger, 9am-10am.
 */
function dailyReviewTrigger() {
  MfcAiReviewService.generateDailyReview();
}

/**
 * Generates the monthly-review. Install as a Month timer trigger, day 1,
 * 9am-10am - reviews the month that just finished.
 */
function monthlyReviewTrigger() {
  MfcAiReviewService.generateMonthlyReview();
}

/**
 * ============================================================
 * PRICE GUARD: COMPUTE SUMMARY/HEALTH FROM PRODUCT ARRAY
 * (Avoids re-querying BigQuery when we already have the data)
 * ============================================================
 * Ported byte-for-byte from the original Price Guard Code.gs. Kept as
 * plain top-level functions (not inside a service object) to match
 * exactly where this logic lived in the source project; PriceGuardService
 * calls these directly on the array it reads from computed_daily_metrics_
 * (via PriceGuardMetricSnapshotService.getLatestMetricsSnapshot()).
 */

/**
 * Compute Price Guard dashboard summary cards from a pre-fetched
 * product metrics array.
 * @param {Array<Object>} data
 * @return {Object}
 */
function computePriceGuardSummaryFromProducts(data) {
  var totalRevenue = 0;
  var totalCost = 0;
  var revenueAtRisk = 0;
  var marginLeakage = 0;
  var opportunityTotal = 0;

  var greenCount = 0;
  var yellowCount = 0;
  var orangeCount = 0;
  var redCount = 0;

  data.forEach(function (p) {
    totalRevenue += (parseFloat(p.revenue_latest) || 0);
    totalCost += ((parseFloat(p.cost_price_today) || 0) * (parseFloat(p.quantity_sold_latest) || 0));
    revenueAtRisk += (parseFloat(p.revenue_at_risk) || 0);
    marginLeakage += (parseFloat(p.margin_leakage) || 0);

    if ((parseFloat(p.opportunity_score) || 0) > 50) {
      opportunityTotal += ((parseFloat(p.market_median_price) || 0) - (parseFloat(p.selling_price_today) || 0)) * (parseFloat(p.quantity_sold_latest) || 0);
    }

    var rs = parseFloat(p.risk_score) || 0;
    if (rs <= 30) greenCount++;
    else if (rs <= 60) yellowCount++;
    else if (rs <= 80) orangeCount++;
    else redCount++;
  });

  var grossProfit = totalRevenue - totalCost;

  // avg_margin_* fields are dashboard-wide rollups broadcast onto every
  // product row by the upstream dashboard_table join (not a per-product
  // value), so - same as the old avg_margin_latest field this replaced -
  // they're read once from the first row rather than averaged/summed
  // across all products.
  var first = data.length > 0 ? data[0] : {};
  var overallMargin = parseFloat(first.avg_margin_this_month) || 0;

  return {
    total_revenue: totalRevenue,
    gross_profit: grossProfit,
    overall_margin: overallMargin,
    revenue_at_risk: revenueAtRisk,
    margin_leakage: marginLeakage,
    opportunity_value: Math.max(0, opportunityTotal),
    avg_margin_this_month: parseFloat(first.avg_margin_this_month) || 0,
    avg_margin_last_month: parseFloat(first.avg_margin_last_month) || 0,
    avg_margin_this_week: parseFloat(first.avg_margin_this_week) || 0,
    avg_margin_last_week: parseFloat(first.avg_margin_last_week) || 0,
    avg_margin_this_month_losf1: parseFloat(first.avg_margin_this_month_losf1) || 0,
    avg_margin_last_month_losf1: parseFloat(first.avg_margin_last_month_losf1) || 0,
    avg_margin_this_week_losf1: parseFloat(first.avg_margin_this_week_losf1) || 0,
    avg_margin_last_week_losf1: parseFloat(first.avg_margin_last_week_losf1) || 0,
    avg_margin_this_month_mnlf1: parseFloat(first.avg_margin_this_month_mnlf1) || 0,
    avg_margin_last_month_mnlf1: parseFloat(first.avg_margin_last_month_mnlf1) || 0,
    avg_margin_this_week_mnlf1: parseFloat(first.avg_margin_this_week_mnlf1) || 0,
    avg_margin_last_week_mnlf1: parseFloat(first.avg_margin_last_week_mnlf1) || 0,
    alerts: {
      green: greenCount,
      yellow: yellowCount,
      orange: orangeCount,
      red: redCount,
      critical: redCount + orangeCount
    }
  };
}

/**
 * Compute Price Guard supplier health scorecards from a pre-fetched
 * product metrics array.
 * @param {Array<Object>} data
 * @return {Array<Object>}
 */
function computePriceGuardSupplierHealthFromProducts(data) {
  var supplierMap = {};

  data.forEach(function (p) {
    var s = p.supplier_name || 'Unknown Supplier';
    if (!supplierMap[s]) {
      supplierMap[s] = { name: s, count: 0, revenue: 0, profit: 0, totalRisk: 0 };
    }
    supplierMap[s].count++;
    supplierMap[s].revenue += (parseFloat(p.revenue_latest) || 0);
    supplierMap[s].profit += (parseFloat(p.gross_profit_latest) || 0);
    supplierMap[s].totalRisk += (parseFloat(p.risk_score) || 0);
  });

  return Object.keys(supplierMap).map(function (k) {
    var s = supplierMap[k];
    return {
      supplier_name: s.name,
      product_count: s.count,
      revenue: s.revenue,
      margin_pct: s.revenue > 0 ? (s.profit / s.revenue) : 0,
      health_score: Math.max(0, 100 - Math.round(s.totalRisk / s.count))
    };
  }).sort(function (a, b) { return a.health_score - b.health_score; });
}

/**
 * Compute Price Guard category health scorecards from a pre-fetched
 * product metrics array.
 * @param {Array<Object>} data
 * @return {Array<Object>}
 */
function computePriceGuardCategoryHealthFromProducts(data) {
  var categoryMap = {};

  data.forEach(function (p) {
    var c = p.category_level_1 || 'Uncategorized';
    if (!categoryMap[c]) {
      categoryMap[c] = { name: c, count: 0, revenue: 0, profit: 0, totalRisk: 0 };
    }
    categoryMap[c].count++;
    categoryMap[c].revenue += (parseFloat(p.revenue_latest) || 0);
    categoryMap[c].profit += (parseFloat(p.gross_profit_latest) || 0);
    categoryMap[c].totalRisk += (parseFloat(p.risk_score) || 0);
  });

  return Object.keys(categoryMap).map(function (k) {
    var c = categoryMap[k];
    return {
      category_name: c.name,
      product_count: c.count,
      revenue: c.revenue,
      margin_pct: c.revenue > 0 ? (c.profit / c.revenue) : 0,
      health_score: Math.max(0, 100 - Math.round(c.totalRisk / c.count))
    };
  }).sort(function (a, b) { return a.health_score - b.health_score; });
}



















































































