# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TodoOficios.es is a Spanish-language directory/marketplace for skilled-trade professionals (fontaneros, electricistas, albañiles, cerrajeros, reformistas, etc.) in Spain — comparable to Airbnb but for hiring tradespeople. It is a **static, no-build website**: plain HTML/CSS/JS pages deployed as-is, no bundler, no framework, no compile step. The only Node.js code in the repo is a small standalone bot script for generating blog drafts (see below) — it is not part of the deployed site.

## Running it locally

There is no dev server script checked into `package.json`. To preview pages, serve the repo root as static files, e.g.:

```bash
python3 -m http.server 8791
```

A Windows/PowerShell static server is also provided at `.claude/static-server.ps1` (used with `.claude/launch.json`, which points a preview browser at `http://localhost:8791`).

**The site currently gates itself into "coming soon" mode** (see Construction/preview mode below) — visiting `/` locally will bounce to `proximamente.html` unless you append `?preview=toc-construccion-2026` once (it then sets a 30-day localStorage flag).

### Blog draft bot

```bash
npm install
npm run generate-blog-post
```

Requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in the environment. This is normally run on a schedule by `.github/workflows/weekly-blog-post.yml` (Mondays) or manually via that workflow's "Run workflow" button — see `README-BLOG.md` for the full setup/publish flow. It always writes drafts (`status: 'draft'`); nothing is ever auto-published.

There is no linter, formatter, or test suite configured in this repo. Verify HTML/JS changes by opening the page in a browser.

## Architecture

### Pages

- **`index.html`** — the main application. A single ~5300-line file: static markup/CSS in the `<head>`/`<body>`, followed by one large inline `<script>` (starting ~line 1326) that implements the entire client-side app as a hand-rolled SPA.
- **`calculadoras.html` + `calculadoras.js`** — a self-contained "90+ calculators" tool (electricity, construction materials, paint, flooring, plumbing, geometry/unit conversion). Independent of `index.html`'s router; owns its own `GRUPOS`/`CATEGORIAS` data and its own category-based navigation.
- **`blog.html`** — renders published posts from Supabase (see Blog below). No router of its own.
- **`proximamente.html`** — "coming soon" landing page shown while the site is gated (see below).
- **Legal/static pages** — `aviso-legal.html`, `politica-privacidad.html`, `politica-cookies.html` are plain content pages.
- Every page pulls its Supabase URL/keys and other public settings from `legal-config.js`, and pages that talk to Supabase load `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` from the CDN (no local install).

### `index.html`'s internal app (the important part)

The inline script is organized into named regions marked with `/* ======================= NAME ======================= */` banners — grep for these to navigate the file instead of scrolling. In order, the main ones are: taxonomía de oficios (trade categories), epígrafes IAE (fiscal advisor codes), storage helpers, geolocalización, cuentas (accounts), reseñas (ratings), estado global, promoción de lanzamiento, panel de negocio (gastos/clientes/presupuestos/agenda), calendario fiscal, login con Google, router, and one region per view (`VISTA: SOY PROFESIONAL`, `VISTA: PANEL DE NEGOCIO`, `VISTA: APP MÓVIL`, `VISTA: BUSCAR`, `VISTA: DETALLE`).

**Router**: there's no URL-based routing. `showView(name)` toggles `.active` on `<section class="view" id="view-<name>">` elements (`home`, `pro`, `negocio`, `app`, `client`, `course-providers`, `buscar`, `detalle`) and calls a matching `render<Name>()` / `bind<Name>()` pair that builds the section's `innerHTML` and wires its event listeners. Clicks anywhere on elements with `data-view="<name>"` invoke it via a single delegated listener on `document.body`.

**Storage**: all persistence goes through `safeGet(key, shared)` / `safeSet(key, value, shared)` / `safeDelete(key, shared)` (built on `getStorageApi()`). This is a dual-backend abstraction:
- `shared=false` (default) → browser `localStorage`, per-device only.
- `shared=true` → Supabase table `kv_store` (namespace `todooficios:v1`), used for anything that must be visible across devices/sessions (accounts, business panel data, ratings, contact messages...) — but only when `hasCloudConfig()` finds real Supabase credentials in `legal-config.js` (i.e. not the `PENDIENTE_...` placeholder values); otherwise it silently falls back to `localStorage`.

When adding a new persisted field, use these helpers rather than calling `localStorage`/`supabase` directly, so local-only and cloud-configured deployments both keep working. Note `calculadoras.js` is an exception: it reads a couple of keys (`session-email`, `presupuesto-draft:<email>`) straight out of `localStorage` to interoperate with `index.html`'s session — if you rename those keys in `index.html`, update `calculadoras.js` too.

