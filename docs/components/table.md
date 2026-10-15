# Table + TableHeaderCell + TableSort

Data-table primitives consolidating Forge's `JobTable` and agentsview's
`SessionsTable` header patterns: `Table` is the shell (scroll wrapper, sticky
header, zebra striping, row hover); `TableHeaderCell` is a header cell with a
sort button and `aria-sort`; `TableSort` holds client-side sort state.

## Every table sorts

People expect to click any column heading to sort by it. Every labeled header
must sort, and kit-ui-check's `unsorted-table-header` rule enforces this; it
cannot be suppressed or disabled.

To leave a table unsorted, opt out explicitly with `unsorted` on `Table`,
for example a short fixed list with one row per status. Write its `header`
snippet inside the `<Table>` tags: the checker reads `unsorted` from the
enclosing `Table`, so a header snippet declared elsewhere and passed as
`header={…}` is still checked. Headers with no visible text, such as a checkbox or actions column,
and row headers (`<th scope="row">`) need no sorting.

## Client-side data: TableSort

Declare each column's sort value once, pass the sorter to every header, and
render `sorter.sort(rows)`:

```svelte
<script lang="ts">
  import { Table, TableHeaderCell, TableSort } from "@kenn-io/kit-ui";

  let { jobs }: { jobs: Job[] } = $props();

  const sorter = new TableSort<Job>(
    {
      id: (job) => job.id,
      status: (job) => job.status,
      // Biggest first on the first click.
      cost: { value: (job) => job.cost, firstDirection: "desc" },
    },
    { key: "id" },
  );
</script>

<Table ariaLabel="Review jobs">
  {#snippet header()}
    <TableHeaderCell label="ID" sort={sorter} column="id" />
    <TableHeaderCell label="Status" sort={sorter} column="status" />
    <TableHeaderCell label="Cost" numeric sort={sorter} column="cost" />
  {/snippet}
  {#each sorter.sort(jobs) as job (job.id)}
    <tr>
      <td>#{job.id}</td>
      <td>{job.status}</td>
      <td>${job.cost}</td>
    </tr>
  {/each}
</Table>
```

- Text sorts by locale, ignoring case, with natural numbers (`v2` before
  `v10`). Numbers, bigints, booleans, and dates sort by value. A column
  mixing kinds sorts numbers, bigints, and dates first, then text, then
  booleans.
- `null`, `undefined`, `NaN`, and invalid dates sort last in both directions.
- The sort is stable: ties keep the input order, so pass rows in the order you
  want ties to keep.
- A column's first click uses `firstDirection` (default `"asc"`); a second
  click reverses it.
- Leave out the initial sort to keep rows in the order they arrive in, such
  as a server's or a curated order, until someone clicks a header. Each
  column then cycles through its first direction, the reverse, and back to
  that order.

The pure helpers `sortRows`, `nextSort`, and `compareSortValues` are exported
for sorting outside a component.

## Server-sorted data

When the server orders the rows, such as a paginated list, sorting a page in
the browser would be wrong. Keep the order on the server and drive the header
yourself:

```svelte
<TableHeaderCell
  label="Created"
  sortable
  sortDirection={query.sort === "created" ? query.direction : null}
  onsort={() => setSort("created")}
/>
```

## Scrolling and the sticky header

Say what scrolls the rows with `scroll`; the table never guesses:

- **`scroll="self"` (default).** The wrapper scrolls. Give it a bounded
  height (a flex parent with a fixed height, or a `class` with
  `max-height`). The header sticks to the wrapper's top edge.
- **`scroll="page"`.** The table grows to its full height and the page or
  panel around it scrolls. The wrapper clips without scrolling, so the
  header sticks to the top of that scroll container. When the table is
  wider than the wrapper (a narrow screen), the wrapper scrolls sideways
  instead, and the header no longer sticks to the page.

A header stuck to a page scroller stops below the scroller's top padding,
so rows show in the padding above it. Cover the padding by setting
`--kit-table-sticky-top` to its negative on the scroll container; only
`scroll="page"` tables use it:

```css
.page {
  padding-top: 24px;
  --kit-table-sticky-top: -24px;
}
```

An ancestor between a page-scrolled table and the page that sets
`overflow: hidden` or `auto` becomes the header's scroll container and stops
it sticking to the page; use `overflow: clip` there.

## Theming

