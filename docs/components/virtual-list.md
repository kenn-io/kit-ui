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
| `ariaLabel` | `string` | — | Label for the `role="list"` container |
| `row` | `Snippet<[T, number, boolean]>` | required | `(item, index, isActive)` |
| `empty` | `Snippet` | — | Rendered instead of the list when `items` is empty |
| `class` | `string` | `""` | |

Also exported on the instance: `scrollToIndex(index)` — scrolls the row to
the nearest edge (`bind:this` to call it).

## Keyboard and focus

Focus lives on the **container** (tab stop), never on rows — so
virtualization unmounting a row can never drop focus. ↑/↓/Home/End move
`activeIndex` (kept in view), Enter fires `onactivate`. Rows are plain
`role="listitem"` wrappers; pointer-down sets the active row and
double-click activates. Interactive content *inside* rows (buttons, links)
works normally but should be reachable through other means too (e.g. the
activate handler opening a detail view) — a row that scrolls out of the
window takes its tab stops with it.

## Sizing contract

- The container needs a bounded height (`height` prop, a flex parent with
  `min-height: 0`, or an absolute fill) — with unbounded height nothing
  virtualizes.
- Sticky headers: render the header *outside* the VirtualList (the classic
  table-header-over-scroll-body layout). Content inside the window is
  transformed, so `position: sticky` inside rows won't stick.
- Row snippets in variable mode may wrap/resize freely — each rendered row
  is observed and the window recomputes on real heights.

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
