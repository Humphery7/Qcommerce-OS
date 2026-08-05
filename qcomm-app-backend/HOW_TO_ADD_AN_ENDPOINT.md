# How to add a new endpoint

A step-by-step walkthrough of this backend's established pattern, using a
hypothetical **`getWeightedAvailability`** endpoint as the running example —
a new metric split by category and by store (LOSF1/MNLF1), same shape as
the existing MFC sales reports. Swap the names for whatever you're actually
adding.

The rule that shapes every step below: **no GET endpoint ever queries a
source table directly.** Every read goes through a pre-built `_snapshot`
table, rebuilt once a day by `SnapshotService.runDailySnapshot()`. This
keeps every page load cheap (a plain `SELECT`, no joins/aggregations at
read time) at the cost of data being up to a day old — acceptable for
everything in this app so far.

---

## 1. Create the table(s) in BigQuery

Decide two things first:
- **Dataset**: reuse an existing one (`availability_and_ultrafresh`,
  `mfcnigeria_analytics`, `price_guard`) if the new data is conceptually
  part of that domain, or create a new dataset if it's genuinely new. Weighted
  availability is MFC Nigeria data, so it belongs in `mfcnigeria_analytics`
  alongside `mfc_category_sales_report` etc.
- **Source table name**: `mfc_weighted_availability` — whatever job/pipeline
  populates the raw numbers writes here. If nothing populates it yet, that's
  step 0 before any of this matters (either an external pipeline, or a
  BigQuery scheduled query you write yourself).

Example shape (mirrors the existing category sales table — one row per
category, overall + per-store):

```
mfc_weighted_availability
├─ product_category_level_one   STRING
├─ weighted_availability        FLOAT64   -- overall, 0-1
├─ losf1_weighted_availability  FLOAT64
├─ mnlf1_weighted_availability  FLOAT64
└─ snapshot_date                DATE
```

You do **not** create the `_snapshot` table by hand — step 3 does that via
`CREATE OR REPLACE TABLE`, the same way every other snapshot table in this
backend is built.

---

## 2. Register the table names in `CONFIG` (`Code.gs`)

Add both the source and snapshot names to `CONFIG.MFC_TABLES` (or
`CONFIG.TABLES` / a new map, matching whichever dataset you picked):

```js
MFC_TABLES: {
  // ...existing entries...
  WEIGHTED_AVAILABILITY: 'mfc_weighted_availability',
  WEIGHTED_AVAILABILITY_SNAPSHOT: 'mfc_weighted_availability_snapshot'
},
```

If this were a brand-new dataset (not the case here), you'd also add a
`CONFIG.BQ_DATASET_X` constant, mirroring `BQ_DATASET_MFC` /
`BQ_DATASET_PRICE_GUARD`.

---

## 3. Add the snapshot rebuild step (`SnapshotService.gs`)

Write a private rebuild function next to the other MFC ones:

```js
/**
 * Straight copy of mfc_weighted_availability into its _snapshot table.
 */
_rebuildMfcWeightedAvailabilitySnapshot: function () {
  const src = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.WEIGHTED_AVAILABILITY, CONFIG.BQ_DATASET_MFC);
  const tgt = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.WEIGHTED_AVAILABILITY_SNAPSHOT, CONFIG.BQ_DATASET_MFC);
  BigQueryService.runQuery(
    'CREATE OR REPLACE TABLE ' + tgt + ' AS ' +
    'SELECT * FROM ' + src
  );
},
```

