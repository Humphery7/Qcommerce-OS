# Glovo QCommerce Hub

Cross-platform desktop app (React + Electron) for Glovo's QCommerce operations —
MFC, Groceries, and Retail — built on the [MFC Supplier Availability &
Recommendation REST API](../availability_rest_api).

## Stack

- **React 18** + **Vite** — UI and build tooling
- **Electron** — desktop shell (Windows/macOS/Linux)
- **React Router** (`HashRouter`, required since the built app loads from `file://`)
- **TanStack Query** — server state, caching, and mutations for the MFC API
- **Zustand** — small persisted client state (currently just the API URL)
- **Tailwind CSS** — styled from the design tokens in the Stitch design system
- **Recharts** — availability trend charts

## Project structure

```
electron/            Electron main process + preload script
src/
  api/                REST client, per-endpoint wrappers, React Query hooks
  app/                Cross-cutting config: workspaces.js, mfcTools.js
  components/
    layout/           Sidebar, TopNav, AppShell, WorkspaceLayout
    ui/                Reusable primitives: Button, DataTable, KpiCard, Modal, ...
    mfc/                MFC-specific chart/card components
  pages/
    home/              Hub home, Settings, Favorites, Recent, 404
    mfc/                MFC Overview, Dashboard, Suppliers, Recommendations, Prices
    groceries/          Groceries landing page (placeholder for future tools)
    retail/             Retail landing page (placeholder for future tools)
  store/               Zustand stores
  styles/              Tailwind entry + small custom CSS
```

Adding a new tool to an existing workspace means: one page component, one
route in `App.jsx`, one entry in that workspace's tool list
(`src/app/mfcTools.js` for MFC — copy the pattern for Groceries/Retail once
they have tools). Nothing else needs to change.

## First-time setup

```bash
npm install
```

## Running in development

```bash
npm run dev:electron
```

This starts the Vite dev server and an Electron window pointed at it, with
hot reload.

To run just the web UI in a browser (faster iteration on layout/styling):

```bash
npm run dev
```

## Connecting to the MFC API

On first launch, MFC screens will show a "not connected" prompt. Go to
**Settings** in the sidebar and paste your deployed Apps Script web app URL
(ends in `/exec`) — the same one produced by deploying the
`availability_rest_api` project. Click **Test Connection** to verify, then
**Save**. The URL is stored locally (`localStorage`) and reused across
restarts.

## Building installers

```bash
npm run build:win     # NSIS installer for Windows
npm run build:mac     # DMG for macOS
npm run build:linux   # AppImage + .deb for Linux
npm run build:electron  # current platform
```

Output lands in `release/`. Note: `electron-builder` needs to run on (or be
cross-compiling from) a machine with the right toolchain for each target —
building a `.dmg` generally requires macOS, for instance.

### App icon

`build/` is where `electron-builder` looks for platform icons
(`icon.ico`, `icon.icns`, `icon.png`). None are included yet — add them
before shipping installers, or `electron-builder` will fall back to its
default Electron icon.

## What's real vs. placeholder

- **MFC**: fully wired to the live REST API — Dashboard, Supplier Summary,
  Supplier Products drill-down, Recommendations, and Price Management (full
  CRUD) all call real endpoints with loading/error states.
- **Groceries / Retail**: landing pages only, as requested — no tools exist
  for these yet. The structure (workspace config + tool-list pattern) is
  ready to receive them without rework.
