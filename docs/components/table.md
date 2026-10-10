# Table + TableHeaderCell + TableSort

Data-table primitives consolidating Forge's `JobTable` and agentsview's
`SessionsTable` header patterns: `Table` is the shell (scroll wrapper, sticky
header, zebra striping, row hover); `TableHeaderCell` is a header cell with a
sort button and `aria-sort`; `TableSort` holds client-side sort state.

## Every table sorts

People expect to click any column heading to sort by it. Every labeled header
must sort, and kit-ui-check's `unsorted-table-header` rule enforces this; it
cannot be suppressed or disabled.

The one exception is a table with a fixed set of fewer than five rows, known
when the code is written, such as one row per status. Declare it with
`fixedRows={n}` (1–4) on `Table`, and write its `header` snippet inside the
`<Table>` tags: the checker reads `fixedRows` from the enclosing `Table`, so
a header snippet declared elsewhere and passed as `header={…}` is still
checked. Headers with no visible text, such as a checkbox or actions column,
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

## Table props

| Prop           | Type               | Default  | Notes                                                                           |
| -------------- | ------------------ | -------- | ------------------------------------------------------------------------------- |
| `header`       | `Snippet`          | required | `<TableHeaderCell>` elements                                                    |
| `children`     | `Snippet`          | required | `<tr>` body rows                                                                |
| `stickyHeader` | `boolean`          | `true`   | Header stays visible while the body scrolls (give the wrapper a bounded height) |
| `zebra`        | `boolean`          | `true`   | Stripe even rows                                                                |
| `ariaLabel`    | `string`           | —        |                                                                                 |
| `fixedRows`    | `1 \| 2 \| 3 \| 4` | —        | Declares a fixed set of at most this many rows; its headers need not sort       |
| `class`        | `string`           | `""`     | Applied to the scroll wrapper                                                   |

## TableHeaderCell props

| Prop            | Type                      | Default | Notes                                                         |
| --------------- | ------------------------- | ------- | ------------------------------------------------------------- |
| `label`         | `string`                  | —       | Header text (or use `children`)                               |
| `children`      | `Snippet`                 | —       | Custom header content                                         |
| `sort`          | `TableSortControl`        | —       | A `TableSort`; replaces `sortable`, `sortDirection`, `onsort` |
| `column`        | `string`                  | —       | This column's key in `sort`; required with `sort`             |
| `sortable`      | `boolean`                 | `false` | Render the sort button for server-sorted data                 |
| `sortDirection` | `"asc" \| "desc" \| null` | `null`  | This column's current direction; sets `aria-sort`             |
| `onsort`        | `() => void`              | —       | Click handler; toggle direction in your state                 |
| `numeric`       | `boolean`                 | `false` | Right-align (numbers, costs, durations)                       |
| `class`         | `string`                  | `""`    |                                                               |

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
