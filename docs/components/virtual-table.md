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

| Prop                | Type                                      | Default                    | Notes                                                                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`             | `T[]`                                     | required                   | Every row's data, in display order                                                                                                                                                                                                                                            |
| `header`            | `Snippet`                                 | required                   | `<TableHeaderCell>` elements, as in `Table`                                                                                                                                                                                                                                   |
| `row`               | `Snippet<[T, number]>`                    | required                   | `(item, index)`; renders exactly one `<tr>`                                                                                                                                                                                                                                   |
| `rowKey`            | `(item: T, index: number) => unknown`     | index                      | Stable row identity: keys the rendered rows and the measured heights, so heights survive inserts, removals, reorders, and appends                                                                                                                                             |
| `empty`             | `Snippet`                                 | —                          | A `<tr>` shown when `items` is empty; a window scrolled out of view shows no rows instead                                                                                                                                                                                     |
| `scroll`            | `"self" \| "page"`                        | `"self"`                   | What scrolls the rows, as on `Table`                                                                                                                                                                                                                                          |
| `scrollElement`     | `() => HTMLElement \| null`               | nearest scrolling ancestor | With `scroll="page"`, the element that scrolls the table                                                                                                                                                                                                                      |
| `estimateRowHeight` | `number`                                  | `36`                       | Height in px of rows not yet rendered. Set it near the real row height: it sizes the scrollbar and places unmeasured rows. The window follows measured heights one frame later, so an estimate far above the real height, with little overscan, can show a gap for that frame |
| `overscan`          | `number`                                  | `8`                        | Rows rendered beyond each edge of the visible area. They also cover the frame before the window follows newly measured heights                                                                                                                                                |
| `stickyHeader`      | `boolean`                                 | `true`                     | As on `Table`                                                                                                                                                                                                                                                                 |
| `zebra`             | `boolean`                                 | `true`                     | As on `Table`; stripes follow the row index, not the rendered position                                                                                                                                                                                                        |
| `ariaLabel`         | `string`                                  | —                          |                                                                                                                                                                                                                                                                               |
| `unsorted`          | `boolean`                                 | `false`                    | As on `Table`; kit-ui-check reads it on `VirtualTable` too                                                                                                                                                                                                                    |
| `fitColumn`         | `(column: number) => number \| undefined` | —                          | Content width in px for fitting a column; undefined measures sampled rows                                                                                                                                                                                                     |
| `oncolumnresize`    | `(change: ColumnResize) => void`          | —                          | A person set a column's width (drag or arrow key that changed it, or a fit): `{ column, index, width }`. Automatic sizing never calls it                                                                                                                                      |
| `class`             | `string`                                  | `""`                       | Applied to the scroll wrapper                                                                                                                                                                                                                                                 |

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
- With `rowKey`, measurements are kept by row key, so a row keeps its
  height when rows are inserted, removed, reordered, or appended around it.
  Opening a detail row below a row, or loading the next page, leaves every
  measured row where it was; only rows never rendered count at
  `estimateRowHeight`. Without `rowKey` they are kept per index for the
  current `items` array, and a new array re-measures rows as they render.
- Rows are numbered for assistive technology: the table gets
  `aria-rowcount` (all rows plus the header) and each rendered row its
  `aria-rowindex`.

## Column widths

Columns work as in [gpui-kit](https://github.com/longbridge/gpui-kit)'s
table: each column has a width, kept while the rows scroll and change, and
people resize it or fit it to its content.

- **Starting width.** A `TableHeaderCell` with `width` starts at that width.
  The others are measured in a hidden copy of the table holding the rows on
  screen and up to 50 rows sampled evenly across the list (first and last
  included). The copy sits in its own `<form>` and is removed before paint,
  so its copied form fields never join the app's form or radio groups.
- **Following the table's width.** When the table's box changes width (the
  window or a panel resizing), every column nobody resized or fitted is
  sized again for the new width: a header's `width` is read again, and the
  others are measured again. Columns a person resized or fitted keep their
  widths. Nothing is rebuilt, so measured row heights and the scroll
  position stay. A column nobody resized also follows its header's `width`
  when the app changes it. A table with no rows has nothing to measure: it
  shows the widths it has in the new box, the filling or last column taking
  the spare width, and sizes its columns for that box when rows return.
- **Resizing.** Each header cell's right edge has a 1px resize handle
  ([SplitResizeHandle](split-resize-handle.md) with `variant="column"`):
  drag it, or focus it and press the arrow keys. `resizable={false}` removes
  it. A column narrower than its label clips the label with an ellipsis.
  The handle's accessible name defaults to English "Resize the {label}
  column"; pass a translated `resizeLabel` on the header cell.
- **Fitting.** Double-click a handle, or press Enter on it, to fit the column
  to its content. VirtualTable measures the widest value in the copy's
  rows; `fitColumn(column)` can return the content width instead,
  from what the app knows about its data. The header cell's padding is added.
- **Limits.** `minWidth` (default 20) and `maxWidth` (default 1200) bound
  resizing and fitting, and a measured starting width.
- **Saving.** When a person sets a column's width, `oncolumnresize` reports
  `{ column, index, width }`: `column` is the header's `column` (or its
  label), `width` the new border-box width in px. It fires for a drag or
  arrow key that changed the width and for a fit; a click or drag that ends
  where it started, an arrow key at a limit, and automatic sizing report
  nothing. Keep just that column and pass it back as `width` to restore it:

  ```svelte
  <VirtualTable oncolumnresize={({ column, width }) => (kept[column] = width)} …>
    {#snippet header()}
      <TableHeaderCell label="File" column="file" width={kept.file} />
    {/snippet}
  </VirtualTable>
  ```

- **Filling.** When the widths add up to less than the table's box, the last
  column takes the rest. When they add up to more, the table scrolls
  sideways. To give the spare width to another column, such as a leading
  Name column, set `fill` on its `TableHeaderCell`; see
  [Filling column](#filling-column).

### Filling column

A `TableHeaderCell` with `fill` takes whatever width the other columns leave
in the table's box:

```svelte
<VirtualTable items={sorter.sort(files)} rowKey={(f) => f.id} ariaLabel="Files">
  {#snippet header()}
    <TableHeaderCell label="Name" sort={sorter} column="name" fill minWidth={160} />
    <TableHeaderCell label="Size" numeric sort={sorter} column="size" />
    <TableHeaderCell label="Modified" sort={sorter} column="modified" />
  {/snippet}
  {#snippet row(file)}
    <tr><td>{file.name}</td><td>{file.size}</td><td>{file.modified}</td></tr>
  {/snippet}
</VirtualTable>
```

- **Width.** The filling column is as wide as the box minus the other
  columns, and never narrower than its `minWidth`. Its `width` and `maxWidth`
  do not apply. When the other columns leave less than `minWidth`, the table
  is wider than its box and scrolls sideways.
- **The other columns.** They start at their content's width, measured as
  above, so the spare width goes to the filling column instead of being
  spread over every column. When those widths, each within the column's
  `minWidth` and `maxWidth`, are too wide for the box with the filling
  column at its `minWidth`, every column takes its share of the box
  instead, as without `fill`. A `width` on them still sets their
  starting width.
- **Resizing.** The filling column has no resize handle, so it cannot be
  resized or fitted. Resizing another column gives width to it or takes
  width from it, and a resize of the box widens or narrows it.
- **Changing it.** Setting `fill` on another column moves the spare width to
  that column right away. The column that gave it up starts at its content's
  width.
- **Saving.** `oncolumnresize` never names the filling column, since nobody
  resizes it. Keep the other columns' widths; the filling column follows.
- **One column.** Set `fill` on one header cell. When several have it, the
  first fills and the others act as ordinary columns without a resize
  handle.

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
