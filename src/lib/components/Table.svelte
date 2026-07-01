<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Header cells — <TableHeaderCell> (or <th>) elements. */
    header: Snippet;
    /** Body rows — <tr> elements. */
    children: Snippet;
    /** Keep the header visible while the body scrolls. */
    stickyHeader?: boolean;
    /** Stripe even rows. */
    zebra?: boolean;
    ariaLabel?: string;
    class?: string;
  }

  let {
    header,
    children,
    stickyHeader = true,
    zebra = true,
    ariaLabel = undefined,
    class: className = "",
  }: Props = $props();
</script>

<div class={["kit-table-wrapper", className]}>
  <table
    class="kit-table"
    class:kit-table--zebra={zebra}
    class:kit-table--sticky={stickyHeader}
    aria-label={ariaLabel}
  >
    <thead>
      <tr>
        {@render header()}
      </tr>
    </thead>
    <tbody>
      {@render children()}
    </tbody>
  </table>
</div>

<style>
  .kit-table-wrapper {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .kit-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }

  .kit-table--sticky thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .kit-table :global(tbody td) {
    padding: 6px 10px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-muted);
  }

  .kit-table--zebra :global(tbody tr:nth-child(even)) {
    background: var(--bg-inset);
  }

  .kit-table :global(tbody tr:hover) {
    background: var(--bg-surface-hover);
  }
</style>
