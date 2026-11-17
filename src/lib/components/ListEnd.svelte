<script lang="ts">
  import Button from "./Button.svelte";
  import Spinner from "./Spinner.svelte";
  import type { ListEndState } from "../utils/more-rows.svelte.js";
  import { watchListEnd } from "./virtual.js";

  // The last row of a table or item of a list; it loads the next batch as
  // the reader nears it and renders nothing once there is no more.
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

  // A new batch or idle state remounts the row, so a row still in view asks
  // again. VirtualTable's inert measuring copy never asks.
  function watch(node: HTMLElement) {
    if (!idle || node.closest("[inert]")) return;
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
  /* In a wide table the status stays at the left of the part in view;
     100cqi needs the scroll box to be an inline-size container. */
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
