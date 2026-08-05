# Apps Script from zero — building a backend like this one, and why

This is a teaching document, not a reference sheet. It assumes you've never
opened Apps Script before. Every step says what to do *and* why, what the
alternatives were, and whether it's the only way — so you can rebuild this
from memory, and explain the reasoning to someone else, without needing to
look anything up.

Read it in order. Each part builds on the last.

---

## Part 0 — What Apps Script actually is

Apps Script is a hosted JavaScript runtime that Google runs for you. You
write functions; Google provides the server, the HTTPS endpoint, the auth,
and a handful of built-in services (`PropertiesService`, `CacheService`,
`UrlFetchApp`, and — if you enable it — `BigQuery`). There is no server to
provision, no Docker image, no `npm install express`, no hosting bill for
the compute itself.

**The trade you're making:** you give up control (you can't install
arbitrary npm packages, execution is capped — 6 minutes per run on a
personal account, longer on Workspace — and there's no persistent process
between requests) in exchange for zero infrastructure. Every function is
effectively a serverless function, and Google already wired up the HTTP
server and the Google-account auth plumbing for you.

**Why this project uses it instead of, say, a Node/Express app on Cloud
Run:** the alternative would need you to provision a server or container,
manage a service account + key for BigQuery access, set up Cloud Scheduler
for the daily job, and pay for hosting even when nobody's calling it. Apps
Script gives you all four of those (HTTP endpoint, BigQuery auth, cron,
free hosting) as built-in features, in exchange for the execution-time cap
and no custom dependencies. For a low-traffic internal tool reading
pre-aggregated data once a day, that trade is a clear win. For a
high-traffic public API needing custom npm packages or sub-second latency
at scale, it would be the wrong choice — know when to stop reaching for it.

**Two kinds of Apps Script project**, decide this before you start:
- **Container-bound** — created from inside a Google Sheet/Doc/Form
  (Extensions → Apps Script). Gets automatic access to `SpreadsheetApp`
  etc. Good for a script that only ever manipulates that one file.
- **Standalone** — its own project at script.google.com, not attached to
  anything. This is what you want for an API — there's no spreadsheet
  involved, it just talks to BigQuery and serves HTTP.

Go to **script.google.com → New project** now. That's a standalone
project. Rename it (top-left, "Untitled project") to something real.

---

## Part 1 — The smallest possible thing: prove the request/response loop

Before adding any complexity, prove the whole chain works: browser →
Google's servers → your function → back to the browser. Delete whatever's
in the default `Code.gs` file and write exactly this:

```js
function doGet(e) {
  return ContentService.createTextOutput('Hello world');
}
```

**Why `doGet` specifically?** Apps Script reserves that exact function
name: when a project is deployed as a "Web app" and someone sends an HTTP
GET request to its URL, Apps Script calls `doGet(e)` for you and sends
whatever it returns back as the HTTP response. There's a matching `doPost`
for POST requests. You don't register a route or start a listener — naming
the function `doGet` *is* the registration. This is Apps Script's version
of a router with exactly one possible route.

**Why `ContentService.createTextOutput(...)` and not just `return 'Hello
world'`?** A bare string return does nothing for a web app — Apps Script
needs an object that knows how to become an HTTP response (status code,
headers, body, content-type). `ContentService.createTextOutput()` builds
that object for you, defaulting to `text/plain`. This is the only way to
produce output a browser will render sensibly.

Now deploy it: **Deploy → New deployment → gear icon → Web app.** You'll
be asked two questions that matter a lot (full explanation in Part 7 — for
now, pick "Execute as: Me" and "Who has access: Anyone"). Click Deploy,
copy the URL it gives you, paste it into a browser tab.

You should see the literal text "Hello world". If you do, the entire loop
works — everything from here is additive complexity on top of a proven
foundation. If you don't: check you clicked **Deploy**, not just saved
(Ctrl+S/Cmd+S only saves the code — it does not affect what a deployed URL
serves; that link only refreshes on your NEXT deploy).

---

## Part 2 — Make it return JSON

A browser tab full of plain text isn't useful to a frontend app expecting
structured data. Change it:

