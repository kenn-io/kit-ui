<script module lang="ts">
  export type SortDirection = "asc" | "desc";
</script>

<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    children?: Snippet;
    /** Render a sort button; `onsort` decides what sorting means. */
    sortable?: boolean;
    /** This column's current direction, or null/undefined when unsorted. */
    sortDirection?: SortDirection | null;
    onsort?: () => void;
    /** Right-align (numbers, costs, durations). */
    numeric?: boolean;
    class?: string;
  }

  let {
    label = undefined,
    children,
    sortable = false,
    sortDirection = null,
    onsort = undefined,
    numeric = false,
    class: className = "",
  }: Props = $props();

  const ariaSort = $derived(
    !sortable || !sortDirection
      ? undefined
      : sortDirection === "asc"
        ? ("ascending" as const)
        : ("descending" as const),
  );
</script>

<th class={["kit-th", { "kit-th--numeric": numeric }, className]} scope="col" aria-sort={ariaSort}>
  {#if sortable}
    <button class="kit-th__sort-btn" type="button" onclick={() => onsort?.()}>
      {#if label}{label}{/if}
      {#if children}{@render children()}{/if}
      <span class="kit-th__indicator" class:on={sortDirection}>
        {#if sortDirection === "asc"}
          <ArrowUpIcon size="11" strokeWidth="2.2" aria-hidden="true" />
        {:else if sortDirection === "desc"}
          <ArrowDownIcon size="11" strokeWidth="2.2" aria-hidden="true" />
        {/if}
      </span>
    </button>
  {:else}
    {#if label}{label}{/if}
    {#if children}{@render children()}{/if}
  {/if}
</th>

<style>
  .kit-th {
    padding: 6px 10px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-muted);
    text-align: left;
    background: var(--bg-inset);
    border-bottom: 1px solid var(--border-default);
    white-space: nowrap;
    user-select: none;
  }

  .kit-th--numeric {
    text-align: right;
  }

  .kit-th__sort-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  .kit-th__sort-btn:hover {
    color: var(--text-primary);
  }

  /* Ring comes from theme.css's global kit- rule; only round it here so
   * the outline hugs the label. */
  .kit-th__sort-btn:focus-visible {
    border-radius: 2px;
  }

  .kit-th--numeric .kit-th__sort-btn {
    flex-direction: row-reverse;
  }

  .kit-th__indicator {
    display: inline-flex;
    width: 11px;
    color: var(--accent-blue);
    opacity: 0;
  }

  .kit-th__indicator.on {
    opacity: 1;
  }
</style>
