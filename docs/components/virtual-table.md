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

| Prop                | Type                                  | Default                    | Notes                                                                                                                     |
| ------------------- | ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `items`             | `T[]`                                 | required                   | Every row's data, in display order                                                                                        |
| `header`            | `Snippet`                             | required                   | `<TableHeaderCell>` elements, as in `Table`                                                                               |
| `row`               | `Snippet<[T, number]>`                | required                   | `(item, index)`; renders exactly one `<tr>`                                                                               |
| `rowKey`            | `(item: T, index: number) => unknown` | index                      | Stable row identity for keyed rendering                                                                                   |
| `empty`             | `Snippet`                             | —                          | A `<tr>` shown when `items` is empty; a window scrolled out of view shows no rows instead                                 |
| `scroll`            | `"self" \| "page"`                    | `"self"`                   | What scrolls the rows, as on `Table`                                                                                      |
| `scrollElement`     | `() => HTMLElement \| null`           | nearest scrolling ancestor | With `scroll="page"`, the element that scrolls the table                                                                  |
| `estimateRowHeight` | `number`                              | `36`                       | Height in px of rows not yet rendered. Set it near the real row height: it sizes the scrollbar and places unmeasured rows |
| `overscan`          | `number`                              | `8`                        | Rows rendered beyond each edge of the visible area                                                                        |
| `stickyHeader`      | `boolean`                             | `true`                     | As on `Table`                                                                                                             |
| `zebra`             | `boolean`                             | `true`                     | As on `Table`; stripes follow the row index, not the rendered position                                                    |
| `ariaLabel`         | `string`                              | —                          |                                                                                                                           |
| `unsorted`          | `boolean`                             | `false`                    | As on `Table`; kit-ui-check reads it on `VirtualTable` too                                                                |
| `class`             | `string`                              | `""`                       | Applied to the scroll wrapper                                                                                             |

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

Under automatic layout, column widths depend on the rows rendered, so they
would shift as different rows scroll in, and widths taken from the first
screen would not fit longer values further down. To pin the columns,
VirtualTable briefly renders up to 50 rows sampled evenly across the whole
list, first and last included, after the visible rows with
`visibility: collapse`: Chrome gives them no height and hides them, but they
still count toward the column widths. It pins each header cell's width,
switches to fixed layout, and unmounts the samples in the same update,
before paint, so their form fields never submit and queries for the
table's rows never see them.

- The columns are pinned again when the items array changes (new data, a
  filter, a sort), when the table's width changes, and when a column is
  added or removed. An empty list stays unpinned until rows render.
- Pinned header cells use border-box sizing, so the measured width is the
  final width whatever the app's `box-sizing`.
- Text wider than its pinned column wraps, breaking inside a long word when
  it has to. Content that cannot wrap (buttons, chips) should fit the widest
  sampled value.

## Limits

- Rows off screen are not in the DOM: the browser's find-in-page does not
  see them, and Tab moves through rendered rows only (the page scrolls
  along as focus moves down, rendering the next rows).
- Focus inside a row is lost if that row is scrolled far enough away to
  unmount.
