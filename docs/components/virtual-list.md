# VirtualList

Windowed list for long datasets (sessions, log lines, table rows): only the
visible slice plus `overscan` rows exist in the DOM. Fixed row height is the
fast path; omit `itemHeight` for variable-height rows, which are measured as
they render (`estimateHeight` until then) with offsets staying correct.

The windowing math itself is exported as pure functions (`virtualSlice`,
`offsetOfIndex`) — unit-tested in `checks/virtual.test.ts` and reusable for
custom virtualized surfaces (LogViewer-style scrollback, virtual tables).

```svelte
<script lang="ts">
  import { VirtualList } from "@kenn-io/kit-ui";

  let active = $state(-1);
</script>

<VirtualList
  items={sessions}
  estimateHeight={36}
  bind:activeIndex={active}
  onactivate={(item) => open(item)}
  ariaLabel="Sessions"
>
  {#snippet row(item, index, isActive)}
    <SessionRow {item} highlighted={isActive} />
  {/snippet}
  {#snippet empty()}<EmptyState title="No sessions" />{/snippet}
</VirtualList>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `T[]` | required | |
| `itemHeight` | `number` | — | Fixed row height in px (fast path, no measuring) |
| `estimateHeight` | `number` | `32` | Height guess for unmeasured variable rows |
| `overscan` | `number` | `4` | Rows rendered beyond each viewport edge |
| `height` | `string` | `"100%"` | CSS height of the scroll container |
| `activeIndex` | `number` (bindable) | `-1` | Keyboard-highlighted row; −1 = none |
| `onactivate` | `(item: T, index: number) => void` | — | Enter / double-click on the active row |
| `onrangechange` | `(start: number, end: number) => void` | — | Rendered range `[start, end)` changed |
| `ariaLabel` | `string` | required | Label for the `role="listbox"` container — it's the focusable keyboard target and must be announced with a name |
| `row` | `Snippet<[T, number, boolean]>` | required | `(item, index, isActive)` |
| `empty` | `Snippet` | — | Rendered instead of the list when `items` is empty |
| `class` | `string` | `""` | |

Also exported on the instance: `scrollToIndex(index)` — scrolls the row to
the nearest edge (`bind:this` to call it).

## Keyboard and focus

Focus lives on the **container** (tab stop), never on rows — so
virtualization unmounting a row can never drop focus. The ARIA pattern is
`role="listbox"` with `aria-activedescendant` pointing at the active
`role="option"` row (stable per-index ids), so screen readers announce the
active row as arrows move it. ↑/↓/Home/End move `activeIndex` (kept in
view), Enter fires `onactivate`; keys are only handled while the container
itself has focus, so typing in interactive row content is untouched.
Pointer-down on a row sets the active row and double-click activates —
except when the press lands on interactive content (buttons, links,
fields), which keeps its own behavior.

**Rows must not contain tabbable interactive content** (buttons, links,
fields). `role="option"` doesn't support nested interactive semantics —
screen readers flatten or misannounce it — and virtualization unmounts
off-screen rows, silently removing their tab stops mid-Tab-cycle. Route
actions through `onactivate` (open a detail view, a context menu, a
toolbar acting on the active row) instead. The pointer/keyboard guards
that skip interactive content exist as a defensive fallback for rows that
break this contract, not as support for it.

State contracts:

- `activeIndex` is clamped when `items` shrinks past it (to the last row,
  or −1 when the list empties), so the bound value, the visual highlight,
  and Enter's target never disagree after filtering.
- Setting `activeIndex` from outside (controlled selection, initial
  focus) scrolls the row into view, keeping `aria-activedescendant`
  pointing at a rendered option.

Acceptance checklist (automated coverage tracked under the browser test
infra work): container announces its name and the active option;
↑/↓/Home/End move and announce; Enter activates only the highlighted row;
filtering that shrinks the list clamps the active row; an externally set
active row scrolls into view; empty list renders the `empty` snippet with
no keyboard errors.

## Sizing contract

- The container needs a bounded height (`height` prop, a flex parent with
  `min-height: 0`, or an absolute fill) — with unbounded height nothing
  virtualizes.
- Sticky headers: render the header *outside* the VirtualList (the classic
  table-header-over-scroll-body layout). Content inside the window is
  transformed, so `position: sticky` inside rows won't stick.
- Row snippets in variable mode may wrap/resize freely — each rendered row
  is observed and the window recomputes on real heights.
- Measurements are keyed by index **for the current `items` array** — a new
  array identity (filter/sort/replace) drops the cache and rows re-measure
  as they render. Appending by replacing the array therefore re-estimates
  scrolled-away rows; mutate-and-reassign the same array only if you know
  indexes are stable.

## Low-level API

```ts
import { virtualSlice, offsetOfIndex } from "@kenn-io/kit-ui";

const { start, end, topPad, totalHeight } = virtualSlice({
  scrollTop, viewport, count, overscan: 4,
  heightOf: (i) => heights[i] ?? 32,
});
```

Render `items[start..end)` inside a `totalHeight` spacer, translated down
by `topPad`. One O(count) pass per call — fine into the tens of thousands
of rows; beyond that, precompute prefix sums.
