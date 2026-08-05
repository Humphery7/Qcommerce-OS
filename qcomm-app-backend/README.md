# Supplier Performance Dashboard — Backend API

## Architecture

All data is **pre-computed daily at 8am** by `SnapshotService.runDailySnapshot()` and
stored in dedicated BigQuery snapshot tables. Every GET endpoint reads exclusively from
these pre-built tables — no source-table queries, no heavy joins, no aggregations at
read time.

### Snapshot schedule

```
dailySnapshotTrigger()  ──►  08:00 (time-driven trigger)
                                │
                     SnapshotService.runDailySnapshot()
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
  Core snapshots         Sub-snapshots         Clear cache
  (2 tables)             (11 tables)
```

15 snapshot tables are rebuilt daily in dependency order:
1. `supplier_summary_snapshot` — per-supplier product count, ordered/received, fill rate
2. `dashboard_snapshot` — single-row business-wide rollup
3. `availability_trend_snapshot` — monthly availability trend data
4. `dashboard_top_suppliers_snapshot` — top 10 by quantity ordered (monthly)
5. `dashboard_top_suppliers_weekly_snapshot` — top 10 by quantity ordered (weekly)
6. `dashboard_bottom_suppliers_snapshot` — bottom 10 by fill rate
7. `dashboard_product_loss_snapshot` — product availability loss (worst first)
8. `dashboard_weekly_snapshot` — single-row weekly rollup
9. `supplier_monthly_metrics_snapshot` — monthly metrics per supplier
10. `supplier_weekly_metrics_snapshot` — weekly metrics per supplier
11. `supplier_list_snapshot` — distinct supplier names (for dropdowns)
12. `products_for_supplier_snapshot` — all product performance, indexed by supplier
13. `supplier_prices_snapshot` — all user-maintained prices
14. `recommendations` — top 3 suppliers per product (weighted score)
15. `forecasting_products_snapshot` — full copy of `forecasting_products` (dataset `availability_and_ultrafresh`)
16. `mfc_category_sales_report_snapshot` — full copy of `mfc_category_sales_report` (dataset `mfcnigeria_analytics`)
17. `mfc_product_sales_report_snapshot` — full copy of `mfc_product_sales_report` (dataset `mfcnigeria_analytics`)
18. `orders_snapshot` — full copy of `orders` (dataset `mfcnigeria_analytics`)
19. `mfc_product_threshold_report_snapshot` — full copy of `mfc_product_threshold_report` (dataset `mfcnigeria_analytics`)

Two more (`matches_snapshot`, and the pending/history split of
`price_recommendations`) belong to the **Price Guard** migration below and
are rebuilt by their own independent daily pipeline, not by
`SnapshotService.runDailySnapshot()` — see that section for why.

### Write path (prices)

When a user adds/edits/deletes a price via POST, the source `supplier_prices` table is
updated, then both `supplier_prices_snapshot` and the `recommendations` table are
rebuilt immediately so reads always return current data without the write path
affecting read performance.

### GET endpoints

| Endpoint | Snapshot table | Cache TTL |
|---|---|---|
| `getDashboardData` | 10 tables (via DashboardService) | 5 min |
| `getSupplierSummary` | supplier_monthly/weekly_metrics_snapshot | 5 min |
| `getSupplierList` | supplier_list_snapshot | 5 min |
| `getProductsForSupplier` | products_for_supplier_snapshot | No cache (cheap filter) |
| `getAllPrices` | supplier_prices_snapshot | 60 sec |
| `getRecommendations` | recommendations | 5 min |
| `getForecastingProducts` | forecasting_products_snapshot | No cache (filtered) |
| `getForecastingFilterOptions` | forecasting_products_snapshot | 5 min |
| `getMfcCategorySalesReport` | mfc_category_sales_report_snapshot | No cache (filtered) |
| `getMfcProductSalesReport` | mfc_product_sales_report_snapshot | No cache (filtered) |
| `getMfcOrders` | orders_snapshot | 5 min |
| `getMfcProductThresholdReport` | mfc_product_threshold_report_snapshot | No cache (filtered) |
| `getMfcWbrReview` | Script Properties (`mfc_wbr_review_latest`) | n/a — read is instant |
| `getMfcDailyReview` | Script Properties (`mfc_daily_review_latest`) | n/a — read is instant |
| `getMfcMonthlyReview` | Script Properties (`mfc_monthly_review_latest`) | n/a — read is instant |
| `getPriceGuardDashboardData` | computed_daily_metrics + daily_alerts + matches_snapshot + price_recommendations_pending_snapshot (via PriceGuardService) | 5 min |
| `getPriceGuardDashboardSummary` | computed_daily_metrics | 5 min (shares the composite cache above only when called together; standalone calls are uncached - see note below) |
| `getPriceGuardProducts` | computed_daily_metrics | No cache (filtered) |
| `getPriceGuardCategoryHealth` | computed_daily_metrics | No cache |
| `getPriceGuardSupplierHealth` | computed_daily_metrics | No cache |
| `getPriceGuardAlerts` | daily_alerts | No cache (filtered) |
| `getPriceGuardMatches` | matches_snapshot | No cache (filtered) |
| `getPriceGuardSettings` | Script Properties (not BigQuery) | No cache |
| `getPriceGuardPendingRecommendations` | price_recommendations_pending_snapshot | 60 sec |
| `getPriceGuardRecommendationHistory` | price_recommendations_history_snapshot | 60 sec |
| `getPriceGuardProductMetrics` | computed_daily_metrics | No cache (single-SKU filter) |
| `getPriceGuardPipelineStatus` | Script Properties (not BigQuery) | No cache |

