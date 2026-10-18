# BandPlan UI Style Audit

**Branch:** `main` only  
**Scope:** visual system and responsive presentation; preserve existing behavior, routes, storage, Supabase, authentication, sync, Service Worker and PWA installation.  
**Status:** soft-clay styling layer integrated into `main`; runtime verification is still required before calling the redesign complete.

## Source files inspected

- `index.html`: theme bootstrap, stored accent selection and contrast calculation, stylesheet order, PWA metadata, early Service Worker registration and app shell.
- `bandplan.css`: primary design system, theme tokens, navigation, controls, layout and component styles.
- `bandplan-depth.css`: supplemental elevation/shadow layer, pressed states, reduced-motion and forced-colors rules.
- `tests/smoke.mjs`: Playwright smoke test for startup, auth gate and cloud API initialization.
- `package.json`: build command is `npm run build`; no test script is declared in the inspected package manifest.

## Findings by component

| Area | Current implementation | Gap / risk | Planned treatment |
|---|---|---|---|
| Theme tokens | Existing tokens include `--bg`, `--surf-1/2`, `--text`, `--muted`, `--accent`, multiple border/shadow aliases and raw-color tokens. | Parallel naming systems make consistency and audits difficult. | Add a compatibility mapping to the requested canonical tokens; retain existing aliases so existing components and theme bootstrap continue to work. |
| Accent and contrast | `index.html` restores stored theme/accent and calculates whether white or black gives better contrast on the accent. | The public token names differ from the requested `--a` and `--on`; actual WCAG contrast still needs measurement across the requested palette. | Keep existing accent persistence and contrast calculation; expose canonical aliases and verify contrast with automated measurements. |
| Light/dark/AMOLED | Existing theme selectors define separate surface, text, semantic and shadow values. | Current values differ from the requested palette and use several competing shadow recipes. | Align surface/elevation tokens incrementally; AMOLED must not receive a light neumorphic highlight. |
| Buttons | Existing button styles and the depth layer provide raised/pressed shadows and primary-button styling. | Verify every variant, disabled/loading/error states, 44px target size, focus-visible and accent contrast. | Normalize through tokens without changing button markup, handlers or dimensions where that could break layouts. |
| Inputs | Existing fields use theme surfaces/borders; depth layer adds recessed shadows. | Audit all input types, focus rings, invalid/disabled states and contrast. | Standardize recessed field tokens and states while preserving native behavior. |
| Cards and panels | Existing `.card` rules receive elevation from `bandplan-depth.css`. | Check consistency of 20px radius, padding, borders, interactive states and nested cards. | Use shared card tokens; avoid blanket rules that change layout or clipping. |
| Participation controls | Existing component styles and application logic must retain participating / maybe / not participating semantics. | Confirm active segment, colors and keyboard states in all themes. | Style existing controls only; do not alter values, persistence or event participation logic. |
| Calendar | Existing calendar has dedicated styles and established day-cell behavior. | Verify square day cells, today outline, event indicators and adjacent-month days at mobile/tablet widths. | Preserve current calendar structure and interaction behavior; use the existing calendar as a regression-sensitive component. |
| Navigation | Desktop sidebar and mobile bottom navigation already exist. | Check active elevation/accent and safe-area spacing; user-requested 240px sidebar differs from existing sizing tokens. | Adjust styling responsively only after checking viewport captures and avoiding content overlap. |
| Dialogs and toasts | Existing modal/toast components are in the main stylesheet. | Verify backdrop, Escape/close behavior, focus management and 1.8s toast timing from implementation and runtime. | Keep JS behavior unchanged; update only visual rules unless a verified accessibility defect requires a separate fix. |
| Stage mode | Dedicated scene tokens and stage styles exist; the requested scene background is black. | Verify always-black background, readable chords/section labels and 4px accent progress line. | Keep stage controls and song progression intact; apply scene-specific tokens. |
| Loading and skeletons | Boot shell and skeleton-related tokens/styles exist. | Verify geometry stability and reduced-motion behavior under slow/offline startup. | Avoid changing boot/auth initialization or Service Worker behavior. |
| Responsive layout | Existing layout has sidebar, content and bottom-nav rules. | Must test 360, 390, 768, 1280 and 1920px, including 1101×667 and small desktop layouts; check horizontal overflow and safe-area spacing. | Make targeted breakpoint changes only when verified in browser. |
| Blur / glass | The supplemental layer now gives the sticky topbar an opaque surface and disables backdrop blur; overlays also avoid decorative glass blur. | Confirm readability and stacking in a real browser. | Keep opaque surfaces; do not reintroduce Liquid Glass or backdrop blur. |
| Hard-coded colors / `!important` | Multiple raw color tokens and direct color values exist; print/auth-lock rules include `!important`. | Conflicts with the strict request, but global deletion can break auth visibility, forced colors, print and theme boot. | Inventory and remove component-level hardcoding incrementally; do not blindly delete safety-critical overrides without replacement and regression tests. |

## Required verification

