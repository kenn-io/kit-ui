<script module lang="ts">
  export interface FilterDropdownItem {
    id: string;
    label: string;
    description?: string;
    active: boolean;
    color?: string;
    count?: number;
    disabled?: boolean;
    closeOnSelect?: boolean;
    onSelect: () => void;
  }

  export interface FilterDropdownSection {
    title?: string;
    items: FilterDropdownItem[];
  }
</script>

<script lang="ts">
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import FunnelIcon from "@lucide/svelte/icons/funnel";
  import { tick } from "svelte";
  import { autoReposition, dismissable } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import SearchInput from "./SearchInput.svelte";

  interface Props {
    label: string;
    detail?: string;
    title?: string;
    active?: boolean;
    badgeCount?: number;
    showBadge?: boolean;
    disabled?: boolean;
    sections: FilterDropdownSection[];
    resetLabel?: string;
    onReset?: () => void;
    /** Show a text input that filters items across all sections. */
    searchable?: boolean;
    searchPlaceholder?: string;
    /** Show "Select all" / "Deselect all" bulk actions at the top. */
    onSelectAll?: () => void;
    onDeselectAll?: () => void;
    selectAllLabel?: string;
    deselectAllLabel?: string;
    emptyLabel?: string;
    minWidth?: string;
    align?: "start" | "end";
    icon?: "filter" | "sort" | "more";
  }

  let {
    label,
    detail,
    title,
    active = false,
    badgeCount = 0,
    showBadge = true,
    disabled = false,
    sections,
    resetLabel,
    onReset,
    searchable = false,
    searchPlaceholder = "Search…",
    onSelectAll,
    onDeselectAll,
    selectAllLabel = "Select all",
    deselectAllLabel = "Deselect all",
    emptyLabel = "No matches",
    minWidth = "200px",
    align = "start",
    icon = "filter",
  }: Props = $props();

  let isOpen = $state(false);
  let search = $state("");
  let buttonRef = $state<HTMLButtonElement>();
  let dropdownRef = $state<HTMLDivElement>();
  let dropdownStyle = $state("");

  const isActive = $derived(active || badgeCount > 0);
  const hasReset = $derived(resetLabel !== undefined && onReset !== undefined);
  const hasBulkActions = $derived(onSelectAll !== undefined || onDeselectAll !== undefined);

  const visibleSections = $derived.by(() => {
    if (!search) return sections;
    const q = search.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((section) => section.items.length > 0);
  });

  $effect(() => {
    if (disabled && isOpen) isOpen = false;
  });

  $effect(() => {
    if (!isOpen) return;
    const cleanups = [
      dismissable({
        owners: () => [dropdownRef, buttonRef],
        dismiss: closeDropdown,
        escapeFocus: () => buttonRef,
      }),
      // Searching filters the item list and resizes the panel — reposition.
      autoReposition(() => dropdownRef, positionDropdown),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  });

  function positionDropdown(): void {
    if (!buttonRef || !dropdownRef) return;

    dropdownStyle = floatingPopoverStyle({
      trigger: buttonRef.getBoundingClientRect(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: dropdownRef.offsetWidth,
      popoverHeight: dropdownRef.offsetHeight,
      align,
    });
  }

  function closeDropdown(): void {
    isOpen = false;
    search = "";
  }

  async function openDropdown(): Promise<void> {
    isOpen = true;
    await tick();
    positionDropdown();
  }

  async function toggleOpen(): Promise<void> {
    if (disabled) return;
    if (isOpen) {
      closeDropdown();
      return;
    }
    await openDropdown();
  }

  async function handleSelect(item: FilterDropdownItem): Promise<void> {
    if (disabled || item.disabled) return;
    item.onSelect();
    if (item.closeOnSelect) {
      closeDropdown();
      return;
    }
    await tick();
    positionDropdown();
  }

  async function handleReset(): Promise<void> {
    if (disabled) return;
    onReset?.();
    await tick();
    positionDropdown();
  }

  function itemDescriptionId(item: FilterDropdownItem): string {
    return `kit-filter-item-description-${item.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }
</script>

<div class="kit-filter-dropdown">
  <button
    class="kit-filter-dropdown__btn"
    class:kit-filter-dropdown__btn--active={isActive}
    bind:this={buttonRef}
    onclick={toggleOpen}
    aria-label={label}
    {title}
    {disabled}
    type="button"
  >
    {#if icon === "sort"}
      <ArrowUpDownIcon size={12} strokeWidth={2} aria-hidden="true" />
    {:else if icon === "more"}
      <EllipsisIcon size={14} strokeWidth={2.2} aria-hidden="true" />
    {:else}
      <FunnelIcon size={12} strokeWidth={2} aria-hidden="true" />
    {/if}
    <span class="kit-filter-dropdown__trigger-label">{label}</span>
    {#if detail}
      <span class="kit-filter-dropdown__trigger-detail">{detail}</span>
    {/if}
    {#if showBadge && badgeCount > 0}
      <span class="kit-filter-dropdown__badge">{badgeCount}</span>
    {/if}
  </button>

  {#if isOpen}
    <div
      class="kit-filter-dropdown__panel kit-popover-card"
      bind:this={dropdownRef}
      style={dropdownStyle}
      style:min-width={minWidth}
    >
      {#if searchable}
        <div class="kit-filter-dropdown__search">
          <SearchInput bind:value={search} size="sm" block placeholder={searchPlaceholder} />
        </div>
      {/if}
      {#if hasBulkActions}
        <div class="kit-filter-dropdown__bulk-actions">
          {#if onSelectAll}
            <button
              class="kit-filter-dropdown__bulk-btn"
              type="button"
              onclick={() => onSelectAll?.()}>{selectAllLabel}</button
            >
          {/if}
          {#if onDeselectAll}
            <button
              class="kit-filter-dropdown__bulk-btn"
              type="button"
              onclick={() => onDeselectAll?.()}>{deselectAllLabel}</button
            >
          {/if}
        </div>
      {/if}
      {#each visibleSections as section, index (section.title ?? `section-${index}`)}
        {#if index > 0}
          <div class="kit-filter-dropdown__divider"></div>
        {/if}
        {#if section.title}
          <div class="kit-filter-dropdown__section-title">{section.title}</div>
        {/if}
        {#each section.items as item (item.id)}
          <button
            class="kit-filter-dropdown__item"
            class:active={item.active}
            onclick={() => handleSelect(item)}
            disabled={disabled || item.disabled}
            title={item.description}
            aria-describedby={item.description ? itemDescriptionId(item) : undefined}
            type="button"
          >
            <span
              class="kit-filter-dropdown__dot"
              style:background={item.active
                ? (item.color ?? "var(--accent-blue)")
                : "var(--border-muted)"}
            ></span>
            <span class="kit-filter-dropdown__label">{item.label}</span>
            {#if item.count !== undefined}
              <span class="kit-filter-dropdown__count">{item.count}</span>
            {/if}
            <span class="kit-filter-dropdown__check" class:on={item.active}>
              {#if item.active}
                <CheckIcon size="10" strokeWidth="2.2" aria-hidden="true" />
              {/if}
            </span>
          </button>
          {#if item.description}
            <span id={itemDescriptionId(item)} class="kit-sr-only">
              {item.description}
            </span>
          {/if}
        {/each}
      {:else}
        <div class="kit-filter-dropdown__empty">{emptyLabel}</div>
      {/each}
      {#if hasReset}
        <button class="kit-filter-dropdown__reset" onclick={handleReset} {disabled} type="button">
          {resetLabel}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .kit-filter-dropdown {
    position: relative;
  }

  .kit-filter-dropdown__btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    font-family: inherit;
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-muted);
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      color var(--transition-fast);
    position: relative;
    min-height: 24px;
  }

  .kit-filter-dropdown__btn:hover:not(:disabled) {
    border-color: var(--border-default);
    color: var(--text-secondary);
  }

  .kit-filter-dropdown__btn:disabled {
    cursor: default;
    opacity: var(--opacity-disabled);
  }

  .kit-filter-dropdown__btn--active {
    color: var(--accent-blue);
    border-color: var(--accent-blue);
  }

  .kit-filter-dropdown__trigger-detail {
    color: var(--text-secondary);
  }

  .kit-filter-dropdown__badge {
    font-size: 0.9em;
    font-weight: 700;
    background: var(--accent-blue);
    color: white;
    border-radius: 6px;
    padding: 0 4px;
    min-width: 14px;
    text-align: center;
    line-height: 14px;
  }

  .kit-filter-dropdown__panel {
    position: fixed;
    z-index: var(--z-popover);
    padding: 4px 0;
    /* Long item lists (agentsview's branch filter runs to thousands of
       entries) must scroll instead of growing past the viewport. */
    max-height: min(420px, calc(100vh - 16px));
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .kit-filter-dropdown__search {
    margin: 2px 8px 4px;
  }

  .kit-filter-dropdown__bulk-actions {
    display: flex;
    gap: 4px;
    padding: 2px 8px 4px;
    border-bottom: 1px solid var(--border-muted);
    margin-bottom: 4px;
  }

  .kit-filter-dropdown__bulk-btn {
    font-family: inherit;
    font-size: var(--font-size-2xs);
    color: var(--accent-blue);
    cursor: pointer;
    padding: 2px 4px;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
  }

  .kit-filter-dropdown__bulk-btn:hover {
    background: var(--bg-surface-hover);
  }

  .kit-filter-dropdown__section-title {
    padding: 4px 12px 4px;
    font-size: 0.9em;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .kit-filter-dropdown__divider {
    height: 1px;
    background: var(--border-muted);
    margin: 4px 8px;
  }

  .kit-filter-dropdown__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 12px;
    font-family: inherit;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast);
    background: transparent;
    border: 0;
  }

  .kit-filter-dropdown__item:hover:not(:disabled) {
    background: var(--bg-surface-hover);
  }

  .kit-filter-dropdown__item:not(.active) {
    opacity: 0.5;
  }

  .kit-filter-dropdown__item:disabled {
    cursor: default;
  }

  .kit-filter-dropdown__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background var(--transition-fast);
  }

  .kit-filter-dropdown__label {
    flex: 1;
  }

  .kit-filter-dropdown__count {
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
    flex-shrink: 0;
  }

  .kit-filter-dropdown__check {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-green);
    flex-shrink: 0;
  }

  .kit-filter-dropdown__empty {
    padding: 8px 12px;
    text-align: center;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .kit-filter-dropdown__reset {
    display: block;
    width: calc(100% - 16px);
    margin: 4px 8px 2px;
    padding: 4px 8px;
    font-family: inherit;
    font-size: var(--font-size-2xs);
    color: var(--text-muted);
    text-align: center;
    border: 0;
    border-top: 1px solid var(--border-muted);
    background: transparent;
    padding-top: 8px;
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .kit-filter-dropdown__reset:hover {
    color: var(--text-primary);
  }

  .kit-filter-dropdown__item:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }
</style>
