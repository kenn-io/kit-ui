<script lang="ts">
  import Button from "./Button.svelte";
  import Spinner from "./Spinner.svelte";
  import type { ListEndState } from "../utils/more-rows.svelte.js";
  import { watchListEnd } from "./virtual.js";

  // The last row of a table, or the last item of a list, that loads its next
  // batch as the reader nears its end. Place it after a plain table's body
  // rows or a list's items, or render it for the `VirtualTable` item
  // `withEndRow` adds. It shows a spinner while a batch loads and the failure
  // with Retry when one fails. With nothing more to load and no failure it
  // renders nothing, so the list stops asking.
  let {
    rows,
    more = true,
    idle,
    columns,
    label,
    onmore,
    loadingText = `Loading more ${label}`,
    failureText = `Could not load more ${label}.`,
    retryLabel = "Retry",
  }: {
    rows: ListEndState;
    /** Whether the server has another batch. A `VirtualTable` end row leaves
     * it out: `withEndRow` adds that row only while there is one. */
    more?: boolean;
    /** False while the list's first batch or a new order is still reading. */
    idle: boolean;
    /** The table's column count, for the row's single cell. Leave it out at
     * the end of a list, where this renders an item. */
    columns?: number;
    /** What the list holds, such as "changes", for the status and failure. */
    label: string;
    /** Starts the next batch; called when this row comes near the visible part of the table. */
    onmore: () => void;
    loadingText?: string;
    failureText?: string;
    retryLabel?: string;
  } = $props();

  // Asks for the next batch once this row is within half a box's height of
  // view in the box that scrolls the rows up and down. A new batch remounts
  // the row, so a table taller than its rows asks again at once. So does the
  // end of a refresh or new order: the list ignores a request while one
  // reads, and a row that stayed in view would never be reported again. The
  // VirtualTable's hidden measuring copy renders this row too; only the row
  // people see asks for more.
  function watch(node: HTMLElement) {
    if (node.closest("[inert]")) return;
    return watchListEnd(node, () => onmore());
  }
</script>

{#snippet problem(failure: NonNullable<ListEndState["problem"]>)}
  <div class="kit-list-end-problem kit-list-end-content" role="alert">
    <span>{failureText} {failure.detail}</span>
    {#if failure.retryable}<Button
        label={retryLabel}
        size="sm"
        onclick={() => rows.retry(onmore)}
      />{/if}
  </div>
{/snippet}
{#snippet loading()}
  {#if rows.loading}<span class="kit-list-end-loading kit-list-end-content"
      ><Spinner size={14} label={loadingText} />{loadingText}</span
    >{/if}
{/snippet}

{#if columns === undefined}
  {#if rows.problem}
    <li class="kit-list-end">{@render problem(rows.problem)}</li>
  {:else if more}
    {#key `${rows.batches}:${idle}`}
      <li class="kit-list-end" {@attach watch}>{@render loading()}</li>
    {/key}
  {/if}
{:else if rows.problem}
  <tr class="kit-list-end">
    <td colspan={columns}>{@render problem(rows.problem)}</td>
  </tr>
{:else if more}
  {#key `${rows.batches}:${idle}`}
    <tr class="kit-list-end" {@attach watch}>
      <td colspan={columns}>{@render loading()}</td>
    </tr>
  {/key}
{/if}

<style>
  /* One height whether idle, loading or failed, so the rows above never move. */
  .kit-list-end td {
    height: 2.5rem;
    color: var(--text-muted);
  }
  /* An item grows with a long failure, as a table cell does. */
  li.kit-list-end {
    display: flex;
    align-items: center;
    min-height: 2.5rem;
    color: var(--text-muted);
    list-style: none;
  }
  /* A wide table, such as Collection status, scrolls sideways; the status
     and Retry stay at the left edge of the part in view, inset by the
     cell's 10px padding. The table's scroll box must be an inline-size
     container, so 100cqi is the width in view and a long failure wraps
     before Retry leaves it. */
  .kit-list-end-content {
    position: sticky;
    left: 10px;
    width: max-content;
    max-width: min(40rem, 100cqi - 20px);
  }
  .kit-list-end-loading {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .kit-list-end-problem {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--text-secondary);
  }
  .kit-list-end-problem > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
