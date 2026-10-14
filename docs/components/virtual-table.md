# VirtualTable

A [Table](table.md) for long row sets. Only the rows on screen, plus
`overscan` rows on each side, are in the DOM; spacer rows stand in for the
rest, so the scrollbar still measures the whole table. Use it when a table
can grow past a few hundred rows; below that, a plain `Table` is simpler.

It stays a real `<table>`: sortable headers, zebra stripes, hover, sticky
header, and links or buttons inside cells behave as they do in `Table`.
Use [VirtualList](virtual-list.md) instead for a keyboard-navigated list
whose rows are options, not cells.

```svelte
<script lang="ts">
  import { TableHeaderCell, TableSort, VirtualTable } from "@kenn-io/kit-ui";

  let { reviews }: { reviews: Review[] } = $props();

  const sorter = new TableSort<Review>(
    { project: (r) => r.project, completed: (r) => r.completedAt },
    { key: "completed", direction: "desc" },
  );
</script>

<VirtualTable items={sorter.sort(reviews)} rowKey={(r) => r.id} ariaLabel="Reviews">
  {#snippet header()}
    <TableHeaderCell label="Project" sort={sorter} column="project" />
    <TableHeaderCell label="Completed" sort={sorter} column="completed" />
  {/snippet}
  {#snippet row(review)}
    <tr>
      <td><a href="#/reviews/{review.id}">{review.project}</a></td>
      <td>{review.completedAt}</td>
    </tr>
  {/snippet}
</VirtualTable>
```

## Props

| Prop                   | Type                                      | Default                    | Notes                                                                                                                     |
| ---------------------- | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `items`                | `T[]`                                     | required                   | Every row's data, in display order                                                                                        |
| `header`               | `Snippet`                                 | required                   | `<TableHeaderCell>` elements, as in `Table`                                                                               |
| `row`                  | `Snippet<[T, number]>`                    | required                   | `(item, index)`; renders exactly one `<tr>`                                                                               |
| `rowKey`               | `(item: T, index: number) => unknown`     | index                      | Stable row identity for keyed rendering                                                                                   |
| `empty`                | `Snippet`                                 | —                          | A `<tr>` shown when `items` is empty; a window scrolled out of view shows no rows instead                                 |
| `scroll`               | `"self" \| "page"`                        | `"self"`                   | What scrolls the rows, as on `Table`                                                                                      |
| `scrollElement`        | `() => HTMLElement \| null`               | nearest scrolling ancestor | With `scroll="page"`, the element that scrolls the table                                                                  |
| `estimateRowHeight`    | `number`                                  | `36`                       | Height in px of rows not yet rendered. Set it near the real row height: it sizes the scrollbar and places unmeasured rows |
| `overscan`             | `number`                                  | `8`                        | Rows rendered beyond each edge of the visible area                                                                        |
| `stickyHeader`         | `boolean`                                 | `true`                     | As on `Table`                                                                                                             |
| `zebra`                | `boolean`                                 | `true`                     | As on `Table`; stripes follow the row index, not the rendered position                                                    |
| `ariaLabel`            | `string`                                  | —                          |                                                                                                                           |
| `unsorted`             | `boolean`                                 | `false`                    | As on `Table`; kit-ui-check reads it on `VirtualTable` too                                                                |
| `fitColumn`            | `(column: number) => number \| undefined` | —                          | Content width in px for fitting a column; undefined measures sampled rows                                                 |
| `oncolumnwidthschange` | `(widths: number[]) => void`              | —                          | Every column's width, in order, after a resize or fit                                                                     |
| `class`                | `string`                                  | `""`                       | Applied to the scroll wrapper                                                                                             |

## Scrolling

Like [TanStack Virtual](https://tanstack.com/virtual), VirtualTable follows
one scroll container you name and does not try to track every layout change
around it:

- **`scroll="self"` (default).** The table's wrapper scrolls; give it a
  bounded height. The header sticks to the wrapper.
- **`scroll="page"`.** The table grows to its full height and the page or
  panel around it scrolls: the nearest scrolling ancestor, the document, or
  the element `scrollElement` returns. The header sticks to the page; see
  [Table](table.md#scrolling-and-the-sticky-header) for the padding offset.

The visible rows are recomputed when that container scrolls or changes
size, when the window resizes, and when a rendered row changes height. The
table's position in the container is read each time, so content above it
that moved is picked up on the next scroll. After a layout change with no
scroll and no resize, such as content above the table collapsing, call
`refresh()` on the instance:

```svelte
<VirtualTable bind:this={table} scroll="page" …>…</VirtualTable>

<!-- after a card above the table closes -->
table.refresh();
```

Rows that resize above the view keep the content in place through the
browser's scroll anchoring, which current Chrome provides.

## Rows

- Each `row` renders exactly one `<tr>`. Every rendered row is observed and
  measured when it changes height, so rows may wrap or vary in height.
- Measurements are kept per index for the current `items` array; a new
  array (sort, filter, refresh) re-measures rows as they render.
- Rows are numbered for assistive technology: the table gets
  `aria-rowcount` (all rows plus the header) and each rendered row its
  `aria-rowindex`.

## Column widths

Columns work as in [gpui-kit](https://github.com/longbridge/gpui-kit)'s
table: each column has a width, kept while the rows scroll and change, and
people resize it or fit it to its content.

- **Starting width.** A `TableHeaderCell` with `width` starts at that width.
  The others are measured once, in a hidden copy of the table holding the
  rows on screen and up to 50 rows sampled evenly across the list (first and
  last included). The copy sits in its own `<form>` and is removed before
  paint, so its copied form fields never join the app's form or radio groups.
- **Resizing.** Each header cell's right edge has a 1px resize handle
  ([SplitResizeHandle](split-resize-handle.md) with `variant="column"`):
  drag it, or focus it and press the arrow keys. `resizable={false}` removes
  it. A column narrower than its label clips the label with an ellipsis.
- **Fitting.** Double-click a handle, or press Enter on it, to fit the column
  to its content. VirtualTable measures the widest value in the copy's
  rows; `fitColumn(column)` can return the content width instead,
  from what the app knows about its data. The header cell's padding is added.
- **Limits.** `minWidth` (default 20) and `maxWidth` (default 1200) bound
  resizing and fitting, and a measured starting width.
- **Saving.** After a resize or fit, `oncolumnwidthschange(widths)` reports
  every column's width in order; pass them back as `width` to restore them.
- **Filling.** When the widths add up to less than the table's box, the last
  column takes the rest. When they add up to more, the table scrolls
  sideways.

Widths are kept by the header's `column` (or its label), so hiding one
column keeps the others' widths. Text wider than its column wraps, breaking
inside a long word when it has to. Pinned header cells use border-box
sizing, so a width is the cell's whole width whatever the app's
`box-sizing`.

## Limits

- Rows off screen are not in the DOM: the browser's find-in-page does not
  see them, and Tab moves through rendered rows only (the page scrolls
  along as focus moves down, rendering the next rows).
- Focus inside a row is lost if that row is scrolled far enough away to
  unmount.
