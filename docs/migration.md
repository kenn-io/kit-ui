# Migrating middleman / agentsview to kit-ui

A step-by-step guide for an agent (or human) converting an app to consume
`@kenn-io/kit-ui` instead of its local copies of these components. kit-ui was
consolidated *from* both apps, so most swaps are rename + prop-delta, but the
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
  file in the same PR that swaps its call sites, or `kit-ui-check` treats it
  as a hand-rolled equivalent forever.

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
4. Dark mode: replace the app's mechanism with the theme store —
   `initTheme()` at startup, `setThemeMode("light" | "dark" | "system")`,
   `setHighContrast(bool)`. It toggles the `dark` / high-contrast classes
   on `<html>` itself.
5. Media queries: only the shared breakpoints 640 / 760 / 900px are allowed
   (`BREAKPOINTS` / `MEDIA` from kit-ui), and **only for layout** — never
   for type sizes. `kit-ui-check` flags anything else.

## 3. Component mapping — middleman (`packages/ui` → kit-ui)

| middleman | kit-ui | Deltas to handle |
| --- | --- | --- |
| `ActionButton` | `Button` | Variants are `tone` (neutral/success/danger/info/workflow) × `surface` (outline/soft/solid) × `size` (sm/md). Map old kind/variant props onto tone+surface; icon goes in the default snippet before `label` |
| `Chip` | `Chip` | Sizes are now a strict ladder (xs=10px, sm=11px, md=12px); check call sites that assumed xs==sm rendering |
| `GitHubLabels` | `ColorLabel` | One pill per label; contrast-picked text color is built in |
| `AppHeader` | `TopBar` | Tabs auto-collapse by measurement — delete the app's width breakpoint. Use `centerTabs` for middleman's centered group; `bind:collapsed` to adapt snippets. Unknown `active` falls back to first enabled tab |
| `SettingsPage` | `SettingsLayout` + `SettingsSection` | Categories are data (`SettingsCategory[]`); footer is a pinned snippet |
| flash store + banner | `showFlash` / `FlashBanner` | Stack caps at 5 and renders as one card; `dismissFlash()` with no args dismisses **all** (with an id, just that one — safe to pass as an event handler). Mount `<FlashBanner top="…" />` once; `top` should clear the app header |
| `Modal` | `Modal` | New `tone` prop tints the header (default is a neutral inset header distinct from the body); focus trap + scroll lock built in — remove app-side body-overflow hacks |
| `DetailDrawer` | `DetailDrawer` | Full-viewport overlay + right panel; if the app's drawer coexisted with a visible sidebar, re-check layering |
| `CollapsibleSidebar`, `SidebarToggle` | same names | — |
| `SplitResizeHandle` | `SplitResizeHandle` | Emits `SplitResizeEvent`; keyboard resize included |
| `SelectDropdown` | `SelectDropdown` | Menu is `position: fixed` via `floatingPopoverStyle` — it escapes overflow containers now; remove workarounds. Caveat: transformed/filtered ancestors re-parent fixed descendants |
| `KbdBadge` | `KbdBadge` | Hidden on touch devices automatically |
| `DiffSummaryChip` popover | `Tooltip` | Generic hover/focus tooltip with delays + flipping |
| `DiffStats` | `DiffStats` | `formatDiffStat` exported separately |
| inline segmented pattern | `SegmentedControl` | — |
| inline table sort headers | `Table` + `TableHeaderCell` | `aria-sort` handled by the component |
| mobile chip-row overflow | `ChipStack` | "+N" expansion built in |

## 4. Component mapping — agentsview (`frontend/src/lib` → kit-ui)

| agentsview | kit-ui | Deltas to handle |
| --- | --- | --- |
| `AppHeader` | `TopBar` | Replace the width breakpoints with measurement. For the two-breakpoint search behavior use `searchMinWidth` + a [FitStages](components/fit-stages.md) in the search slot (see [top-bar.md](components/top-bar.md#flexible-search-searchminwidth)) |
| `RangePicker` | `RangePicker` | Decoupled from stores/i18n — all strings are props. The Calendar tab is a month grid now (no day stepping); `previousPeriodLabel`/`nextPeriodLabel` still work as deprecated aliases. `resolveRange()` bounds are inclusive; "Last N days" includes today; periods containing `maxDate` resolve to full bounds (clamp consumer-side) |
| `SessionFindBar` | `FindBar` | Decoupled from the search store — you own matches/index. It's a **floating card** now; the app positions it (see the placement contract in [find-bar.md](components/find-bar.md#placement-contract)) |
| `OptionTypeahead` | `Typeahead` | Options are `TypeaheadOption[]`; match highlighting built in |
| `CopyButton` | `CopyButton` | Or use `copyToClipboard` directly for custom triggers |
| `Spinner` | `Spinner` | — |
| `StatusDot` | `StatusDot` | Takes a `status` **string** (`working`/`waiting`/`stale`/…), not a session object — map at the call site |
| `RefreshControl` | `RefreshControl` | Pairs with `createRefreshScheduler` |
| filter menus | `FilterDropdown` | Sectioned multi-select with search/counts/bulk actions |
| empty placeholders | `EmptyState` | — |
| bottom bar | `StatusBar` | left/center/right snippet regions |

## 5. Utilities and stores

| Old (either app) | kit-ui export |
| --- | --- |
| clipboard helper | `copyToClipboard` |
| relative-time / timestamp formatting | `formatRelativeTime`, `formatTimestamp`, `truncate` |
| duration / token / cost formatting | `formatDuration`, `formatTokenCount`, `formatCost`, `formatNumber` |
| debounce | `debounce` |
| auto-refresh loop | `createRefreshScheduler`, `formatRefreshAge` |
| deterministic color from a string | `hashColor` (**colors will shift** — the palette/hash differ from both apps' old versions; screenshots and user muscle-memory change) |
| popover positioning | `floatingPopoverStyle` |
| focus trap | `trapFocus` attachment (initial focus via `[autofocus]`, Tab trap, focus restore, re-entrant scroll lock) |
| theme persistence | `initTheme` / `setThemeMode` / `setHighContrast` / `getThemeMode` / `isDark` |

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
- **`FindBar` no longer positions itself** — mount points must supply
  `position: absolute` + z-index (placement contract in its doc).
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

Follow the staged adoption path in [checking.md](checking.md#adoption-path)
(tokens → primitives → popovers → composites → layout → enforcement),
using:

```bash
bunx kit-ui-check --warn   # burndown while migrating (never let count rise)
bunx kit-ui-check          # flip to failing in CI at the final stage
```

Suppress a deliberate exception with a `kit-ui-check-ignore` comment plus a
reason, and per-stage run the app's own gates (`check`, `build`, tests) plus
a manual pass of the affected screens in light, dark, and high-contrast
modes.
