# kit-ui-check

CLI that scans a project consuming `@kenn-io/kit-ui` for hand-rolled
equivalents of library components and design-token violations. Run it in CI so
drift gets caught at review time.

```bash
# in a consuming project (kit-ui installed as a dependency)
bunx kit-ui-check              # scans ./src, exits 1 on findings
bunx kit-ui-check frontend/src packages/ui/src
bunx kit-ui-check --warn       # report but exit 0 (adoption mode)
bunx kit-ui-check --json       # machine-readable
bunx kit-ui-check --list-rules
bunx kit-ui-check --disable legacy-svelte,raw-color
bunx kit-ui-check --rules nonstandard-breakpoint
```

Scans `.svelte`, `.css`, `.ts`, and `.js`/`.mjs` files (declarations and
`.test`/`.spec` files are skipped — fixtures legitimately contain flagged
patterns); skips `node_modules`, `dist`, `build`, `.svelte-kit`, `coverage`,
`test-results`. Script files matter for the import-based rules: a hand-rolled
markdown pipeline or debounce util lives in `.ts`, not markup.

## Rules

| Rule                         | Flags                                                                                                                                                                                       | Use instead                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `nonstandard-breakpoint`     | `@media` widths that aren't 640/760/900px (±1px complements allowed)                                                                                                                        | `BREAKPOINTS` / `MEDIA` from kit-ui ([theming](theming.md#breakpoints))                    |
| `raw-color`                  | hex/rgb() colors in styles (allowed inside `var()` fallbacks; inside `color-mix()` only the `#000`/`#fff` shade constants)                                                                  | theme tokens (`--accent-*`, `--bg-*`, `--text-*`, `--border-*`)                            |
| `hand-rolled-modal`          | `position: fixed` + `inset: 0` overlays                                                                                                                                                     | `Modal`, `FlashBanner`                                                                     |
| `hand-rolled-spinner`        | `@keyframes` rotating to 360deg                                                                                                                                                             | `Spinner`                                                                                  |
| `hand-rolled-clipboard`      | `navigator.clipboard.writeText`, `execCommand("copy")`                                                                                                                                      | `copyToClipboard`, `CopyButton`                                                            |
| `hand-rolled-dropdown`       | `role="combobox"` / `role="listbox"` markup                                                                                                                                                 | `SelectDropdown`, `Typeahead`, `FilterDropdown`                                            |
| `hand-rolled-kbd`            | raw `<kbd>` elements                                                                                                                                                                        | `KbdBadge`                                                                                 |
| `hand-rolled-splitter`       | `cursor: col-resize` dividers                                                                                                                                                               | `SplitResizeHandle`, `CollapsibleSidebar`                                                  |
| `hand-rolled-segmented`      | `segmented-control` / `seg-btn` markup                                                                                                                                                      | `SegmentedControl`                                                                         |
| `hand-rolled-table-sort`     | `aria-sort=` on custom headers                                                                                                                                                              | `Table` + `TableHeaderCell`                                                                |
| `hand-rolled-tooltip`        | `role="tooltip"` markup                                                                                                                                                                     | `Tooltip`                                                                                  |
| `hand-rolled-popover-card`   | one CSS rule combining `border-default` border + `--radius-md` + `--shadow-lg`                                                                                                              | the `kit-popover-card` class from theme.css                                                |
| `hand-rolled-card`           | one CSS rule matching a Card level signature: `bg-inset`+`border-muted`+`radius-sm`, `bg-surface`+`border-muted`+`radius-md`, or `bg-surface`+`border-default`+`radius-lg`+`shadow-sm`      | `Card` (`level="inset" / "default" / "raised"`)                                            |
| `hand-rolled-status-bar`     | `status-bar` classes/selectors (`kit-status-bar` exempt)                                                                                                                                    | `StatusBar`                                                                                |
| `hand-rolled-code-block`     | `code-block` classes/selectors (`kit-code-block` and suffixed names like `code-block-list` are both exempt)                                                                                 | `CodeBlock`                                                                                |
| `hand-rolled-empty-state`    | `empty-state` classes/selectors (`kit-empty-state` exempt)                                                                                                                                  | `EmptyState`                                                                               |
| `hand-rolled-icon-button`    | `icon-btn` / `icon-button` classes/selectors (single/double-quoted `class=` and CSS selectors; suffixed names like `icon-button-group` are exempt; dynamic `class:` directives aren't seen) | `IconButton`                                                                               |
| `hand-rolled-top-bar`        | `app-header` / `header-left` / `header-right` classes/selectors                                                                                                                             | `TopBar`                                                                                   |
| `hand-rolled-search-input`   | `type="search"` inputs, `search-input`/`search-box`/`search-field` classes (`kit-search-input` exempt)                                                                                      | `SearchInput`                                                                              |
| `hand-rolled-date-input`     | native `type="date"` / `type="datetime-local"` inputs (they render unthemed platform chrome)                                                                                                | `DateRangePicker`, `Calendar`                                                              |
| `hand-rolled-toast`          | `toast` / `snackbar` classes/selectors (compounds like `undo-toast` included)                                                                                                               | `FlashBanner` + the flash store                                                            |
| `hand-rolled-drawer`         | `drawer` class and its structural compounds (`drawer-panel`, `drawer-backdrop`, …); other `drawer-*` names and `kit-detail-drawer*` are exempt                                              | `DetailDrawer`                                                                             |
| `hand-rolled-find-bar`       | `find-bar` classes/selectors (`kit-find-bar` exempt)                                                                                                                                        | `FindBar`                                                                                  |
| `hand-rolled-status-dot`     | `status-dot` classes/selectors (`kit-status-dot` exempt)                                                                                                                                    | `StatusDot`                                                                                |
| `hand-rolled-checkbox`       | bare `<input type="checkbox">` markup, `input[type=checkbox]` selectors, or checkbox-scoped `accent-color` (range/progress accent-color is legitimate)                                      | `Checkbox` (or `Toggle` for on/off settings)                                               |
| `hand-rolled-toggle`         | `role="switch"` markup                                                                                                                                                                      | `Toggle`                                                                                   |
| `hand-rolled-sidebar-toggle` | `sidebar-toggle` classes/selectors (`kit-sidebar-toggle` exempt)                                                                                                                            | `SidebarToggle`                                                                            |
| `hand-rolled-sr-only`        | visually-hidden clip recipes (`clip: rect(0…)`, `clip-path: inset(50%)`)                                                                                                                    | the `kit-sr-only` class from theme.css                                                     |
| `hand-rolled-virtualization` | imports of virtualization packages (`@tanstack/virtual-core`, `svelte-virtual-list`, `virtua`, …)                                                                                           | `VirtualList`                                                                              |
| `hand-rolled-markdown`       | direct `marked` / `dompurify` imports                                                                                                                                                       | `Markdown`, `renderMarkdown` (they bundle sanitization + highlighting)                     |
| `hand-rolled-focus-trap`     | the tabbable-elements selector (`[tabindex]:not(…`) — the signature of hand-rolled Tab cycling                                                                                              | `trapFocus` (also locks body scroll and restores focus)                                    |
| `local-debounce`             | relative-path debounce imports, inline `function debounce(`                                                                                                                                 | `debounce` from kit-ui (ships `.cancel()`)                                                 |
| `manual-color-scheme`        | `prefers-color-scheme` queries, `classList.toggle("dark")`-style wiring                                                                                                                     | the theme store (`initTheme`/`setThemeMode`) + `ThemeToggle`                               |
| `raw-z-index`                | literal `z-index` ≥ 100 (smaller values are legitimate local stacking)                                                                                                                      | `var(--z-popover)`/`var(--z-overlay)` (1000), `var(--z-tooltip)` (1100)                    |
| `nonstandard-spacing`        | `gap` values off the spacing ladder (0/1px hairlines exempt)                                                                                                                                | `var(--space-1…8)` ([theming](theming.md#spacing))                                         |
| `pinned-root-font-size`      | px `font-size` on `html`/`:root`                                                                                                                                                            | leave the root at 100% — it defeats the rem type scale ([theming](theming.md#typography))  |
| `legacy-mobile-type`         | `--font-size-mobile-*` usage                                                                                                                                                                | the standard tokens; they resize on touch devices ([migration map](theming.md#typography)) |
| `legacy-svelte`              | `on:event` directives, `export let`                                                                                                                                                         | runes mode (`$props`, `onclick`)                                                           |
| `chip-label-override`        | CSS selectors targeting `.kit-chip__label`, Chip's internal label span (suffixed local names like `kit-chip__label-wrapper` are exempt)                                                     | nothing — Chip centers label svgs itself; use its `trailing` snippet for dropdown chevrons |

## Suppressing a finding

Put `kit-ui-check-ignore` in a comment on the offending line or the line
above. Give a reason — the marker is a promise that a human decided the
exception is legitimate:

```css
/* kit-ui-check-ignore: brand color mandated by marketing */
.logo {
  color: #ff5533;
}
```

## Programmatic use

The rules are exported for custom tooling (e.g. a vitest suite in the
consuming repo):

```ts
import { checkSource, ALL_RULES } from "@kenn-io/kit-ui/check/rules";

const findings = checkSource(source, "Component.svelte");
// [{ rule, line, message }, …]
```

## Checker coverage per component

Every library component is either enforced by a rule, covered by an existing
rule, or deliberately unenforced with the rationale recorded here (per the
CLAUDE.md checker-parity convention). Token rules (`raw-color`,
`nonstandard-spacing`, `nonstandard-breakpoint`, typography rules) apply to
everything and aren't repeated per row.

| Component                                 | Enforcement                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Modal, FlashBanner, DetailDrawer          | `hand-rolled-modal` (all are fixed inset-0 overlays); `hand-rolled-toast` and `hand-rolled-drawer` catch the class-name variants    |
| Spinner                                   | `hand-rolled-spinner`                                                                                                               |
| CopyButton / `copyToClipboard`            | `hand-rolled-clipboard`                                                                                                             |
| SelectDropdown, Typeahead, FilterDropdown | `hand-rolled-dropdown`                                                                                                              |
| KbdBadge                                  | `hand-rolled-kbd`                                                                                                                   |
| SplitResizeHandle, CollapsibleSidebar     | `hand-rolled-splitter`                                                                                                              |
| SegmentedControl                          | `hand-rolled-segmented`                                                                                                             |
| Table / TableHeaderCell                   | `hand-rolled-table-sort`                                                                                                            |
| Tooltip                                   | `hand-rolled-tooltip`                                                                                                               |
| StatusBar                                 | `hand-rolled-status-bar`                                                                                                            |
| EmptyState                                | `hand-rolled-empty-state`                                                                                                           |
| CodeBlock                                 | `hand-rolled-code-block`                                                                                                            |
| Markdown / markdown pipeline              | `hand-rolled-markdown` (the dependency is the tell — direct `marked`/`dompurify` imports)                                           |
| IconButton                                | `hand-rolled-icon-button`                                                                                                           |
| TopBar                                    | `hand-rolled-top-bar`                                                                                                               |
| Button, ChipStack                         | no rule — generic button/badge markup has no reliable signature; token rules catch the styling drift                                |
| Chip                                      | `chip-label-override` (CSS reaching into the internal label span); hand-rolled badge markup itself has no reliable signature        |
| StatusDot                                 | `hand-rolled-status-dot`                                                                                                            |
| Checkbox                                  | `hand-rolled-checkbox` (bare native checkboxes and `accent-color` styling)                                                          |
| Toggle                                    | `hand-rolled-toggle` (`role="switch"` is the reliable marker)                                                                       |
| ColorLabel, DiffStats                     | no rule — small display primitives with no detectable marker; found in review                                                       |
| FindBar                                   | `hand-rolled-find-bar`                                                                                                              |
| SidebarToggle                             | `hand-rolled-sidebar-toggle`                                                                                                        |
| DateRangePicker, Calendar                 | `hand-rolled-date-input` (native date inputs); hand-rolled month grids still read as generic tables/buttons and are found in review |
| RefreshControl, SettingsLayout/Section    | no rule — composite widgets; no stable class/aria signature that wouldn't false-positive. Revisit if either app regrows one         |
| SearchInput                               | `hand-rolled-search-input` (`type="search"` is the reliable marker)                                                                 |
| TextInput                                 | no rule — bare `<input>` markup is too generic to flag without drowning in false positives; found in review                         |
| ThemeToggle / theme store                 | `manual-color-scheme` (`prefers-color-scheme` queries and hand-toggled `dark` classes)                                              |
| VirtualList                               | `hand-rolled-virtualization` (library imports); unvirtualized long lists remain a perf review concern, not a lint                   |
| `trapFocus`                               | `hand-rolled-focus-trap` (the tabbable-elements selector string)                                                                    |
| `.kit-sr-only`, z tokens                  | `hand-rolled-sr-only`, `raw-z-index`                                                                                                |
| CommandPalette, shortcut system           | no rule — ad-hoc `keydown` listeners are legitimate in components; app-level shortcut sprawl is found in review                     |
| FitStages                                 | no rule — the hand-rolled equivalent is a media query, which `nonstandard-breakpoint` already flags                                 |
| `debounce`                                | `local-debounce` (relative debounce imports / inline implementations)                                                               |
| Formatters, `hashColor`                   | no rule — plain functions; duplication isn't detectable from markup                                                                 |

## Adoption path

An existing project will start with many findings (agentsview currently has
~230). Migrate in stages — each stage is a reviewable PR with its own
validation, not one big-bang switch:

1. **Tokens first**: add the dependency, import `theme.css`, remove any
   pinned `html { font-size }` (see the
   [typography migration map](theming.md#typography)), and map local palette
   variables onto kit-ui tokens. Run `kit-ui-check --warn` to get the counts
   visible in CI.
2. **Low-risk display primitives**: Chip, StatusDot, Spinner, KbdBadge,
   EmptyState, DiffStats, ColorLabel — visual swaps with no behavior.
3. **Stateful primitives**: Button, CopyButton, SegmentedControl, Table
   headers, Tooltip.
4. **Overlays and layout**: Modal, dropdowns/Typeahead, DetailDrawer,
   FlashBanner, sidebars/splitters, StatusBar, SettingsLayout.
5. **Utilities and theme store**: formatters, `debounce`, `hashColor`
   (note: colors shift vs middleman's old `repoColor`), `initTheme`.
6. **Enforce**: burn down the remaining findings per rule
   (`--rules raw-color`, etc.), then drop `--warn` so the checker blocks.
