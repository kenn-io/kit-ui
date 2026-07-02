# Migrating middleman / agentsview to kit-ui

A step-by-step guide for an agent (or human) converting an app to consume
`@kenn-io/kit-ui` instead of its local copies of these components. kit-ui was
consolidated _from_ both apps, so most swaps are rename + prop-delta, but the
libraries have since diverged in places — the deltas are listed per component
below. Read the per-component reference in `docs/components/*.md` for
anything not covered here.

## Ground rules

- Migrate in **small, per-stage PRs**, not one big-bang switch. The stage
  order and the `kit-ui-check` burndown workflow are defined in
  [checking.md](checking.md#adoption-path) — follow that; this document
  supplies the mappings each stage needs.
- After every stage: run the app's own check/build/test suite **and**
  `bunx kit-ui-check --warn` and confirm the finding count went down, never
  up.
- Do not keep a local copy of a component "just in case" — delete the old
  file in the same PR that swaps its call sites.
- **`kit-ui-check` coverage is partial.** Many mapped components have no
  detection rule (Button, Chip, StatusDot, ColorLabel, DiffStats,
  RefreshControl, FindBar, DateRangePicker, SettingsLayout — see the
  [coverage table](checking.md#checker-coverage-per-component)). A clean
  checker run does **not** prove the migration is complete: keep a manual
  inventory of the app's local components and tick them off against the
  mapping tables below.

## 1. Install

```jsonc
// package.json
"dependencies": {
  "@kenn-io/kit-ui": "file:../kit-ui"   // or workspace:* in a workspace
}
```

Requirements the app must satisfy:

- **`svelte` ≥ 5.29** (peer; kit-ui uses `{@attach}`). Upgrade first if the
  app is older.
- **`@lucide/svelte`** as a direct dependency (peer of kit-ui). kit-ui uses
  per-icon deep imports (`@lucide/svelte/icons/check`); apps should too.
- The package is consumed **as source** (the `svelte` export condition
  points at `src/lib/index.ts`) — Vite compiles Svelte from `node_modules`
  automatically for packages with the `svelte` condition; no build step or
  extra config in either app.

## 2. Theme bootstrap

1. Import the tokens once at the app entry:
   ```ts
   import "@kenn-io/kit-ui/theme.css";
   ```
2. **Delete the app's own palette/token stylesheet** and re-point any app
   CSS that referenced old variable names at the kit-ui tokens (see
   [theming.md](theming.md) for the full list: `--bg-*`, `--text-*`,
   `--border-*`, `--accent-*`, `--font-size-*`, `--space-1…8`,
   `--radius-*`, `--shadow-*`, `--header-height`).
3. **Remove any pinned `html { font-size: … }`** (both apps had a mobile
   pin). kit-ui's type scale is rem-based and redefines itself on handheld
   touch devices (pointer-keyed, not width-keyed). Force the compact scale
   in tests/storybook with the `kit-type-touch` class on `<html>`.
4. Dark mode: keep the app's existing toggle mechanism working against the
   kit-ui class names for now (`dark` on `<html>`). Swapping the mechanism
   itself for the theme store (`initTheme()` / `setThemeMode` /
   `setHighContrast`) belongs to the **utilities and theme store** stage
   (stage 5 in checking.md), not the token PR — don't mix a behavior change
   into the token swap.
5. Media queries: only the shared breakpoints 640 / 760 / 900px are allowed
   (`BREAKPOINTS` / `MEDIA` from kit-ui), and **only for layout** — never
   for type sizes. `kit-ui-check` flags anything else.

## 3. Component mapping — middleman (`packages/ui` → kit-ui)

| middleman                             | kit-ui                               | Deltas to handle                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ActionButton`                        | `Button`                             | Variants are `tone` (neutral/success/danger/info/workflow) × `surface` (outline/soft/solid) × `size` (sm/md). Map old kind/variant props onto tone+surface; icon goes in the default snippet before `label`                                                                                                                                                 |
| `Chip`                                | `Chip`                               | Sizes are now a strict ladder (xs=10px, sm=11px, md=12px); check call sites that assumed xs==sm rendering                                                                                                                                                                                                                                                   |
| `GitHubLabels`                        | `ColorLabel`                         | One pill per label; contrast-picked text color is built in                                                                                                                                                                                                                                                                                                  |
| `AppHeader`                           | `TopBar`                             | Tabs auto-collapse by measurement — delete the app's width breakpoint. Use `centerTabs` for middleman's centered group; `bind:collapsed` to adapt snippets. Unknown `active` falls back to first enabled tab                                                                                                                                                |
| `SettingsPage`                        | `SettingsLayout` + `SettingsSection` | Categories are data (`SettingsCategory[]`); footer is a pinned snippet                                                                                                                                                                                                                                                                                      |
| flash store + banner                  | `showFlash` / `FlashBanner`          | Stack caps at 5 and renders as one card. `dismissFlash(id)` dismisses one flash; `dismissFlash()` — **or passing the function directly as an event handler**, which receives the event object — dismisses all. Per-flash close buttons must use `onclick={() => dismissFlash(id)}`. Mount `<FlashBanner top="…" />` once; `top` should clear the app header |
| `Modal`                               | `Modal`                              | New `tone` prop tints the header (default is a neutral inset header distinct from the body); focus trap + scroll lock built in — remove app-side body-overflow hacks                                                                                                                                                                                        |
| `DetailDrawer`                        | `DetailDrawer`                       | Full-viewport overlay + right panel; if the app's drawer coexisted with a visible sidebar, re-check layering                                                                                                                                                                                                                                                |
| `CollapsibleSidebar`, `SidebarToggle` | same names                           | —                                                                                                                                                                                                                                                                                                                                                           |
| `SplitResizeHandle`                   | `SplitResizeHandle`                  | Emits `SplitResizeEvent`; keyboard resize included                                                                                                                                                                                                                                                                                                          |
| `SelectDropdown`                      | `SelectDropdown`                     | Menu is `position: fixed` via `floatingPopoverStyle` — it escapes overflow containers now; remove workarounds. Caveat: transformed/filtered ancestors re-parent fixed descendants                                                                                                                                                                           |
| `KbdBadge`                            | `KbdBadge`                           | Hidden on touch devices automatically                                                                                                                                                                                                                                                                                                                       |
| `DiffSummaryChip` popover             | `Tooltip`                            | Generic hover/focus tooltip with delays + flipping                                                                                                                                                                                                                                                                                                          |
| `DiffStats`                           | `DiffStats`                          | `formatDiffStat` exported separately                                                                                                                                                                                                                                                                                                                        |
| inline segmented pattern              | `SegmentedControl`                   | —                                                                                                                                                                                                                                                                                                                                                           |
| inline table sort headers             | `Table` + `TableHeaderCell`          | `aria-sort` handled by the component                                                                                                                                                                                                                                                                                                                        |
| mobile chip-row overflow              | `ChipStack`                          | "+N" expansion built in                                                                                                                                                                                                                                                                                                                                     |

## 4. Component mapping — agentsview (`frontend/src/lib` → kit-ui)

| agentsview         | kit-ui            | Deltas to handle                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppHeader`        | `TopBar`          | Replace the width breakpoints with measurement. For the two-breakpoint search behavior use `searchMinWidth` + a [FitStages](components/fit-stages.md) in the search slot (see [top-bar.md](components/top-bar.md#flexible-search-searchminwidth))                                                                                                                                                          |
| `RangePicker`      | `DateRangePicker` | Renamed — import `DateRangePicker`. Decoupled from stores/i18n — all strings are props. The Calendar tab is a month grid now (no day stepping); The old `previousPeriodLabel`/`nextPeriodLabel` props are gone — use `previousMonthLabel`/`nextMonthLabel`. `resolveRange()` bounds are inclusive; "Last N days" includes today; periods containing `maxDate` resolve to full bounds (clamp consumer-side) |
| `SessionFindBar`   | `FindBar`         | Decoupled from the search store — you own matches/index. The default is now a **pinned strip** (first child of the container, normal flow); pass `variant="floating"` to keep the old floating-card look — it positions itself now, so drop the app-side absolute wrapper (placement contract in [find-bar.md](components/find-bar.md#placement-contract))                                                 |
| `OptionTypeahead`  | `Typeahead`       | Options are `TypeaheadOption[]`; match highlighting built in                                                                                                                                                                                                                                                                                                                                               |
| `CopyButton`       | `CopyButton`      | Or use `copyToClipboard` directly for custom triggers                                                                                                                                                                                                                                                                                                                                                      |
| `Spinner`          | `Spinner`         | —                                                                                                                                                                                                                                                                                                                                                                                                          |
| `StatusDot`        | `StatusDot`       | Takes a `status` **string** (`working`/`waiting`/`stale`/…), not a session object — map at the call site                                                                                                                                                                                                                                                                                                   |
| `RefreshControl`   | `RefreshControl`  | Pairs with `createRefreshScheduler`                                                                                                                                                                                                                                                                                                                                                                        |
| filter menus       | `FilterDropdown`  | Sectioned multi-select with search/counts/bulk actions                                                                                                                                                                                                                                                                                                                                                     |
| empty placeholders | `EmptyState`      | —                                                                                                                                                                                                                                                                                                                                                                                                          |
| bottom bar         | `StatusBar`       | left/center/right snippet regions                                                                                                                                                                                                                                                                                                                                                                          |

## 5. Utilities and stores

| Old (either app)                     | kit-ui export                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| clipboard helper                     | `copyToClipboard`                                                                                                                     |
| relative-time / timestamp formatting | `formatRelativeTime`, `formatTimestamp`, `truncate`                                                                                   |
| duration / token / cost formatting   | `formatDuration`, `formatTokenCount`, `formatCost`, `formatNumber`                                                                    |
| debounce                             | `debounce`                                                                                                                            |
| auto-refresh loop                    | `createRefreshScheduler`, `formatRefreshAge`                                                                                          |
| deterministic color from a string    | `hashColor` (**colors will shift** — the palette/hash differ from both apps' old versions; screenshots and user muscle-memory change) |
| popover positioning                  | `floatingPopoverStyle`                                                                                                                |
| focus trap                           | `trapFocus` attachment (initial focus via `[autofocus]`, Tab trap, focus restore, re-entrant scroll lock)                             |
| theme persistence                    | `initTheme` / `setThemeMode` / `setHighContrast` / `getThemeMode` / `isDark`                                                          |

## 6. Gotchas that have bitten before

- **`hashColor` output differs** from both apps' old hash palettes — any UI
  keyed on "my repo is green" changes color once.
- **`dismissFlash` semantics**: bare call = dismiss all. Old middleman code
  that passed it directly as `onclick` now dismisses everything — pass
  `() => dismissFlash(id)`.
- **Fixed-position popovers** (`SelectDropdown`, `Tooltip`): an ancestor
  with `transform`/`filter` becomes the containing block and breaks
  positioning; strip decorative transforms on layout wrappers.
- **`DetailDrawer` covers the full viewport** — apps that kept a clickable
  sidebar next to the old drawer need a layout decision, not a prop.
- **`FindBar` defaults to a pinned strip** — existing floating
  integrations must pass `variant="floating"` (the component then
  positions itself; the old app-side absolute wrapper goes away).
- **FitStages hosts must be container-sized** (`flex: 1 1 0; min-width: 0`,
  never `flex-basis: auto`) or stage selection feeds back on itself.
- **Type scale**: components never write type media queries; if a view
  looks too large on mobile after migration, the app is probably still
  pinning `html { font-size }` somewhere (checker rule:
  `pinned-root-font-size`).
- **Spacing** uses the px `--space-1…8` ladder on purpose (spacing should
  not scale with the user's font preference) — don't "fix" it to rem while
  porting styles.

## 7. Rollout and verification

Follow the staged adoption path in
[checking.md](checking.md#adoption-path) — the six stages defined there
(**tokens → low-risk display primitives → stateful primitives → overlays
and layout → utilities and theme store → enforce**) are the authoritative
PR sequence; this guide only adds what to verify at each stage:

| Stage (checking.md)          | Acceptance — in addition to app gates + `kit-ui-check --warn` count not rising                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Tokens                    | No pinned `html { font-size }` remains; mobile type sizes match the old app on a touch device (pointer-keyed scale); dark mode still switches                                                                                                                                                                                                                                                                                                                                                    |
| 2. Display primitives        | Chip sizes visually match call-site intent (xs/sm/md ladder changed); StatusDot call sites map session → status string                                                                                                                                                                                                                                                                                                                                                                           |
| 3. Stateful primitives       | Button call sites map old kinds onto tone×surface; Tooltip flips at viewport edges where the old popover clipped                                                                                                                                                                                                                                                                                                                                                                                 |
| 4. Overlays and layout       | Dropdown menus escape `overflow: hidden` ancestors (and no transformed ancestor breaks them); Modal scroll-lock hacks removed; per-flash dismiss buttons still dismiss one flash, not all; FindBar call sites picked a variant (pinned flow vs self-positioned floating), old positioning wrappers removed, any placement overrides moved to the `--kit-find-bar-*` custom properties, and no app doc/style guide still describes FindBar as app-positioned; DetailDrawer layering decision made |
| 5. Utilities and theme store | `hashColor` color shifts reviewed on real data; theme persists across reload; relative times match old formatting closely enough                                                                                                                                                                                                                                                                                                                                                                 |
| 6. Enforce                   | `bunx kit-ui-check` (no `--warn`) green in CI; every `kit-ui-check-ignore` has a reason; the manual component inventory (Ground rules) fully ticked                                                                                                                                                                                                                                                                                                                                              |

Each stage also gets a manual pass of its affected screens in light, dark,
and high-contrast modes.