```js
function doGet(e) {
  const data = { message: 'Hello world', timestamp: new Date().toISOString() };
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Why `JSON.stringify`?** `createTextOutput` takes a *string*, not an
object — Apps Script won't serialize it for you. `JSON.stringify` is
ordinary JavaScript, nothing Apps-Script-specific about it.

**Why `.setMimeType(ContentService.MimeType.JSON)`?** Without it, the
response is still labeled `text/plain`, even though the body is valid
JSON. Most things will still parse it fine, but it's a lie about what the
content actually is, and some HTTP clients behave differently based on
that header. Setting it correctly costs nothing and avoids a class of
subtle bugs later. Alternative: don't set it and get away with it most of
the time — not recommended, it's one line.

Redeploy (**Manage deployments → pencil icon → New version → Deploy** —
more on why this extra step exists in Part 7) and reload the URL. You
should see real JSON now.

---

## Part 3 — More than one operation: routing, verbs, and defensive errors

Real APIs do more than one thing. A web app deployment gives you exactly
**one URL** — so how do you expose multiple operations through it? Three
options exist:

1. One deployment per operation (a separate Apps Script project for every
   endpoint). Technically possible, operationally awful — you'd be
   managing dozens of URLs and redeploying constantly.
2. Read the intended operation out of the request yourself and dispatch to
   different code based on it. This is what every REST-ish API does — it's
   not an Apps Script convention, it's just how you write a router by hand
   when the platform doesn't hand you one.
3. Use `HtmlService` instead and let the browser drive multiple round
   trips through `google.script.run` — a real option, but a different
   architecture (covered in Part 8).

This project uses option 2 — a single `action` parameter that says which
operation to run:

```js
function api_getUserInfo() {
  return { email: Session.getActiveUser().getEmail() };
}

function api_ping() {
  return { pong: true, at: new Date().toISOString() };
}

const API_ROUTES = {
  getUserInfo: api_getUserInfo,
  ping: api_ping
};

