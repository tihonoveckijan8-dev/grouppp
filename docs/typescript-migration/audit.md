# BandPlan TypeScript migration — source audit

## Scope and status

- Repository: `tihonoveckijan8-dev/grouppp`
- Default/target baseline branch: `main`
- Audit branch: `migration/typescript-audit`
- Audit date: 2026-10-15
- This document is based on inspection of repository files through GitHub. A local checkout, npm install, production build, browser run, and test execution have **not** been performed in this audit step; do not interpret this as a passing test report.
- The audit phase intentionally does not convert application code or change runtime behavior.

## Observed architecture

### Runtime and UI

- The app is a vanilla HTML/CSS/JavaScript application; no React/Vue/Svelte UI framework was found in the inspected entry/configuration files.
- `index.html` is the main shell, in Russian, with stable DOM anchors for the boot UI, app shell, sidebar, main content, bottom navigation, scene dialog, onboarding, modal overlay, toast stack, print area, and JSON file input.
- `bandplan.js` is a small bootstrap. It exposes `window.__bandplanEnsureCore` and dynamically imports `./bandplan-core.js`; it renders a visible boot error if core loading fails.
- `bandplan-core.js` contains the main application logic and is a large IIFE with boot lifecycle, helpers, rendering, route behavior and feature interactions. Preserve its DOM contracts and global integrations during incremental migration.
- `bandplan.css` contains the visual system. `index.html` references local Manrope fonts, icons and the CSS file.
- The shell uses hash routes; observed routes include `#/calendar` and `#/songs`. Other routes must be inventoried from the core rather than inferred from this short sample.
- The HTML includes a Supabase SDK local vendor script plus a CDN fallback. Do not change this behavior as part of the TypeScript migration without separate approval.

### Build and distribution

- `package.json` declares ESM (`"type": "module"`), uses esbuild `0.25.9`, and defines `npm run build` as `node scripts/build.mjs`.
- `scripts/build.mjs` clears and recreates `dist/`, copies the shell/static assets, then minifies JS/CSS assets with esbuild using `bundle: false`, target `es2020` and `safari15`.
- The build script processes `bandplan.js`, `bandplan-core.js`, `config.js`, `supabase.js`, `sw.js`, and `bandplan.css`. It generates a fresh Service Worker cache version at build time.
- `package.json` includes Capacitor 8 Android/iOS/core dependencies and scripts for sync/opening native projects. Confirm native project files and build paths before making any assumptions about the current Capacitor status.
- A production change must preserve the current static hosting and relative asset paths. GitHub Pages base-path behavior needs explicit validation before changing the build pipeline.

### Authentication and cloud state

- `config.js` exposes a validated public Supabase URL and publishable key through `window.BANDPLAN_CONFIG`; it explicitly warns against placing a service-role secret in browser code.
- `supabase.js` is a classic browser IIFE and creates the Supabase client from that configuration. It captures the email-confirmation callback before session detection consumes URL state.
- The auth client uses persistent sessions, automatic token refresh, URL session detection and an explicit Supabase auth storage key. It contains compatibility recovery for a legacy auth-storage key. These details are migration-critical.
- The inspected module identifies `bandplan_user_state` as the state table and implements durable local cloud state, IndexedDB and sync behavior. Do not infer the complete schema from client code alone.
- Existing email signup/confirmation, login, session restoration, logout, profile/group access and cloud sync must be regression-tested without changing provider settings or server configuration.
- No Supabase schema, RLS policy or Edge Function was changed during this audit. The complete database schema and deployed server configuration were not independently inspected here.

### Offline/PWA

- `sw.js` defines a versioned app-shell cache and caches the shell and key resources. The build script substitutes the cache version token.
- `manifest.webmanifest` declares standalone display, relative start URL/scope, icons and shortcuts to calendar and songs.
- `supabase.js` declares IndexedDB database `bandplan-cloud-v1`, version 3, and store names including `snapshots`, `sync_queue`, `participation_queue` and `event_offline_songs` (confirmed by the existing smoke test for the latter stores).
- Existing offline queues, data formats, cache behavior, keys and IndexedDB schema are compatibility contracts. Do not clear or rename them as part of the migration.

