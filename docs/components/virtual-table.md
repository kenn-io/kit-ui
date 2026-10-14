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

| Prop                | Type                                  | Default  | Notes                                                                                                                                                                |
| ------------------- | ------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`             | `T[]`                                 | required | Every row's data, in display order                                                                                                                                   |
| `header`            | `Snippet`                             | required | `<TableHeaderCell>` elements, as in `Table`                                                                                                                          |
| `row`               | `Snippet<[T, number]>`                | required | `(item, index)`; renders exactly one `<tr>`                                                                                                                          |
| `rowKey`            | `(item: T, index: number) => unknown` | index    | Stable row identity for keyed rendering                                                                                                                              |
| `empty`             | `Snippet`                             | —        | A `<tr>` shown when `items` is empty; a window scrolled out of view shows no rows instead                                                                            |
| `estimateRowHeight` | `number`                              | `36`     | Height in px for rows before any has rendered; afterwards the average of the first rendered rows is used, fixed so later rows growing never move rows above the view |
| `overscan`          | `number`                              | `8`      | Rows rendered beyond each edge of the visible area                                                                                                                   |
| `stickyHeader`      | `boolean`                             | `true`   | As on `Table`                                                                                                                                                        |
| `zebra`             | `boolean`                             | `true`   | As on `Table`; stripes follow the row index, not the rendered position                                                                                               |
| `ariaLabel`         | `string`                              | —        |                                                                                                                                                                      |
| `unsorted`          | `boolean`                             | `false`  | As on `Table`; kit-ui-check reads it on `VirtualTable` too                                                                                                           |
| `class`             | `string`                              | `""`     | Applied to the scroll wrapper                                                                                                                                        |

## Scrolling

The table follows whichever container scrolls it, so it needs no layout of
its own:

- **Page scrolling.** Left unbounded, the table is as tall as all its rows,
  and the page's scroll container decides which rows are on screen. The
  header sticks to the top of the page.
- **Its own wrapper.** Give the wrapper a bounded height (a flex parent with
  a fixed height, or a `class` with `max-height`) and the table scrolls
  inside it, with the header stuck to the wrapper.

See [Table: Sticky header](table.md#sticky-header) for the page padding
offset.

Visibility is measured against every ancestor that clips vertically and the
window. It is measured again on any scroll, on a window resize, and when the
table or any of its ancestors changes size. It also watches the table and
every rendered row enter and leave view, so the rows follow the table when
content above it collapses, even inside a fixed-height scroller.

## Rows

- Each `row` renders exactly one `<tr>`. Row heights are measured as rows
  render, so rows may wrap or vary in height.
- Measurements are kept per index for the current `items` array; a new
  array (sort, filter, refresh) re-measures rows as they render.
- Rows are numbered for assistive technology: the table gets
  `aria-rowcount` (all rows plus the header) and each rendered row its
  `aria-rowindex`.

## Column widths

Under automatic layout, column widths depend on the rows rendered, so they
would shift as different rows scroll in. VirtualTable lets the first
rendered rows lay the table out, then pins each header cell's width and
switches to fixed layout. Pinned header cells use border-box sizing, so the
measured width is the final width whatever the app's `box-sizing`. It lays
the table out again when the table's width changes or a column is added or
removed. Only rendered data rows decide the widths: while none render (an
empty list, or a window scrolled out of view), the columns stay unpinned
until rows render again. Text wider than its pinned column
wraps, breaking inside a long word when it has to; content that cannot wrap
(buttons, chips) should be no wider than the column it had in the first
rows.

## Limits

- Rows off screen are not in the DOM: the browser's find-in-page does not
  see them, and Tab moves through rendered rows only (the page scrolls
  along as focus moves down, rendering the next rows).
- Focus inside a row is lost if that row is scrolled far enough away to
  unmount.
