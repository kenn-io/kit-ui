# Table + TableHeaderCell

Data-table primitives consolidating middleman's `JobTable` and agentsview's
`SessionsTable` header patterns: `Table` is the shell (scroll wrapper, sticky
header, zebra striping, row hover); `TableHeaderCell` is a header cell with
optional sort button and `aria-sort`. Sorting logic stays in your code — the
header cell only reports clicks and displays the direction you pass back.

```svelte
<script lang="ts">
  import { Table, TableHeaderCell, type SortDirection } from "@kenn-io/kit-ui";

  let sortKey = $state("id");
  let sortDirection = $state<SortDirection>("asc");

  function sortBy(key: string) {
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = "asc";
    }
  }
</script>

<Table ariaLabel="Review jobs">
  {#snippet header()}
    <TableHeaderCell
      label="ID"
      sortable
      sortDirection={sortKey === "id" ? sortDirection : null}
      onsort={() => sortBy("id")}
    />
    <TableHeaderCell label="Status" />
    <TableHeaderCell
      label="Cost"
      numeric
      sortable
      sortDirection={sortKey === "cost" ? sortDirection : null}
      onsort={() => sortBy("cost")}
    />
  {/snippet}
  {#each sorted as row (row.id)}
    <tr>
      <td>#{row.id}</td>
      <td>{row.status}</td>
      <td>${row.cost}</td>
    </tr>
  {/each}
</Table>
```

## Table props

| Prop           | Type      | Default  | Notes                                                                           |
| -------------- | --------- | -------- | ------------------------------------------------------------------------------- |
| `header`       | `Snippet` | required | `<TableHeaderCell>` (or `<th>`) elements                                        |
| `children`     | `Snippet` | required | `<tr>` body rows                                                                |
| `stickyHeader` | `boolean` | `true`   | Header stays visible while the body scrolls (give the wrapper a bounded height) |
| `zebra`        | `boolean` | `true`   | Stripe even rows                                                                |
| `ariaLabel`    | `string`  | —        |                                                                                 |
| `class`        | `string`  | `""`     | Applied to the scroll wrapper                                                   |

## TableHeaderCell props

| Prop            | Type                      | Default | Notes                                             |
| --------------- | ------------------------- | ------- | ------------------------------------------------- |
| `label`         | `string`                  | —       | Header text (or use `children`)                   |
| `children`      | `Snippet`                 | —       | Custom header content                             |
| `sortable`      | `boolean`                 | `false` | Render the sort button                            |
| `sortDirection` | `"asc" \| "desc" \| null` | `null`  | This column's current direction; sets `aria-sort` |
| `onsort`        | `() => void`              | —       | Click handler; toggle direction in your state     |
| `numeric`       | `boolean`                 | `false` | Right-align (numbers, costs, durations)           |
| `class`         | `string`                  | `""`    |                                                   |

Body cells get default padding/typography via `Table`'s scoped styles; no cell
component is required.