### New: forecasting & MFC Nigeria analytics endpoints

Two new services were added, both following the exact same architecture as
every existing service: **no GET endpoint ever queries a source table
directly.** SnapshotService copies the source table into a `_snapshot` table
once a day (or on demand via `runSnapshotNow`), and the service only ever
reads/filters that snapshot.

- **`ForecastingService.gs`** — reads `forecasting_products_snapshot`, a
  full daily copy of `forecasting_products` (dataset
  `availability_and_ultrafresh`, so no new dataset config was needed for
  it). This table answers "Are we ordering enough?".
  - `getForecastingProducts` takes an optional filter object
    `{warehouse, category, sku, search}` (all optional, combined with AND;
    `search` matches SKU or product name). Returns `{error, products, isEmpty}`.
  - `getForecastingFilterOptions` returns the distinct warehouse/category
    lists for the page's filter dropdowns: `{error, warehouses, categories}`.

- **`MfcAnalyticsService.gs`** — reads the four `_snapshot` tables in the
  new `mfcnigeria_analytics` dataset (`CONFIG.BQ_DATASET_MFC`, a dataset the
  app already has BigQuery access to via the same `dhub-glovo` project):
  `mfc_category_sales_report_snapshot`, `mfc_product_sales_report_snapshot`,
  `orders_snapshot`, and `mfc_product_threshold_report_snapshot`.
  - `getMfcCategorySalesReport` takes an optional `{category, search}` filter.
    Returns `{error, categories, isEmpty}`, each row split into `losf1` /
    `mnlf1` sub-objects alongside the overall figures.
  - `getMfcProductSalesReport` takes an optional `{category, sku, search}`
    filter (`search` matches SKU or the local product name). Returns
    `{error, products, isEmpty}`, same `losf1`/`mnlf1` shape per row.
  - `getMfcOrders` takes no arguments — `orders` is a single-row table, its
    snapshot read with `SELECT * ... LIMIT 1` the same way `DashboardService`
    reads `dashboard_snapshot`. Returns `{error, hasData, orders}` where
    `orders` is split into `total` / `losf1` / `mnlf1`, each with
    `{yesterday, currentWeek, lastWeek, monthToDate}`, plus
    `totalWeekRunRate` and `totalMonthRunRate`.
  - `getMfcProductThresholdReport` takes an optional `{category, sku, search}`
    filter (`search` matches SKU or the local product name). Returns
    `{error, products, isEmpty}` — each row has the shared fields
    (`sku`, `productNameLocal`, `categoryLevelOne`, `businessCategory`,
    `deliveredCurrentWeek`, `deliveredMonthToDate`, `weeklyThreshold`,
    `monthlyThreshold`, `weeklyThresholdMet`, `monthlyThresholdMet`) plus
    `losf1` / `mnlf1` sub-objects (`deliveredCurrentWeek`,
    `deliveredMonthToDate`, `weeklyThresholdMet`, `monthlyThresholdMet`).