**Global state** (`ESTADO GLOBAL` region): `session`/`account` (professional), `clientSession`/`clientAccount` (client), `negocio` (the logged-in pro's business panel data), `materialesFavoritos` (saved materials list, shared key with `calculadoras.html`), plus assorted UI-mode flags — all plain module-level `let`s, not a framework store.

**Feature flags**: `PAYMENTS_ENABLED = false` currently hides real PayPal checkout; `PROMO_FREE_PRO_LIMIT` caps a launch promo. Check these constants (`ESTADO GLOBAL` / `PROMOCIÓN DE LANZAMIENTO` regions) before assuming a payment/paid feature is actually reachable.

### Legal/config

`legal-config.js` defines one global, `window.TODOOFICIOS_LEGAL`, with contact info, `supabaseUrl`/`supabaseAnonKey` (public anon key, safe to expose), `paypalClientId`, and social links. Fields still using the `PENDIENTE_...` placeholder are treated by the app as "not configured yet" (`hasPendingLegalData`, `hasCloudConfig`, `canUsePaypalClientId`) and gate the corresponding features/warnings. This file is loaded before any other script on every page.

### Supabase backend

- `supabase/migrations/` holds the SQL to run in the Supabase SQL editor: `kv_store` (generic shared key/value store behind the storage abstraction above — RLS currently allows the `anon` role full read/write/delete, i.e. it's trusted to the client), and `blog_posts` (RLS allows `anon` to `select` only rows with `status = 'published'`; there is no anon insert/update policy — all writes come from the blog bot using the `service_role` key, which bypasses RLS).
- `supabase-kv-store.sql` at the repo root is a near-duplicate of `supabase/migrations/20260812000000_create_kv_store.sql` (kept for convenience/copy-paste). If you change the `kv_store` schema, update both, or prefer treating the migration under `supabase/migrations/` as canonical.

### Blog pipeline

`scripts/generate-blog-post.mjs` (run by `.github/workflows/weekly-blog-post.yml`) picks a trade deterministically by ISO week, asks the Claude API (model `claude-opus-5`) for a ~500-800 word Spanish article as JSON, and inserts it into `blog_posts` with `status: 'draft'` via the Supabase `service_role` key. A human reviews it in Supabase Studio and flips `status` to `'published'` (and sets `published_at`, which the listing sorts/relies on) to make it live — `blog.html` then picks it up automatically. Nothing here is auto-published.

### Construction/preview gate (two places, keep in sync)

The whole site can be switched between "live" and "coming soon" via **two redundant mechanisms** that must be toggled together:
1. An inline script at the very top of `index.html`'s `<head>` (`UNDER_CONSTRUCTION` boolean) that redirects to `proximamente.html` unless the visitor has a `?preview=toc-construccion-2026` query param or the resulting 30-day localStorage flag.
2. The `mod_rewrite` block at the top of `.htaccess`, doing the equivalent server-side redirect for every path except `proximamente.html`, static assets, and a few root files.

The JS check exists specifically because Hostinger's GitHub-connected auto-deploy doesn't reliably honor `.htaccess`. `robots.txt` currently disallows all crawling (`Disallow: /`), consistent with the site being gated. When "launching" the site for real, both (1) and (2) need to be turned off together, and `robots.txt` likely needs revisiting.

### Deployment artifacts (not source of truth)

- `subida-hostinger/` and the `subida-hostinger*.zip` files are **manually maintained snapshots** of the public files, packaged for uploading to Hostinger. They are not generated by any script in this repo and can drift from the root files — don't assume they're current, and don't edit them expecting it to affect the live app; the root-level files are canonical.
- `index-copia-seguridad-YYYY-MM-DD.html` files are dated manual backup copies of `index.html`. They're historical safety copies, not active code — don't edit them, and don't add new ones as a substitute for git history/commits.

### PWA bits

`manifest.json` + `sw.js` provide minimal PWA metadata. `sw.js` is intentionally a **cache-busting, not offline-first** service worker: on install/activate it clears all caches and immediately unregisters itself, to avoid stale versions being served. Keep this behavior unless offline support is explicitly requested.

## Conventions

- All user-facing text, code comments, and git commit messages are in **Spanish (Spain)**. Commit messages are short, imperative, verb-first (e.g. "Añade...", "Rediseña...", "Ensancha...").
- Shared visual language across pages: CSS custom properties `--ink`, `--ink-soft`, `--paper`, `--paper-light`, `--amber`, `--amber-deep`, `--line`; headings in "Space Grotesk", body/mono text in "IBM Plex Sans"/"IBM Plex Mono" (Google Fonts). `calculadoras.html` and `blog.html` each redeclare this palette/typography locally (there's no shared CSS file) — match it by hand when touching or adding standalone pages.
- Branches/PRs follow the pattern `claude/<slug>`, merged into `main`.
