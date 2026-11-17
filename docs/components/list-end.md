# ListEnd and loading on scroll

`ListEnd` watches the end of a list and requests the next batch half a scroll box ahead of view; inside a `VirtualTable`, as soon as the end row is rendered, which is within `overscan` rows of view. It shows a spinner while loading and a failure with Retry when the failure is retryable. It renders an `li` by default; set `columns` to render a table row with one cell spanning those columns.

`rows` accepts any `ListEndState` with `loading`, `problem`, `batches`, and `retry(more)`. `idle` is false while the first batch loads. Set `more` to false when the server has no next batch. `label` names the rows.

```svelte
<script lang="ts">
  import { ListEnd, MoreRows, Table, TableHeaderCell, appendBatch } from "@kenn-io/kit-ui";
  const moreRows = new MoreRows();
  let result = $state({ items: [], next_cursor: undefined });
  function more() {
    if (!result.next_cursor) return;
    void moreRows.load(
      (signal) => readBatch(result.next_cursor, signal),
      (batch) => {
        result = appendBatch(result, batch, (row) => row.id);
      },
    );
  }
</script>

<Table>
  {#snippet header()}<TableHeaderCell label="Name" />{/snippet}
  {#each result.items as row (row.id)}
    <tr data-list-row={row.id}><td><a href={row.href}>{row.name}</a></td></tr>
  {/each}
  <ListEnd
    rows={moreRows}
    more={!!result.next_cursor}
    idle={true}
    columns={1}
    label="rows"
    onmore={more}
  />
</Table>
```

`MoreRows.load(read, commit)` accepts a cancellable read and commits only its current result. It ignores overlapping reads and waits for `retry` after a failure. Call `reset()` when a search, filter, or sort starts over; it aborts the old read. `appendBatch` keeps the first copy of each row and takes the new cursor. For a virtual table, use `withEndRow` and `isEndRow` to include the end row among its items.

Attach `keepListPosition(name, rowCount)` to the element containing rows marked with `data-list-row`. On return, read `savedListPosition(name)`, fetch the first `position.rows` rows (at most 1,000), then call `placeList`. For a virtual list, pass a callback that reveals a row by key and offset and returns false if the row is gone. Use `writeListPosition(name, null)` when the list starts over.

## Long lists

Load the next batch as a reader approaches the end. Show a known total beside filters. Keep search, filters, and sort in the address without a page or offset. A new search, filter, or sort starts at the top.

When a row opens a page, Back should reload the rows and restore the same position, up to the first 1,000 rows. Read fresh rows on return. If the top row has gone, restore the saved scroll offset. Step-through views, time-period views, and log tails keep their navigation buttons.

Lists that read moving rows by offset should keep their pager until the reads use a cursor. De-duplication cannot recover a skipped row.