**Snapshot pipeline:** `SnapshotService.runDailySnapshot()` now also rebuilds
`forecasting_products_snapshot`, `mfc_category_sales_report_snapshot`,
`mfc_product_sales_report_snapshot`, `orders_snapshot`, and
`mfc_product_threshold_report_snapshot` (step 6, after recommendations —
these five have no dependency on anything else, they're straight
`CREATE OR REPLACE TABLE ... AS SELECT *` copies of their source tables).
`_clearDependentCaches()` was extended to also clear
`forecasting_filter_options` and `mfc_orders` on every rebuild.

**Multi-dataset support:** `Utilities_.qualifiedTable(tableName, dataset)`
now takes an optional second argument (defaults to `CONFIG.BQ_DATASET`, so
every existing call site is unaffected) to reach a table in a different
dataset within the same project — used both to rebuild and to read
`CONFIG.BQ_DATASET_MFC` tables.

**Filter helpers:** `Utilities_.buildWhereClause()`, `Utilities_.equalsFilter()`,
and `Utilities_.searchFilter()` were added to `Utilities.gs` so every new
filtered endpoint builds its `WHERE` clause the same safe way (case-insensitive
match/LIKE, values escaped through the existing `escapeSqlString()`) without
duplicating that logic per service — same as `getProductsForSupplier`, these
filter the snapshot table at read time, not the source table.

### MFC AI intelligence: WBR-review, daily-review, monthly-review, Ask-AI

`GeminiService.gs` and `MfcAiReviewService.gs` add four AI features on top of
the existing MFC data, using the Gemini API free tier:

- **WBR-review** — generated Monday 9am, reviewing the week just finished,
  split by store (LOSF1/MNLF1) with highlights, lowlights, and recommended
  actions, grounded only in `MfcAnalyticsService`/`DashboardService` data
  (WoW growth, availability, delivered orders, threshold attainment). Read
  with `getMfcWbrReview` (instant, no Gemini call); force a regeneration
  with `generateMfcWbrReviewNow` (POST).
- **Daily-review** — same shape, generated daily 9am, using yesterday's
  absolute figures plus progress vs. the current week/run-rate instead of a
  WoW delta (the data has no day-over-day comparison, so the prompt is
  explicitly told not to invent one). Read with `getMfcDailyReview`; force
  with `generateMfcDailyReviewNow` (POST).
- **Monthly-review** — same shape again, generated on the 1st of the month,
  9am, reviewing the month that just ended, using month-to-date delivered
  orders against the monthly run rate and monthly threshold attainment
  (also no month-over-month percentage exists in the data, so the prompt is
  told not to invent one either — recent WoW movers are used only as
  supporting color). Read with `getMfcMonthlyReview`; force with
  `generateMfcMonthlyReviewNow` (POST).
- **Ask-AI** — grounded, multi-turn Q&A about the MFC business. `askMfcAi`
  (POST only) takes `{question, history}` where `history` is the full prior
  transcript (`[{role: 'user'|'model', text}]`) — this backend keeps no
  session state, the client resends it each call. Throttled to
  `MfcAiReviewService.ASK_AI_THROTTLE_PER_MINUTE` calls/minute to stay
  under the free tier's RPM ceiling.

**Time-range grounding.** Every field in the context (`yesterday`,
`currentWeek`, `monthToDate`, `delivered7d`, WoW figures, ...) is a relative
label, not a date — so `_buildContext_()` also attaches `asOfDate` (today's
actual date, computed in code via `_asOfDate_()`, never inferred by the
model) and `availabilityDataLastUpdated` (`dashboard_snapshot.last_updated`,
the one real freshness timestamp available anywhere in this data). Both the
review prompt and the Ask-AI prompt are told to interpret every relative
label against `asOfDate` and to flag rather than silently use availability
figures if `availabilityDataLastUpdated` looks more than 2 days stale.
**Known gap:** the 4 MFC-specific tables (category/product sales, orders,
threshold) carry no snapshot timestamp of their own — they're straight
`SELECT *` copies in `SnapshotService.gs` with no timestamp column added —
so their freshness isn't independently verifiable at generation time; it
relies on `SnapshotService.runDailySnapshot()` having actually run that
morning before the review trigger fires 1 hour later.

All three review triggers run **9am-10am**, one hour after
`dailySnapshotTrigger`/`priceGuardDailyPipelineTrigger`'s 8am-9am window —
Apps Script doesn't guarantee ordering between two triggers scheduled in the
same hour, so this gives the review generation a safety margin to read that
day's freshly rebuilt snapshots rather than racing them.

