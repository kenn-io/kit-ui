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

Scans `.svelte` and `.css` files; skips `node_modules`, `dist`, `build`,
`.svelte-kit`, `coverage`, `test-results`.

## Rules

| Rule | Flags | Use instead |
| --- | --- | --- |
| `nonstandard-breakpoint` | `@media` widths that aren't 640/760/900px (±1px complements allowed) | `BREAKPOINTS` / `MEDIA` from kit-ui ([theming](theming.md#breakpoints)) |
| `raw-color` | hex/rgb() colors in styles (allowed inside `var()` fallbacks; inside `color-mix()` only the `#000`/`#fff` shade constants) | theme tokens (`--accent-*`, `--bg-*`, `--text-*`, `--border-*`) |
| `hand-rolled-modal` | `position: fixed` + `inset: 0` overlays | `Modal`, `FlashBanner` |
| `hand-rolled-spinner` | `@keyframes` rotating to 360deg | `Spinner` |
| `hand-rolled-clipboard` | `navigator.clipboard.writeText`, `execCommand("copy")` | `copyToClipboard`, `CopyButton` |
| `hand-rolled-dropdown` | `role="combobox"` / `role="listbox"` markup | `SelectDropdown`, `Typeahead`, `FilterDropdown` |
| `hand-rolled-kbd` | raw `<kbd>` elements | `KbdBadge` |
| `hand-rolled-splitter` | `cursor: col-resize` dividers | `SplitResizeHandle`, `CollapsibleSidebar` |
| `hand-rolled-segmented` | `segmented-control` / `seg-btn` markup | `SegmentedControl` |
| `hand-rolled-table-sort` | `aria-sort=` on custom headers | `Table` + `TableHeaderCell` |
| `hand-rolled-tooltip` | `role="tooltip"` markup | `Tooltip` |
| `hand-rolled-status-bar` | `status-bar` classes/selectors (`kit-status-bar` exempt) | `StatusBar` |
| `hand-rolled-empty-state` | `empty-state` classes/selectors (`kit-empty-state` exempt) | `EmptyState` |
| `hand-rolled-icon-button` | `icon-btn` / `icon-button` classes/selectors | `IconButton` |
| `hand-rolled-top-bar` | `app-header` / `header-left` / `header-right` classes/selectors | `TopBar` |
| `nonstandard-spacing` | `gap` values off the spacing ladder (0/1px hairlines exempt) | `var(--space-1…8)` ([theming](theming.md#spacing)) |
| `pinned-root-font-size` | px `font-size` on `html`/`:root` | leave the root at 100% — it defeats the rem type scale ([theming](theming.md#typography)) |
| `legacy-mobile-type` | `--font-size-mobile-*` usage | the standard tokens; they resize on touch devices ([migration map](theming.md#typography)) |
| `legacy-svelte` | `on:event` directives, `export let` | runes mode (`$props`, `onclick`) |

## Suppressing a finding

Put `kit-ui-check-ignore` in a comment on the offending line or the line
above. Give a reason — the marker is a promise that a human decided the
exception is legitimate:

```css
/* kit-ui-check-ignore: brand color mandated by marketing */
.logo { color: #ff5533; }
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

| Component | Enforcement |
| --- | --- |
| Modal, FlashBanner, DetailDrawer | `hand-rolled-modal` (all are fixed inset-0 overlays) |
| Spinner | `hand-rolled-spinner` |
| CopyButton / `copyToClipboard` | `hand-rolled-clipboard` |
| SelectDropdown, Typeahead, FilterDropdown | `hand-rolled-dropdown` |
| KbdBadge | `hand-rolled-kbd` |
| SplitResizeHandle, CollapsibleSidebar | `hand-rolled-splitter` |
| SegmentedControl | `hand-rolled-segmented` |
| Table / TableHeaderCell | `hand-rolled-table-sort` |
| Tooltip | `hand-rolled-tooltip` |
| StatusBar | `hand-rolled-status-bar` |
| EmptyState | `hand-rolled-empty-state` |
| IconButton | `hand-rolled-icon-button` |
| TopBar | `hand-rolled-top-bar` |
| Button, Chip, ChipStack | no rule — generic button/badge markup has no reliable signature; token rules catch the styling drift |
| StatusDot, ColorLabel, DiffStats | no rule — small display primitives with no detectable marker; found in review |
| RefreshControl, FindBar, RangePicker, SettingsLayout/Section | no rule — composite widgets; no stable class/aria signature that wouldn't false-positive. Revisit if either app regrows one |
| Calendar | no rule — covered indirectly: hand-rolled month grids read as generic tables/buttons; found in review |
| TextInput, SearchInput | no rule — bare `<input>` markup is too generic to flag without drowning in false positives; found in review |
| ThemeToggle | no rule — a theme button has no stable signature; the theme *store* swap is stage 5 of the adoption path |
| FitStages | no rule — the hand-rolled equivalent is a media query, which `nonstandard-breakpoint` already flags |
| Theme store, formatters, `debounce`, `hashColor` | no rule — plain functions; duplication isn't detectable from markup |

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