(If the metric needs real aggregation rather than a straight copy — e.g.
computing a weighted average from a lower-level table — this is where that
SQL goes, same as `_rebuildSupplierSummarySnapshot`'s `GROUP BY` query.)

Then call it from `runDailySnapshot()`, in the "no dependencies, straight
copy" section alongside the other MFC snapshots:

```js
SnapshotService._rebuildMfcCategorySalesReportSnapshot();
SnapshotService._rebuildMfcProductSalesReportSnapshot();
SnapshotService._rebuildMfcWeightedAvailabilitySnapshot();   // <- new
```

If your read function will cache its response (step 4), add that cache key
to `_clearDependentCaches()` so a snapshot rebuild invalidates it:

```js
_clearDependentCaches: function () {
  CacheService.getScriptCache().removeAll([
    'dashboard_data', 'supplier_summary_combined', 'supplier_list',
    'supplier_prices', 'recommendations',
    'forecasting_filter_options', 'mfc_orders',
    'weighted_availability'   // <- new
  ]);
},
```

---

## 4. Write the read-side service file

New file, `WeightedAvailabilityService.gs` — one exported object, reads only
from the snapshot table, maps snake_case BigQuery columns to camelCase JS.
Follow `MfcAnalyticsService.gs`'s shape exactly:

```js
const WeightedAvailabilityService = {
  /**
   * Returns mfc_weighted_availability_snapshot rows, optionally filtered
   * by category.
   * @param {Object} filters {category, search}
   * @return {Object}
   */
  getWeightedAvailability: function (filters) {
    const f = filters || {};
    const table = Utilities_.qualifiedTable(CONFIG.MFC_TABLES.WEIGHTED_AVAILABILITY_SNAPSHOT, CONFIG.BQ_DATASET_MFC);

    const where = Utilities_.buildWhereClause([
      Utilities_.equalsFilter('product_category_level_one', f.category),
      Utilities_.searchFilter(['product_category_level_one'], f.search)
    ]);

    const sql =
      'SELECT * FROM ' + table + ' ' +
      where +
      'ORDER BY weighted_availability DESC';

    const rows = BigQueryService.runQuery(sql);
    const categories = rows.map(WeightedAvailabilityService._mapRow);

    return {
      error: false,
      categories: categories,
      isEmpty: categories.length === 0
    };
  },

  /**
   * @param {Object} r
   * @return {Object}
   * @private
   */
  _mapRow: function (r) {
    return {
      categoryLevelOne: Utilities_.toSafeString(r.product_category_level_one),
      weightedAvailability: Utilities_.toNumber(r.weighted_availability),
      losf1: Utilities_.toNumber(r.losf1_weighted_availability),
      mnlf1: Utilities_.toNumber(r.mnlf1_weighted_availability)
    };
  }
};
```

Only add caching (`Utilities_.getCache`/`setCache`, like `getMfcOrders`) if
this is an **unfiltered, read-the-whole-thing** endpoint. Filtered
list endpoints (like this one, and `getMfcCategorySalesReport`) skip caching
since the filter combinations make it not worth it — filtering an
already-small in-memory snapshot is cheap.

---

## 5. Wire it into `Code.gs`

**a. `api_*` wrapper** — same try/catch → `Utilities_.buildErrorResponse`
pattern as every other endpoint:

```js
/**
 * Returns mfc_weighted_availability rows, optionally filtered by category.
 * @param {Object} filters {category, search}
 * @return {Object}
 */
function api_getWeightedAvailability(filters) {
  try {
    return WeightedAvailabilityService.getWeightedAvailability(filters);
  } catch (err) {
    return Utilities_.buildErrorResponse(err, 'api_getWeightedAvailability');
  }
}
```

**b. Register the action** in `API_ROUTES`:

```js
const API_ROUTES = {
  // ...existing entries...
  getWeightedAvailability: api_getWeightedAvailability,
};
```

**c. If it takes filter params**, add a case to `resolveActionArgs_` (reuse
the existing "filter object" case if there's already one for similarly-
shaped endpoints):

```js
case 'getForecastingProducts':
case 'getMfcCategorySalesReport':
case 'getMfcProductSalesReport':
case 'getMfcProductThresholdReport':
case 'getWeightedAvailability':   // <- new
  return [Object.keys(bodyParams).length ? bodyParams : queryParams];
```

(Endpoints with no params — like `getMfcOrders` — need no case at all; the
`default: return [];` branch already handles them.)

---

## 6. Update `README.md`

Add a row to the GET endpoints table, an entry to the GET examples list,
and a short paragraph under the relevant "New: X" section describing what
it returns and its filter/cache behavior — same as every prior addition in
that file. Future-you (or me, next session) has no other way to know this
endpoint exists without re-reading all the code.

---

## 7. Deploy

**Redeploy** — this is the step people forget, and it's the #1 cause of
"why am I getting 404 / unknown action" after adding something new:

Apps Script editor → **Deploy → Manage deployments** → pencil icon on the
existing Web app deployment → **Version: New version** → Deploy. This keeps
the same `/exec` URL and just updates what code runs behind it. Do **not**
use "Deploy → New deployment" for this — that mints a different URL, and
the app's Settings would still point at the old one.

**Populate the snapshot for the first time** — `runDailySnapshot()` won't
run again until the next scheduled trigger, so the new snapshot table
doesn't exist yet. Either:
- Run `dailySnapshotTrigger` (or `SnapshotService.runDailySnapshot`)
  manually once from the Apps Script editor's function dropdown, or
- Call the existing `runSnapshotNow` action (POST), which does the same
  thing and is already wired into the app's UI on some pages.

---

## 8. Test before wiring the frontend

Two ways, fastest first:

1. **In the Apps Script editor**: select `api_getWeightedAvailability` in
   the function dropdown → Run → check the Execution log / Script
   Properties for the shape of what came back. No deployment needed for
   this one — it tests the code directly.
2. **Against the deployed URL** (proves the actual HTTP route works):
   ```
   GET {your /exec URL}?action=getWeightedAvailability
   GET {your /exec URL}?action=getWeightedAvailability&category=Beverages
   ```
   Paste into a browser or Postman — should return
   `{"error":false,"categories":[...],"isEmpty":false}`.

---

## 9. Wire the frontend (`glovo-qcommerce-hub/src/api/mfc.js`)

**a. Add to `mfcApi`:**
```js
getWeightedAvailability: (filters) => apiGet('getWeightedAvailability', filters),
```

**b. Add a hook**, same `useQuery` convention as every other read hook in
that file:
```js
export function useWeightedAvailability(filters) {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'weightedAvailability', filters],
    queryFn: () => mfcApi.getWeightedAvailability(filters),
    enabled,
    staleTime
  });
}
```

**c. Build the UI** — a `Section` + panel component on whichever page makes
sense, following the existing patterns (`CategorySalesPanel.jsx` is the
closest analog for this particular example: chart + legend, store selector
via `PeriodToggle` if you want the same Overall/LOSF1/MNLF1 split).

---

## 10. Verify end-to-end

- Syntax-check every edited/new `.gs` file before pasting into the Apps
  Script editor (copy to a `.js` file locally and run `node --check`,
  since `.gs` files are plain ES6/V8 JS underneath).
- `npm run build` (or `vite build`) on the frontend to catch import/syntax
  errors.
- Click through the actual page in the running app — a successful build
  proves the code compiles, not that the feature works.
