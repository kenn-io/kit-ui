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
| `raw-color` | hex/rgb() colors in styles (allowed inside `var()` fallbacks and `color-mix()`) | theme tokens (`--accent-*`, `--bg-*`, `--text-*`, `--border-*`) |
| `hand-rolled-modal` | `position: fixed` + `inset: 0` overlays | `Modal`, `FlashBanner` |
| `hand-rolled-spinner` | `@keyframes` rotating to 360deg | `Spinner` |
| `hand-rolled-clipboard` | `navigator.clipboard.writeText`, `execCommand("copy")` | `copyToClipboard`, `CopyButton` |
| `hand-rolled-dropdown` | `role="combobox"` / `role="listbox"` markup | `SelectDropdown`, `Typeahead`, `FilterDropdown` |
| `hand-rolled-kbd` | raw `<kbd>` elements | `KbdBadge` |
| `hand-rolled-splitter` | `cursor: col-resize` dividers | `SplitResizeHandle`, `CollapsibleSidebar` |
| `hand-rolled-segmented` | `segmented-control` / `seg-btn` markup | `SegmentedControl` |
| `hand-rolled-table-sort` | `aria-sort=` on custom headers | `Table` + `TableHeaderCell` |
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

## Adoption path

An existing project will start with many findings (agentsview currently has
~230). Suggested rollout: run with `--warn` in CI to get the count visible,
burn down per rule (`--rules raw-color`, etc.), then drop `--warn` to make it
blocking.