**Setup required before these work:**
1. Get a free API key at https://aistudio.google.com/apikey.
2. In the Apps Script editor: Project Settings → Script Properties → add
   `GEMINI_API_KEY` = your key. Never put it in `Code.gs`/`CONFIG` — it isn't a secret
   store, this project is deployed with "Anyone" access.
3. Add three more time-driven triggers (Triggers → Add Trigger), alongside
   `dailySnapshotTrigger`/`priceGuardDailyPipelineTrigger`:
   - `weeklyWbrReviewTrigger` — Week timer → Monday → 9am-10am
   - `dailyReviewTrigger` — Day timer → 9am-10am
   - `monthlyReviewTrigger` — Month timer → day 1 → 9am-10am
4. `CONFIG.GEMINI_MODEL` defaults to `'gemini-flash-latest'` (Google's alias for the
   current stable Flash model — Flash model ids have churned quickly, e.g. 2.0 Flash
   retired March 2026). If Gemini calls start failing with a model-not-found error,
   check https://ai.google.dev/gemini-api/docs/models for the current alias/id.

**POST examples:**
```json
{ "action": "generateMfcWbrReviewNow" }
{ "action": "generateMfcMonthlyReviewNow" }
{ "action": "askMfcAi", "params": { "question": "How is MNLF1 doing this week?", "history": [] } }
```

### New: Price Guard (competitive pricing intelligence)

Migrated from a separate, standalone Price Guard Apps Script project (its own
`Code.gs`/`BigQueryService.gs`/etc., a different BigQuery dataset in the same
`dhub-glovo` project). Every `PriceGuard*.gs` file in this repo corresponds
1:1 to a file in that source project — see the header comment at the top of
each for exactly what it ported and what (if anything) changed.

**Where the data comes from.** `dashboard_table` is a single BigQuery table
an *external* job already joins `internal_products` with all four competitor
price feeds (SPAR, SuperSaver, Mano, Chowdeck) into — this backend never
writes it, only reads it, and only from one place:
`PriceGuardMetricService.getComputedData()`, called once a day from the
snapshot job. `competitor_table_matches` is the Python matching engine's
output table — also externally managed, also never written here.