1. Run `npm ci` and `npm run build`.
2. Run `node tests/smoke.mjs` if dependencies and the browser runtime are available.
3. In browser, verify sign-in/auth gate, calendar, event participation, songs, setlists, stage mode, settings, import/export, and offline/reload behavior.
4. Check all three themes and at least five accent colors.
5. Check widths 360, 390, 768, 1280 and 1920px; inspect horizontal overflow, clipped controls, safe-area insets and touch targets.
6. Measure WCAG AA text contrast, especially text on accent-colored controls.
7. Confirm there are no changes to Supabase API/data, routes, storage keys, authentication, sync, Service Worker or PWA install behavior.

## Current limitation

This document is a source-based audit, not a claim that the browser scenarios or build have passed. The connected GitHub file operations can inspect and commit repository files, but they do not execute the repository's local build or Playwright tests. Runtime checks must be run in an environment with the repository and dependencies available.


## Main-branch design pass — 2026-10-18

- Integrated the soft-clay component layer into `bandplan-depth.css` on `main`, using the design branch as a source but adapting it before committing.
- Added shared light/dark/AMOLED surface, radius, shadow, control, navigation, dialog, toast and stage-mode styling.
- Preserved legacy `--s1` / `--s2` spacing tokens by using `--surface-1` / `--surface-2` for colors.
- Deliberately excluded the design branch's calendar-cell redesign and event-count badge so the established calendar/day-cell appearance remains untouched.
- Deliberately excluded accent-only participation overrides so the existing semantic green / yellow / red participation states remain in control.
- Kept reduced-motion rules and removed backdrop blur from the sticky topbar.
- Static checks on the committed stylesheet: balanced braces; no unresolved CSS custom properties against `bandplan.css`; no calendar selectors or participation-accent override in the new layer.
- Not yet verified: production build, Playwright smoke suite, actual screenshots at target viewport sizes, and contrast measurements. These checks were not runnable from the connected GitHub file-editing environment.

## Conflict cleanup — 2026-10-18

- Fixed two legacy `#scene .scene-body b.ch.inl` rules in `bandplan.css` that used `!important` for chord badge backgrounds and borders. Those declarations prevented the newer stage-mode rule from rendering chords as unboxed accent-colored text.
- The two targeted legacy blocks now use transparent backgrounds and no border, with a short WHY comment. This is a narrowly scoped correction; unrelated `!important` declarations were left untouched because their effects have not been runtime-tested.
- Source checks after the edit: both exact legacy blocks replaced once; no unmatched braces in `bandplan.css`; `!important` count reduced from 2,195 to 2,191.
- Next safe cleanup targets should be chosen by confirmed visual conflicts, not by global removal of `!important`.

## Soft Clay button refinement — 2026-10-18

- Removed the decorative gradient from primary/accent/auth-submit buttons in `bandplan-depth.css`; the selected accent remains the solid button surface.
- Replaced the strong accent-colored glow with the shared raised surface shadow for default and hover states, while preserving focus, disabled and active-state rules.
- This is scoped to the supplemental design layer and does not alter button markup or click behavior.
- Static checks: targeted source blocks each matched once before replacement; CSS braces remain balanced; the supplemental layer still contains no `!important` declarations.
- Runtime/browser verification is still outstanding; do not treat these source checks as a visual regression pass.

## Control-surface conflict pass — 2026-10-18

- Extended the recessed field treatment to the existing `.textarea` class as well as native `textarea` elements. This closes a selector gap in the visual layer without changing markup or form behavior.
- Removed the remaining gradient from primary buttons' pressed state and from the floating/create/auth primary-action surface. The accent stays solid; the pressed state is expressed through the inset shadow and a subtle solid-color mix.
- Included the existing `scene-quick` action in the same solid-accent primary-action rule so it does not retain the legacy gradient treatment.
- Static checks after commit: both primary-action gradients are absent; the only remaining gradient in `bandplan-depth.css` is the loading skeleton shimmer; braces are balanced; the supplemental layer has no `!important` declarations.
- Browser/build/smoke verification remains outstanding. No claims are made about runtime appearance or behavior until those checks can run.

## Stylesheet cache invalidation — 2026-10-18

- Bumped the stylesheet query versions in `index.html` after updating the visual layer: `bandplan.css?v=20261018-33` and `bandplan-depth.css?v=2`.
- Updated the Service Worker shell entry for `bandplan-depth.css` to the same `?v=2` URL so installed/offline clients request the current design layer. The Service Worker cache-version token and install/update logic were not changed.
- This addresses a deployment visibility risk: changing CSS contents without changing a versioned URL can leave browser HTTP caches serving the previous stylesheet. It does not prove that a live browser has already refreshed; verify after GitHub Pages deployment and normal PWA update activation.

## Responsive content-bottom spacing — 2026-10-18

- Scoped the supplemental 110px bottom-navigation reserve to viewports at or below 860px, where the floating bottom navigation is shown.
- Tablet layouts from 861–900px keep their existing compact desktop spacing rule; wider desktop layouts no longer inherit mobile-only blank space at the end of content.
- WHY: fixed navigation padding should follow the breakpoint that displays that navigation, rather than adding a large empty tail on desktop.
- This changes only content-bottom spacing; calendar day geometry, routing, interaction logic, and PWA/service-worker behavior are unchanged. CI browser smoke, contrast, Lighthouse, and production-build checks are the next verification gate.