The scroll wrapper reads `--shadow-panel` (no shadow by default) and header
cells read `--bg-table-header` (falls back to `--bg-inset`). Once rows scroll
beneath a sticky header, the header casts `--shadow-raised`. All three are
depth tokens; see [Theming](../theming.md#identity-tokens).

When a theme sets `--shadow-panel`, its ring paints outside the scroll
wrapper, so a parent with `overflow: hidden` clips it, and a Table inside a
raised Card shows a second frame.

## Bare tables

Some tables need structure the standard shell does not render: several
`<tbody>` row groups, a `<colgroup>`, or header rows that span columns. Pass
`bare` and write the whole table body yourself.

```svelte
<div class="hosts">
  <Table unsorted bare ariaLabel="Hosts by region">
    <thead>
      <tr>
        <th scope="col">Host</th>
        <th scope="col">Load</th>
      </tr>
    </thead>
    {#each regions as region (region.name)}
      <tbody>
        <tr><th scope="rowgroup" colspan="2">{region.name}</th></tr>
        {#each region.hosts as host (host.name)}
          <tr>
            <th scope="row">{host.name}</th>
            <td>{host.load}%</td>
          </tr>
        {/each}
      </tbody>
    {/each}
  </Table>
</div>
```

A bare table renders only the `<table>` element, with `class` and `ariaLabel`.
It has no scroll wrapper, sticky header, zebra striping or row hover, and
kit-ui's table styles do not apply. Style it from an element your component
owns, such as `.hosts :global(table)`, because the `<table>` belongs to
`Table`. `unsorted` works as on any `Table`; without it, every labeled column
header must sort.

## Table props

| Prop           | Type               | Default                | Notes                                                                                                                                                           |
| -------------- | ------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header`       | `Snippet`          | required unless `bare` | `<TableHeaderCell>` elements                                                                                                                                    |
| `children`     | `Snippet`          | required               | `<tr>` body rows; with `bare`, everything inside the `<table>`                                                                                                  |
| `scroll`       | `"self" \| "page"` | `"self"`               | What scrolls the rows ([Scrolling](#scrolling-and-the-sticky-header))                                                                                           |
| `stickyHeader` | `boolean`          | `true`                 | Header stays visible while the rows scroll                                                                                                                      |
| `zebra`        | `boolean`          | `true`                 | Stripe even rows                                                                                                                                                |
| `ariaLabel`    | `string`           | —                      |                                                                                                                                                                 |
| `unsorted`     | `boolean`          | `false`                | Opts the table out of sorting; its headers need not sort                                                                                                        |
| `bare`         | `boolean`          | `false`                | Render only a plain `<table>` with `class` and `ariaLabel`; `children` holds its whole content, and `header`, `scroll`, `stickyHeader` and `zebra` do not apply |
| `class`        | `string`           | `""`                   | Applied to the scroll wrapper; with `bare`, to the table                                                                                                        |

## TableHeaderCell props

| Prop            | Type                      | Default | Notes                                                                                             |
| --------------- | ------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `label`         | `string`                  | —       | Header text (or use `children`)                                                                   |
| `children`      | `Snippet`                 | —       | Custom header content                                                                             |
| `sort`          | `TableSortControl`        | —       | A `TableSort`; replaces `sortable`, `sortDirection`, `onsort`                                     |
| `column`        | `string`                  | —       | This column's key in `sort`; required with `sort`                                                 |
| `sortable`      | `boolean`                 | `false` | Render the sort button for server-sorted data                                                     |
| `sortDirection` | `"asc" \| "desc" \| null` | `null`  | This column's current direction; sets `aria-sort`                                                 |
| `onsort`        | `() => void`              | —       | Click handler; toggle direction in your state                                                     |
| `numeric`       | `boolean`                 | `false` | Right-align (numbers, costs, durations)                                                           |
| `width`         | `number`                  | —       | VirtualTable: the column's starting width in px ([Column widths](virtual-table.md#column-widths)) |
| `minWidth`      | `number`                  | `20`    | VirtualTable: the narrowest a resize or fit makes the column                                      |
| `maxWidth`      | `number`                  | `1200`  | VirtualTable: the widest a resize or fit makes the column                                         |
| `resizable`     | `boolean`                 | `true`  | VirtualTable: show the resize handle on the cell's right edge                                     |
| `class`         | `string`                  | `""`    |                                                                                                   |

## TableSort

| Member                             | Notes                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `new TableSort(columns, initial?)` | `columns`: key → value function or `{ value, firstDirection }`; `initial`: `{ key, direction? }`, or leave it out to keep the input order |
| `key`, `direction`                 | The active column and direction; `null` while rows keep the input order                                                                   |
| `directionOf(column)`              | The column's direction, or `null` when it is not active                                                                                   |
| `toggle(column)`                   | What a header click does                                                                                                                  |
| `sort(rows)`                       | A sorted copy; reactive inside `$derived` or markup                                                                                       |

Body cells get default padding/typography via `Table`'s scoped styles; no cell
component is required.

## Long tables

`Table` renders every row. For a table that can grow past a few hundred
rows, use [VirtualTable](virtual-table.md): the same header and row markup,
with only the rows on screen in the DOM.