**The daily pipeline** (`PriceGuardSnapshotService.runDailyPipeline()`,
mirrors the original project's `executeDailyPipeline_()` step-for-step):
1. Schema bootstrap (`PriceGuardSchemaService.ensureTablesExist()`)
2. Refresh internal catalog — no-op, externally managed
3. Ingest partner competitors — no-op, externally managed
4. Dispatch the Mano/Chowdeck scraper GitHub Actions workflow (best-effort)
5. Compute + persist `computed_daily_metrics` (margins, price index,
   competitor gap, risk score, opportunity score — all the per-product math
   lives in `PriceGuardMetricService.gs`, unchanged from the source)
6. Compute + persist `daily_alerts` (rule-based anomaly detection against
   configurable thresholds — `PriceGuardAnomalyService.gs`, unchanged)
6.5. Rebuild `matches_snapshot` and the `price_recommendations` pending/
   history snapshots (new — see below)
7. Send the daily HTML email digest, if enabled in settings

This runs on its **own** daily trigger (`priceGuardDailyPipelineTrigger`,
see Deploying below) — deliberately kept separate from
`dailySnapshotTrigger`/`SnapshotService.runDailySnapshot()`, since it's an
unrelated app with its own schedule, failure semantics, and step report
shape. `computed_daily_metrics` and `daily_alerts` already carried their own
`snapshot_date` column in the source project (queried filtered to
`MAX(snapshot_date)`), so they kept their original names here instead of
being renamed to `_snapshot` — they already behave exactly like every other
snapshot table in this backend.

**What's new in this migration** (beyond a straight file-for-file port):
- **`matches_snapshot`** — the original queried `competitor_table_matches`
  live on every `getMatches()` call. It's now a daily copy, read by
  `PriceGuardMatchingService.getMatches()` instead, same pattern as
  `forecasting_products_snapshot`.
- **`price_recommendations_pending_snapshot` /
  `_history_snapshot`** — the original filtered the live
  `price_recommendations` table by `status` on every read. Split into two
  snapshots instead, rebuilt immediately after every write (submit/approve/
  reject) — same pattern as `supplier_prices_snapshot`.
- **`BigQueryService.insertRows()` / `.overwriteRows()`** — added to the
  shared `BigQueryService.gs` (streaming insert, batched at 500 rows, plus
  truncate-then-insert). Needed because `computed_daily_metrics` /
  `daily_alerts` rows are computed in Apps Script memory, not derived from a
  BigQuery source query — every other snapshot in this backend is a
  `CREATE OR REPLACE TABLE ... AS SELECT`, which doesn't apply here.
- **Two pre-existing bugs in the source project, fixed (not silently — see
  the "Not yet decided" list below for the one still outstanding):**
  `BigQueryService.runParameterizedQuery()` was called by
  `PricingActionService.gs` but never defined anywhere in that project
  (`getProductMetrics`, `approveRecommendation`, `rejectRecommendation`
  would all have thrown at runtime); and `Code.gs` called
  `PricingActionService.approveRecommendations(ids)` (plural, bulk) but only
  the singular `approveRecommendation(id)` was ever exported (the bulk-
  approve button in the source UI would have thrown). Both are implemented
  properly in `PriceGuardPricingActionService.gs`.

## Deploying
Same as any Apps Script web app: Deploy → New deployment → Web app → Execute as "Me",
Who has access "Anyone". Redeploy (new version) after pasting these files in.

Set up a daily time-driven trigger in the Apps Script editor:
- **Function**: `dailySnapshotTrigger`
- **Time source**: Time-driven
- **Frequency**: Day timer → 8am to 9am

Set up a **second, independent** daily trigger for Price Guard (its own
pipeline, its own schedule — matching the original standalone project):
- **Function**: `priceGuardDailyPipelineTrigger`
- **Time source**: Time-driven
- **Frequency**: Day timer → 8am to 9am (WAT, matching the source project's
  original schedule)

Set up three more triggers for the MFC AI reviews (see "MFC AI intelligence"
above for why these run an hour after the two above):
- **Function**: `weeklyWbrReviewTrigger` — Time-driven → Week timer → Monday → 9am to 10am
- **Function**: `dailyReviewTrigger` — Time-driven → Day timer → 9am to 10am
- **Function**: `monthlyReviewTrigger` — Time-driven → Month timer → day 1 → 9am to 10am

## Calling it from React/Electron

If you're on a **Google Workspace domain** (e.g. `@glovoapp.com`), prefix the URL with your domain:

```
https://script.google.com/a/macros/{YOUR_DOMAIN}/s/{DEPLOYMENT_ID}/exec?action=getDashboardData
```

For personal / non-Workspace accounts, use the standard URL:

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?action=getDashboardData
```

**GET** (read endpoints):
```
GET .../exec?action=getDashboardData
GET .../exec?action=getSupplierSummary
GET .../exec?action=getSupplierList
GET .../exec?action=getProductsForSupplier&supplierName=Acme
GET .../exec?action=getAllPrices
GET .../exec?action=getRecommendations

GET .../exec?action=getForecastingProducts&warehouse=Lagos&category=Dairy&search=milk
GET .../exec?action=getForecastingFilterOptions
GET .../exec?action=getMfcCategorySalesReport&category=Snacks
GET .../exec?action=getMfcProductSalesReport&sku=ABC123&search=milk
GET .../exec?action=getMfcOrders
GET .../exec?action=getMfcProductThresholdReport&category=Snacks&search=milk

GET .../exec?action=getMfcWbrReview
GET .../exec?action=getMfcDailyReview
GET .../exec?action=getMfcMonthlyReview

GET .../exec?action=getPriceGuardDashboardData
GET .../exec?action=getPriceGuardDashboardSummary
GET .../exec?action=getPriceGuardProducts&category=Snacks&search=oats
GET .../exec?action=getPriceGuardCategoryHealth
GET .../exec?action=getPriceGuardSupplierHealth
GET .../exec?action=getPriceGuardAlerts&severity=critical
GET .../exec?action=getPriceGuardMatches&sku=940XRK
GET .../exec?action=getPriceGuardSettings
GET .../exec?action=getPriceGuardPendingRecommendations
GET .../exec?action=getPriceGuardRecommendationHistory
GET .../exec?action=getPriceGuardProductMetrics&sku=940XRK
GET .../exec?action=getPriceGuardPipelineStatus
```

**POST** (write endpoints, JSON body):
```
POST .../exec
{ "action": "addOrUpdatePrice", "params": { "sku": "...", "productName": "...", "supplierId": "...", "supplierName": "...", "tradePrice": 12.5 } }

POST .../exec
{ "action": "deletePrice", "params": { "sku": "...", "supplierId": "..." } }

POST .../exec
{ "action": "runSnapshotNow" }

POST .../exec
{ "action": "approvePriceGuardMatch", "params": { "sku": "940XRK", "competitor": "mano" } }

POST .../exec
{ "action": "savePriceGuardManualOverride", "params": { "sku": "940XRK", "competitor": "spar", "name": "Quaker Oats 900g", "price": 13500, "explanation": "Manually matched" } }

POST .../exec
{ "action": "triggerPriceGuardRematch", "params": { "sku": "940XRK" } }

POST .../exec
{ "action": "savePriceGuardSettings", "params": { "thresholds": { "price_spike_warning": 0.2 }, "notifications": { "email_recipients": "you@company.com", "send_daily_summary": true } } }

POST .../exec
{ "action": "submitPriceGuardRecommendation", "params": { "product_sku": "940XRK", "action_type": "price_decrease", "current_price": 14000, "recommended_price": 13500, "reason": "Undercut by SPAR" } }

POST .../exec
{ "action": "approvePriceGuardRecommendation", "params": { "id": "..." } }

POST .../exec
{ "action": "approvePriceGuardRecommendations", "params": { "ids": ["...", "..."] } }

POST .../exec
{ "action": "rejectPriceGuardRecommendation", "params": { "id": "..." } }

POST .../exec
{ "action": "runPriceGuardDailySync" }

POST .../exec
{ "action": "runPriceGuardSnapshotNow" }
```

Every response is JSON with an `error` boolean, matching what the old `gsRun()` wrapper
in JavaScript.html already checked for — so the response *shape* your data layer expects
hasn't changed, only the transport (HTTP fetch instead of `google.script.run`).

## Not yet decided (flagged, not guessed)
- No auth check is enforced beyond Apps Script's own "Anyone" access — anyone with the
  deployment URL can call every endpoint, including the write ones. Fine for now per your
  instruction; revisit if this ever needs to be locked down (e.g. a shared key in a custom
  header, checked in `handleApiRequest_`).
- CORS: Apps Script's `ContentService` doesn't set CORS headers. This is fine for
  requests made from Electron's main process or a `fetch` that isn't browser-CORS-restricted;
  if you ever load the React UI in a plain browser tab pointed at a different origin, you may
  hit CORS errors and need a workaround (Apps Script doesn't support custom response headers
  easily — worth a separate conversation if/when it comes up).
- **Price Guard match approvals don't affect the match queue read, and this is
  preserved from the source app, not fixed.** `approvePriceGuardMatch` /
  `savePriceGuardManualOverride` / `triggerPriceGuardRematch` write to
  `product_matches` (the manual override/approval store). `getPriceGuardMatches`
  reads `matches_snapshot`, a copy of `competitor_table_matches` (the Python
  matching engine's separate output table) — the two were never joined in the
  original app either. Whatever external process reconciles `product_matches`
  into `competitor_table_matches` (if anything does) is outside this
  migration's visibility. Worth confirming with whoever owns the Python
  matching engine before this ships to end users, since right now an
  "approved" match may not visibly change in the UI.
- **Price Guard settings defaults were sanitized, not ported verbatim.** The
  source project's `SettingsService.gs` had a real person's personal email
  hardcoded as the default `notifications.email_recipients`, and a placeholder
  GitHub repo path (`owner/price-guard-pipeline`) as the default `github.repo`.
  Both default to empty strings in `PriceGuardSettingsService.gs` instead —
  set real values via `savePriceGuardSettings` once deployed.
- **Price Guard's `submitRecommendation` still calls
  `Session.getActiveUser().getEmail()`** for `requested_by`, unchanged from the
  source app. With the web app deployed as `executeAs: "USER_DEPLOYING"` /
  `access: "ANYONE_ANONYMOUS"` (this repo's existing `appsscript.json`), that
  call typically returns an empty string for anonymous callers — same
  limitation the source project had. If the React app needs a real submitter
  identity, it'll need to be passed in the request payload instead.