function doGet(e) {
  const action = e.parameter.action;
  const fn = API_ROUTES[action];
  if (!fn) {
    return jsonResponse_({ error: true, message: 'Unknown or missing action.' });
  }
  try {
    return jsonResponse_(fn());
  } catch (err) {
    return jsonResponse_({ error: true, message: String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

Call it as `{url}?action=ping`.

**Why a lookup object (`API_ROUTES`) instead of a chain of `if
(action === 'x') ... else if (action === 'y')`?** Both work. The object is
preferred because: adding a new operation is a one-line addition (no
touching existing branches), there's no risk of one `if` accidentally
falling through to the next, and you can `Object.keys(API_ROUTES)` to
programmatically list every valid action if you ever need to (a debug
endpoint, or validation). It's a judgment call, not a rule — the `if`
chain isn't wrong, it's just harder to keep tidy as the list grows.

**Why wrap everything in `try/catch` and always return a JSON object, even
on failure?** If you let an exception escape `doGet` uncaught, Apps Script
returns its own default error page — an HTML page, not JSON. Your
frontend's `JSON.parse()` would then blow up trying to read HTML as JSON,
turning a clean "here's what went wrong" into a confusing secondary
crash. Catching every error and always returning `{error: true, ...}` in
the *same shape* your success responses use means the frontend only ever
has to check one thing (`if (data.error)`) — never guess whether it got
JSON or an HTML error page.

**GET vs POST — is this an Apps Script rule?** No. Apps Script treats
`doGet` and `doPost` identically in capability — the only real difference
is *where* the request data lives (`e.parameter` for GET's query string,
`e.postData.contents` — a raw string you must `JSON.parse` yourself — for
POST's body). The convention of "GET for reads, POST for writes" is a
general REST convention this project chose to follow, not something Apps
Script enforces. You could do everything through GET if you wanted to
(and plenty of quick internal tools do) — POST is preferred for writes
mainly because query strings show up in browser history/server logs,
which is a bad place for write payloads (or anything sensitive) to sit.

---

## Part 4 — Storing things: two different tools for two different needs

You'll eventually need to remember things between requests — a setting,
an API key, a cached result. Apps Script gives you two different stores,
and picking the wrong one is a common mistake.

**`PropertiesService`** — a key-value store that persists indefinitely
until you change it. Three scopes exist:
- `getScriptProperties()` — shared by everyone who calls this script.
  Use this for app-wide config and secrets (an API key the whole backend
  uses).
- `getUserProperties()` — private per Google account. Use for per-user
  preferences.
- `getDocumentProperties()` — container-bound projects only, scoped to
  that one Sheet/Doc.

```js
PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'abc123');
const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
```

**Why not just hardcode the key as a JS constant in your code?** Two
reasons. Security: if the project is ever shared with another editor, or
the source is ever viewed (e.g. through Deploy history), a hardcoded
secret is visible to anyone with read access to the code — Script
Properties are visible only in Project Settings, and not returned by any
endpoint unless you explicitly write code to expose them. Separation of
concerns: the same code can run with different secrets in different
copies of the project (a test project vs. production) without touching a
single line of code.

**`CacheService`** — also key-value, but temporary. Max TTL 6 hours
(21,600 seconds), and Google can evict entries early under memory
pressure — never rely on it being there.

```js
const cache = CacheService.getScriptCache();
cache.put('some_key', JSON.stringify(data), 300); // 5 minutes
const cached = cache.get('some_key');
```

**Why use this instead of just recomputing every time?** Performance and
cost. If an operation is expensive (a BigQuery query, an external API
call) and the result doesn't change second-to-second, caching it for a
few minutes means the 50th person to load a page in that window gets an
instant cached response instead of triggering the expensive work again.
**Why not use it for anything that must be reliably remembered** (like a
secret, or "has this user seen this notification")? Because it can vanish
at any time with no warning — that's the deal you make for it being fast
and requiring zero cleanup. If losing the value would actually break
something, it belongs in `PropertiesService` (or a real database), not
the cache.

---

## Part 5 — Talking to BigQuery

By default, Apps Script only has its built-in services. To call BigQuery,
you enable it explicitly: in the editor, click **Services** (+ icon) in
the left sidebar → find **BigQuery API** → Add. This exposes a global
`BigQuery` object shaped like BigQuery's own REST API. (You may also need
the BigQuery API enabled on the actual Google Cloud project in the GCP
console, and the identity running the script needs IAM permission to run
jobs there — this is a one-time setup step, not something you redo per
query.)

Here's the part that surprises people: you can't just "run a query and
get rows back" in one call.

```js
// 1. Start the query — this returns almost instantly, before the query has finished
const job = BigQuery.Jobs.insert(
  { configuration: { query: { query: 'SELECT 1', useLegacySql: false } } },
  'your-project-id'
);

// 2. Poll until it's done
let status;
do {
  Utilities.sleep(500);
  status = BigQuery.Jobs.get('your-project-id', job.jobReference.jobId).status;
} while (status.state !== 'DONE');

// 3. Now fetch the actual rows
const results = BigQuery.Jobs.getQueryResults('your-project-id', job.jobReference.jobId);
```

**Why this three-step dance instead of one call?** BigQuery is built for
queries that can scan terabytes and take minutes. Its API is
*asynchronous by design*: you submit a job and get a job ID back
immediately, then check on it, rather than the HTTP request itself
blocking until a slow query finishes. This project wraps that whole dance
once, in `BigQueryService.gs`'s `runQuery(sql)`, specifically so nothing
else in the codebase has to think about jobs/polling ever again — every
other file just calls `BigQueryService.runQuery(sql)` and gets an array
of row objects back.

**The bigger architectural question this raises: should every page load
run a BigQuery query live?** No — and this is the single most important
design decision in this whole backend. BigQuery queries cost money per
byte scanned and have real latency (hundreds of milliseconds to seconds).
If ten people open a dashboard and each triggers a live query, that's ten
queries, ten times the cost, ten times the wait. The fix: compute the
result **once**, on a schedule, and save it into a small "snapshot" table
that every page read then just does a plain cheap `SELECT * FROM
snapshot` against — no aggregation, no scanning the huge source table, at
read time. Every `_snapshot` table in this project exists for that one
reason. The cost is staleness (data is only as fresh as the last
scheduled rebuild) — acceptable here because business metrics don't need
to be real-time-fresh; it would be the wrong trade for something like a
live chat feature.

---

## Part 6 — Automating the rebuild: Triggers

You now have a function that rebuilds the snapshot tables. Something has
to call it every day without a human remembering to. Apps Script's
built-in answer is **Triggers** — its version of cron, with no
infrastructure to set up.

Editor → clock icon ("Triggers") in the left sidebar → **Add Trigger** →
choose the function to run → Event source: **Time-driven** → pick a type
(Day timer / Week timer / Month timer / specific date) and an hour window.

**Why not Cloud Scheduler + a Cloud Function instead?** That's the
"real" infrastructure equivalent, and it's strictly more powerful (more
precise timing, retries, monitoring) — but it requires a GCP project with
billing enabled, IAM configuration, and a second deployable thing to
maintain. A Trigger is a checkbox in a UI you're already using. For "run
this once a day," the extra power of Cloud Scheduler isn't worth the
extra moving parts — use it if you outgrow what Triggers can do, not
before.

**One real gotcha worth internalizing**: Apps Script does not guarantee
exact-minute execution or ordering between two triggers scheduled in the
same hour window. If one job's output feeds another (e.g. "rebuild the
data" must finish before "generate a report from that data" starts),
schedule the dependent one at least an hour later, not in the same
window — this project does exactly that (data pipelines at 8–9am, review
generation at 9–10am) specifically to dodge that race.

---

## Part 7 — Deployment, properly understood

Two settings you picked without explanation back in Part 1 — now the
real explanation, because they're security decisions, not formalities.

**"Execute as"**:
- **Me** — every Google API call the script makes (BigQuery, Gmail,
  whatever) runs under *your* Google identity, regardless of who called
  the URL. A caller with zero Google permissions of their own can still
  trigger a BigQuery query, because it's not running as them — it's
  running as you.
- **User accessing the web app** — Google API calls run as whoever is
  currently signed in and hit the URL. They'd need their own BigQuery
  permissions for anything to work.

This project uses **Me**, deliberately: the frontend calling this API is
a desktop app with no Google sign-in flow of its own for BigQuery access,
so "Execute as: User" would mean nothing works unless every user
individually had BigQuery IAM permissions — defeating the point of having
a shared backend at all.

**"Who has access"**:
- **Only myself** — only you (the developer) can call the URL at all.
- **Anyone with a Google account** — any signed-in Google user, no
  further permission check.
- **Anyone** — fully public, no Google sign-in required to even reach the
  endpoint.

This project uses **Anyone**, combined with **Execute as: Me** — meaning
literally anyone with the URL can call every endpoint, including writes,
running under your Google identity. That is a real, currently-unresolved
security gap in this project (there's no API key or auth check inside
`doGet`/`doPost` itself), acceptable only because the URL isn't public
knowledge and the stakes are low. **The fix, if you ever need one**: check
for a shared secret header/param at the very top of `handleApiRequest_`
and reject anything without it — nothing fancier is required for an
internal tool.

**Deployments vs. versions — the single most common gotcha.** Each
"Deploy → New deployment" mints a **brand new URL** with its own
deployment ID. Editing your code afterward does **not** change what that
existing URL serves — you have to go to **Manage deployments → pencil
icon on that deployment → Version: New version → Deploy**, which keeps
the *same* URL but updates the code behind it. If you ever see "Unknown
action" or a 404 for something you just added, this — forgetting to push
a new version to the deployment your app actually points at — is the
first thing to check.

There's also a **`/dev` URL** (visible in the deployment dialog), which
always reflects your latest *saved* code with zero deployment step —
useful for quick testing, but only accessible to project editors, never
suitable for a production frontend to depend on.

---

## Part 8 — Adding HTML on top (the road not taken here, and when to take it)

Everything above returns JSON, meant to be consumed by a separate
frontend (this project's is a React + Electron app). Apps Script has a
second, older mode: **render an actual webpage itself**, no separate
frontend needed at all.

```js
function doGet(e) {
  return HtmlService.createHtmlOutput('<h1>Hello from Apps Script</h1>');
}
```

Or, for a real project, put HTML in its own file (`index.html` in the
editor) and serve it:

```js
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index');
}
```

That HTML page can call back into your server-side functions directly,
without you writing any HTTP routing at all, via a special client-side
API Apps Script injects automatically:

```html
<script>
  google.script.run
    .withSuccessHandler(function (result) { console.log(result); })
    .api_getUserInfo();
</script>
```

**Why would you choose this over the JSON-API approach?** For a small,
internal, single-purpose tool — a form, a simple CRUD screen — this is
dramatically less work: no separate frontend project, no CORS
considerations, no build step, no hosting for the frontend. `Code.gs`'s
own header comment says exactly this happened to this project: *"The app
was converted from an HtmlService UI into a JSON REST API consumed by an
external React + Electron client."* It started as exactly the pattern
above.

**Why did it move away from that?** Once the frontend needed to be a real
desktop app (Electron) with a proper design system, client-side routing,
and reusable components across multiple pages, `HtmlService`'s templating
became the limiting factor — it's fine for one page, painful for a dozen
interconnected ones. At that point, JSON + a real frontend framework is
the better trade, even though it costs you the "no separate frontend to
build" simplicity.

**The rule of thumb**: if the whole tool is a handful of screens with no
complex client-side state, `HtmlService` alone can be your entire stack —
genuinely simpler, genuinely fewer moving parts. Once you need a real
frontend architecture (many pages, complex state, multiple developers
touching the UI, hot-reload dev experience), split it: Apps Script
becomes a pure JSON API (Parts 1–7 above), and a separate project owns
the UI.

---

## Part 9 — If you do split it: talking to this API from a browser-based frontend

One non-obvious wrinkle: `ContentService` responses don't include CORS
headers, and Apps Script gives you no way to add custom ones. A `fetch()`
from a webpage on a different origin can trip CORS preflight — but a
**"simple request"** (per the Fetch spec) skips the preflight check
entirely. This project's frontend sends POST bodies as `Content-Type:
text/plain` (not `application/json`) specifically to qualify as a simple
request, then `doPost` parses `e.postData.contents` as JSON regardless of
the declared content type:

```js
// Frontend: sent as text/plain to dodge CORS preflight
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'ping' })
});
```

This is a workaround, not a "correct" solution — it exists because
`ContentService` can't set CORS headers at all. If you're calling this
from Electron's main process (not a browser page) instead, this whole
problem disappears — Electron's main process isn't subject to CORS, only
in-browser/renderer-process `fetch` calls are.

---

## Part 10 — Decision log: every major choice, its alternative, and why

Use this as your cheat sheet while teaching — it's the "is that the only
way to do it" answer for every big decision above, in one place.

| Decision | Alternative(s) | Why this way |
|---|---|---|
| Apps Script at all | Node/Express on Cloud Run, Firebase Functions | Zero infra, free hosting, built-in BigQuery auth + cron, at the cost of execution-time caps and no custom npm packages |
| Standalone project | Container-bound (Sheet-attached) | No spreadsheet involved — this is a pure API |
| `action` param + router object | One deployment per operation; `if/else` chain; `HtmlService` + `google.script.run` | One URL for everything; object lookup is easy to extend and can't fall through wrong |
| Always catch errors, always return JSON | Let exceptions propagate to Apps Script's default error page | Frontend only ever has to check one shape, JSON parsing never breaks on an HTML error page |
| GET for reads / POST for writes | Everything through GET | Convention, not enforced by Apps Script — avoids write payloads sitting in URLs/logs |
| `PropertiesService` for secrets | Hardcoded constants in source | Not visible to anyone with read access to the code; swappable without code changes |
| `CacheService` for hot data | No caching; a real cache server (Redis) | Free and built-in, but can vanish anytime — never use for anything that must be reliably remembered |
| Pre-computed `_snapshot` tables | Query BigQuery live on every request | Live queries cost money and add latency per request; a snapshot is one cheap read regardless of traffic, at the cost of staleness |
| Triggers for scheduling | Cloud Scheduler + Cloud Function | Triggers are a checkbox, no billing/IAM setup; use Scheduler only if you outgrow Triggers' precision/retry guarantees |
| Dependent jobs staggered by an hour | Trust same-hour trigger ordering | Apps Script doesn't guarantee ordering between triggers in the same window |
| Execute as "Me" | Execute as "User accessing" | The frontend has no per-user Google sign-in for BigQuery; a shared identity is required for it to work at all |
| "Anyone" access, no in-app auth check | "Only myself" / "Anyone with Google account"; add a shared-secret header check | Simplest option for an internal tool with a non-public URL; flagged as a real gap to close if this ever needs to be locked down |
| JSON API + separate frontend | `HtmlService` renders the whole UI itself | Right call once the UI outgrows a handful of simple pages; `HtmlService` alone is genuinely simpler for small tools — don't reach for a separate frontend before you need one |
| `text/plain` POST body trick | Real CORS headers on the response | `ContentService` can't set custom response headers at all — this is a workaround forced by that limitation, not a best practice to reuse elsewhere if you have a choice |

---

## Part 11 — Errors you will definitely hit, and what they actually mean

- **"Exception: You do not have permission to call X"** — the script is
  trying to use a Google service (Gmail, BigQuery, etc.) it hasn't been
  authorized for yet. Run any function that touches it once from the
  editor; Apps Script will prompt you to authorize the scopes it needs.
- **`ReferenceError: BigQuery is not defined`** — the BigQuery Advanced
  Service isn't enabled for this project. Services (+) → BigQuery API →
  Add.
- **404 / "Unknown or missing action" on a thing you just added** — you
  saved the code but didn't push a new version to the deployment your
  app is actually calling (Part 7). Manage deployments → pencil → New
  version.
- **Response looks like JSON but the frontend chokes on it** — check the
  MIME type is actually set to JSON (Part 2), and check you didn't let an
  exception escape uncaught (Part 3) — some Apps Script error pages are
  HTML that *starts* with characters that can look deceptively like the
  start of something else in a quick glance.
- **A value you stored is just... gone** — you stored something in
  `CacheService` and either more than 6 hours passed or Google evicted it
  early. If it needs to survive reliably, it belongs in
  `PropertiesService`.
- **Trigger didn't run, or ran with old data** — check Executions (the
  clock-adjacent icon) for a failure log; also check whether a dependent
  trigger fired before the data it needed was ready (Part 6).
