<script module lang="ts">
  export type { SortDirection } from "./table-sort.js";
</script>

<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import type { Snippet } from "svelte";
  import type { SortDirection, TableSortControl } from "./table-sort.js";

  interface BaseProps {
    label?: string;
    children?: Snippet;
    /** Render a sort button; `onsort` decides what sorting means. Prefer
     * `sort` + `column` for client-side data. */
    sortable?: boolean;
    /** This column's current direction, or null/undefined when unsorted. */
    sortDirection?: SortDirection | null;
    onsort?: () => void;
    /** Right-align (numbers, costs, durations). */
    numeric?: boolean;
    class?: string;
  }

  type Props = BaseProps &
    (
      | {
          /** A TableSort (or other TableSortControl) that owns this column's
           * sorting. Replaces `sortable`, `sortDirection`, and `onsort`. */
          sort: TableSortControl;
          /** This column's key in `sort`. */
          column: string;
        }
      | { sort?: undefined; column?: undefined }
    );

  let {
    label = undefined,
    children,
    sortable = false,
    sortDirection = null,
    onsort = undefined,
    sort = undefined,
    column = undefined,
    numeric = false,
    class: className = "",
  }: Props = $props();

  const isSortable = $derived(sort !== undefined || sortable);
  const direction = $derived(
    sort !== undefined && column !== undefined ? sort.directionOf(column) : sortDirection,
  );

  function onclick() {
    if (sort !== undefined && column !== undefined) sort.toggle(column);
    else onsort?.();
  }

  const ariaSort = $derived(
    !isSortable || !direction
      ? undefined
      : direction === "asc"
        ? ("ascending" as const)
        : ("descending" as const),
  );
</script>

<th class={["kit-th", { "kit-th--numeric": numeric }, className]} scope="col" aria-sort={ariaSort}>
  {#if isSortable}
    <button class="kit-th__sort-btn kit-control-states" type="button" {onclick}>
      {#if label}{label}{/if}
      {#if children}{@render children()}{/if}
      <span class="kit-th__indicator" class:on={direction}>
        {#if direction === "asc"}
          <ArrowUpIcon size="11" strokeWidth="2.2" aria-hidden="true" />
        {:else if direction === "desc"}
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

  /* Baseline alignment keeps the label on the header row's text baseline.
   * Centered items would hand the button's baseline to its first flex item,
   * which in a numeric (row-reverse) header is the empty arrow slot, so
   * numeric headers sat lower than their neighbors. */
  .kit-th__sort-btn {
    display: inline-flex;
    align-items: baseline;
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
    align-self: center;
    width: 11px;
    color: var(--accent-blue);
    opacity: 0;
  }

  .kit-th__indicator.on {
    opacity: 1;
  }
</style>