### Tests and automation

- `tests/smoke.mjs` runs a local HTTP server and Playwright Chromium checks for auth bootstrap, lazy core loading, offline IndexedDB stores, participation cleanup, theme/accent handling, responsive widths from 320 to 3440 px, touch target sizes and browser errors.
- `package.json` as inspected does not declare a `test` or `typecheck` script. It also does not list Playwright in the shown dependencies; confirm whether the lockfile/workflow/environment supplies it before running the smoke test.
- `.github/workflows/syntax.yml` exists according to repository search and checks JavaScript syntax for `supabase.js`, `bandplan.js`, `sw.js` and `bandplan-core.js`. Inspect the full workflow and all other workflow files during implementation.
- No test, build or deployment command has been executed as part of this remote audit.

## Critical compatibility contracts

1. DOM IDs and classes used by `bandplan-core.js`, `supabase.js`, CSS and tests.
2. Global browser APIs: `window.BANDPLAN_CONFIG`, `window.BandPlanCloud`, `window.__bandplanEnsureCore`, and any other globals found in the complete code search.
3. Hash routes and the existing `index.html`/asset URL layout.
4. Supabase auth storage key and legacy recovery behavior.
5. Supabase table names, serialized state shapes, row ownership and RLS expectations.
6. IndexedDB database/version/store names and queued-operation payload formats.
7. localStorage/sessionStorage keys, including `bandplan.*` and existing theme/accent keys.
8. Service Worker cache versioning, shell resource paths and update/controller-change behavior.
9. Capacitor build scripts and any native integration present in the full repository.
10. Existing browser support target (`es2020`, `safari15`) and no-runtime-bundling behavior unless deliberately changed and tested.

## Risks and unknowns to resolve before conversion

- `bandplan-core.js` is a large, tightly integrated module. A full rewrite or automatic mass conversion would make behavioral regressions difficult to isolate.
- Existing code uses browser globals and classic-script globals. TypeScript module conversion can change global visibility, evaluation order and import timing.
- The current build uses `bundle: false` and the HTML loads classic scripts plus a dynamic module import. The TypeScript output strategy must preserve those runtime semantics.
- The app has a service worker and installed clients; stale HTML/JS cache combinations may expose deployment-only failures.
- Auth URL fragments, legacy storage recovery and confirmation UI are sensitive to initialization order.
- Existing tests are valuable but do not by themselves prove all logged-in CRUD, multi-user sync, email confirmation or native Capacitor scenarios.
- No baseline screenshots or live authenticated test data were captured in this remote audit. They should be captured in a controlled environment before changing runtime code.

## Proposed migration strategy

1. Freeze the source baseline and capture test/build results in a local checkout.
2. Expand the feature/contract inventory and enumerate every route, action, storage key, public global and cloud operation.
3. Add TypeScript toolchain and strict checking without changing production entry points or runtime behavior.
4. Introduce typed contracts and type-safe wrappers around stable boundaries; keep current JS runtime working.
5. Convert small, low-risk pure helpers first, then data adapters and feature modules in dependency order.
6. Convert the large core only in small, testable slices; avoid one-shot rewrite.
7. Treat `supabase.js`, auth callback/session persistence, offline sync, `sw.js` and native integration as protected high-risk areas requiring dedicated regression checks.
8. Build into a staging artifact and compare routes, screenshots, behavior, data persistence and offline recovery.
9. Keep production unchanged until acceptance checks pass; retain a tested rollback path.

## Audit deliverables

- `docs/typescript-migration/audit.md` — this architecture and risk audit.
- `docs/typescript-migration/feature-inventory.md` — initial feature inventory and verification checklist.

## Current conclusion

The existing application is already modularized at the entry boundary, but the main runtime remains vanilla JavaScript with a large core module and a separate Supabase client. The lowest-risk path is **incremental TypeScript adoption that preserves the current HTML/CSS, global contracts, build output paths and data formats**. Do not introduce React or redesign the UI as part of this migration.

Before implementation, complete the inventory and run a local baseline build/test pass. No production code should be converted until the owner approves the audit plan.
