# BandPlan TypeScript migration — feature inventory

This is an initial inventory from the repository shell, inspected source excerpts and existing smoke test. It is not yet a claim that every nested action has been exhaustively enumerated. During the next audit pass, search the full source for route definitions, `data-act` handlers, form actions, storage keys, cloud API methods and modal flows, then replace any remaining "verify" items with exact code references.

## Application shell and navigation

- [x] Boot/loading UI with progress, slow-start state, offline continuation and retry.
- [x] Main application shell and content mount point.
- [x] Desktop sidebar and mobile bottom navigation mount points.
- [x] Hash-based routing; calendar and songs routes confirmed.
- [x] Theme toggle entry points.
- [x] Scene-mode entry point.
- [x] Modal overlay, toast region, print area and JSON file input.
- [ ] Enumerate every route and verify direct reload/deep-link behavior.
- [ ] Enumerate all keyboard, focus, and accessibility interactions.

## Authentication and account state

- [x] Supabase client initialized from `window.BANDPLAN_CONFIG`.
- [x] Persistent session, automatic token refresh and URL callback detection.
- [x] Email confirmation callback detection and confirmation UI path.
- [x] Legacy auth storage recovery behavior.
- [ ] Verify signup, confirmation email, callback success/error, login, logout and session restoration against a test account.
- [ ] Verify password reset/recovery and any provider sign-in flows actually present in the current source.
- [ ] Verify existing accounts continue to work after a TypeScript build.
- [ ] Enumerate all auth error states and retry behavior.

## Cloud data, groups and synchronization

- [x] Supabase state table name `bandplan_user_state` observed.
- [x] Durable browser-side cloud state and IndexedDB use observed.
- [x] Realtime/group synchronization variables and lifecycle exist in the inspected client.
- [ ] Enumerate exact profile/group/member/invite/song/event/setlist operations.
- [ ] Verify ownership and access rules remain enforced by existing RLS.
- [ ] Verify cross-user synchronization using two controlled test accounts.
- [ ] Verify conflict resolution, retries, reconnect behavior and duplicate prevention.
- [ ] Verify no accidental state reset or serialization change.

## Calendar and event participation

- [x] Calendar is the initial body route and is part of the app feature description.
- [x] Existing smoke test covers event-participation queue API and offline cleanup behavior.
- [ ] Enumerate calendar views, event types, create/edit/delete flows and event detail actions.
- [ ] Verify participation states, cancellation of a selection and display for other members.
- [ ] Verify set-list linkage, past/cancelled events and offline event-song cleanup.
- [ ] Compare calendar layout and responsive behavior to baseline screenshots.

## Songs and repertoire

- [x] Repository shell/feature descriptions identify repertoire with chords and role-specific dynamics.
- [ ] Enumerate song list, search/filter, favorite, create/edit/delete and import/export behavior.
- [ ] Verify lyrics, chords, song-part labels, key/transpose behavior and dynamic sections.
- [ ] Verify instrument-specific dynamics are shown to the matching role.
- [ ] Verify song records and local cache remain compatible.

## Setlists and stage/scene mode

- [x] Scene dialog and its controls exist in `index.html`.
- [x] Scene controls include previous/next song, auto-scroll, speed, font size, transposition, chord toggle and fullscreen action.
- [ ] Enumerate setlist CRUD, song ordering, selection and persistence behavior from the core.
- [ ] Verify stage mode renders lyrics/chords/part labels and follows the same order as stored song text.
- [ ] Verify previous/next navigation, text size, speed, transpose and chord visibility.
- [ ] Verify setlist and scene behavior on mobile/tablet/desktop.

## Profile, settings and themes

- [x] Early boot code reads `bandplan.boot`, `accent` and theme/accent preset state.
- [x] Existing smoke test checks light/dark/AMOLED theme color and accent token behavior.
- [ ] Enumerate profile, role/instrument, group settings, preferences and account settings.
- [ ] Verify theme, accent and user preferences persist after reload and across supported devices.
- [ ] Verify reduced motion and safe-area behavior where implemented.

## PWA, offline and native builds

- [x] Manifest with standalone display, relative scope/start URL, icons and calendar/song shortcuts.
- [x] Service Worker app-shell caching and cache version replacement during build.
- [x] IndexedDB `bandplan-cloud-v1` version 3; `sync_queue` and `event_offline_songs` are checked by smoke test.
- [x] Capacitor 8 dependencies and Android/iOS sync/open scripts are present in `package.json`.
- [ ] Verify install prompt, installed launch, online update, offline launch and stale-cache recovery.
- [ ] Enumerate all localStorage/sessionStorage keys and IndexedDB stores/indexes/payload shapes.
- [ ] Verify offline edits survive close/reopen and sync once network returns.
- [ ] Confirm native project presence and check Android/iOS build compatibility separately.

## Visual and responsive contracts

- [x] HTML shell and CSS are separate assets; local Manrope fonts are referenced.
- [x] Existing smoke test checks no horizontal overflow at viewport widths from 320 to 3440 px.
- [x] Existing smoke test checks email/password/submit targets at least 44 px high.
- [ ] Capture baseline screenshots for every route at phone, tablet and desktop widths.
- [ ] Compare modal sizes, independent scroll panes, button states, themes and scene mode.
- [ ] Confirm no unintended CSS/class/DOM ID changes during migration.

## Existing automated checks

- [x] `npm run build` is defined in `package.json`.
- [x] `tests/smoke.mjs` exists and contains Playwright browser assertions.
- [x] `.github/workflows/syntax.yml` is discoverable and checks JS syntax.
- [ ] Confirm dependency installation and whether Playwright is available from lockfile/CI.
- [ ] Run the existing build and smoke test on a clean local checkout and save actual logs.
- [ ] Add TypeScript typecheck as a separate CI step without removing the existing JS syntax/test checks until all legacy JS is migrated.

## Non-negotiable compatibility checklist

- [ ] No change to user-facing design or CSS during the type migration.
- [ ] No change to route names, DOM IDs/classes or public browser globals.
- [ ] No change to Supabase schema, RLS, RPC or provider configuration.
- [ ] No change to auth storage key or legacy session recovery.
- [ ] No change to localStorage/sessionStorage names or serialized formats.
- [ ] No change to IndexedDB database/version/store contracts without an approved compatibility migration.
- [ ] No loss of offline queue operations or duplicate writes.
- [ ] No runtime dependency on a new CDN.
- [ ] No production deployment until staging checks pass.
- [ ] Rollback to the source baseline remains possible.

## Next audit pass

Before converting runtime code, inspect the full `bandplan-core.js` and `supabase.js`, enumerate routes/actions/globals/storage keys and all workflows, then complete the unresolved checklist items above. Obtain baseline build and smoke results from a clean local checkout. Present the completed plan for owner approval before implementation.
