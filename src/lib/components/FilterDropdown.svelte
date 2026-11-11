<script module lang="ts">
  import type { Snippet } from "svelte";

  export interface FilterDropdownItem {
    id: string;
    label: string;
    description?: string;
    active: boolean;
    /** The row filters its option out. An excluded row shows a cross where
     * an active row shows a tick; `active` should be false. */
    excluded?: boolean;
    /** Category color. A row with a color shows a dot in it while active;
     * a row without one shows no dot, since the tick already marks it. When
     * any row has a color, the others keep the dot's space so labels align. */
    color?: string;
    count?: number;
    disabled?: boolean;
    closeOnSelect?: boolean;
    /** Short value summary at the row's end, such as "2 selected". */
    detail?: string;
    /** Content for a flyout beside the panel. A row with a submenu opens
     * the flyout instead of calling `onSelect`. */
    submenu?: Snippet;
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
  import XIcon from "@lucide/svelte/icons/x";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import FunnelIcon from "@lucide/svelte/icons/funnel";
  import { flushSync, onDestroy, tick, untrack } from "svelte";
  import { TABBABLE_SELECTOR } from "../utils/focus-trap.js";
  import { autoReposition, dismissable } from "../utils/popover.js";
  import { floatingFlyoutStyle, floatingPopoverStyle } from "./floatingPosition.js";
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
    /** Screen-reader text appended to an excluded row's name. */
    excludedLabel?: string;
    minWidth?: string;
    align?: "start" | "end";
    icon?: "filter" | "sort" | "more";
    /** Called when the panel opens or closes, for an app that suspends its
     * own shortcuts while the panel is open. */
    onOpenChange?: (open: boolean) => void;
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
    excludedLabel = "left out of results",
    minWidth = "200px",
    align = "start",
    icon = "filter",
    onOpenChange,
  }: Props = $props();

  let isOpen = $state(false);
  let search = $state("");
  let buttonRef = $state<HTMLButtonElement>();
  let dropdownRef = $state<HTMLDivElement>();
  let dropdownStyle = $state("");
  let submenuId = $state<string | null>(null);
  let submenuRef = $state<HTMLDivElement>();
  let submenuStyle = $state("");
  // Size limits in the panel's own CSS units. CSS zoom scales vh and vw too,
  // so the stylesheet's viewport-unit caps overflow a zoomed-in window.
  let viewportLimits = $state<{ width: number; height: number }>();
  const instanceId = $props.id();

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

  const submenuItem = $derived(
    submenuId === null
      ? undefined
      : visibleSections
          .flatMap((section) => section.items)
          .find((item) => item.id === submenuId && item.submenu !== undefined),
  );

  $effect(() => {
    if (disabled && isOpen) closeDropdown();
  });

  // Report changes only, and a final close if the dropdown goes away open,
  // so a consumer that suspended its shortcuts always gets them back.
  let reportedOpen = false;
  $effect(() => {
    const open = isOpen;
    if (open === reportedOpen) return;
    reportedOpen = open;
    untrack(() => onOpenChange?.(open));
  });
  onDestroy(() => {
    if (reportedOpen) onOpenChange?.(false);
  });

  $effect(() => {
    if (!isOpen) return;
    const cleanups = [
      dismissable({
        owners: () => [dropdownRef, buttonRef, submenuRef],
        dismiss: closeDropdown,
        escapeFocus: () => buttonRef,
      }),
      // Follow panel content changes and container-driven trigger reflow.
      autoReposition(() => [dropdownRef, buttonRef], positionDropdown),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  });

  // Apps rebuild their sections (with fresh item objects) on every filter
  // change, so the flyout's layer keys on open/closed, not the item. Keying
  // on the item would re-register it above a popover opened inside it.
  const submenuOpen = $derived(submenuItem !== undefined);

  $effect(() => {
    if (!submenuOpen) return;
    const cleanups = [
      // The flyout is the newer layer, so Escape closes it before the panel,
      // and a popover opened inside it closes before the flyout. Clicks in
      // the panel stay inside, so its rows can still toggle the flyout.
      dismissable({
        owners: () => [submenuRef, dropdownRef],
        // closeSubmenu returns focus to the row.
        dismiss: closeSubmenu,
      }),
      // The flyout follows its row, so panel scrolls and resizes move it too.
      autoReposition(() => [dropdownRef, submenuRef], positionSubmenu),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  });

  $effect(() => {
    // Search can remove rows above the open row without resizing the panel
    // (it may sit at its height cap), so no observer sees the row move.
    void visibleSections;
    if (submenuId) void tick().then(positionSubmenu);
  });

  /** Apply viewport size limits in unzoomed units before anything measures
   * the panel or flyout, as MenuContent does for its height cap. */
  function fitToViewport(zoom: number): void {
    const width = Math.max(0, Math.floor(window.innerWidth / zoom) - 16);
    // At least 420px or half the viewport, whichever is taller, never past
    // the viewport's own edge margin.
    const viewportHeight = Math.floor(window.innerHeight / zoom);
    const height = Math.max(
      0,
      Math.min(Math.max(420, Math.floor(viewportHeight / 2)), viewportHeight - 16),
    );
    if (viewportLimits?.width === width && viewportLimits.height === height) return;
    viewportLimits = { width, height };
    flushSync();
  }

  function positionDropdown(): void {
    if (!buttonRef || !dropdownRef) return;
    // Fixed offsets and offsetWidth/Height use the panel's unzoomed CSS
    // units, so bring the zoomed trigger rect and viewport into them, as
    // SelectDropdown does. Engines without currentCSSZoom keep the old maths.
    const zoom = dropdownRef.currentCSSZoom ?? 1;
    fitToViewport(zoom);
    const rect = buttonRef.getBoundingClientRect();
    dropdownStyle = floatingPopoverStyle({
      trigger: new DOMRect(rect.x / zoom, rect.y / zoom, rect.width / zoom, rect.height / zoom),
      viewportWidth: window.innerWidth / zoom,
      viewportHeight: window.innerHeight / zoom,
      popoverWidth: dropdownRef.offsetWidth,
      popoverHeight: dropdownRef.offsetHeight,
      align,
    });
    // A moved panel moves the row the flyout lines up with, and the
    // flyout's own observers only see size changes.
    if (submenuId) void tick().then(positionSubmenu);
  }

  function closeDropdown(): void {
    isOpen = false;
    search = "";
    submenuId = null;
  }

  function submenuAnchor(id: string): HTMLElement | null | undefined {
    return dropdownRef?.querySelector<HTMLElement>(`[data-submenu-id="${CSS.escape(id)}"]`);
  }

  function positionSubmenu(): void {
    if (!submenuId || !dropdownRef || !submenuRef) return;
    const anchor = submenuAnchor(submenuId);
    if (!anchor) return;
    // Fixed offsets and offsetWidth/Height use the flyout's unzoomed CSS
    // units, so bring the zoomed client rects and viewport into them, as
    // SelectDropdown does. Engines without currentCSSZoom keep the old maths.
    const zoom = submenuRef.currentCSSZoom ?? 1;
    fitToViewport(zoom);
    const unzoom = (rect: DOMRect) =>
      new DOMRect(rect.x / zoom, rect.y / zoom, rect.width / zoom, rect.height / zoom);
    submenuStyle = floatingFlyoutStyle({
      anchor: unzoom(anchor.getBoundingClientRect()),
      panel: unzoom(dropdownRef.getBoundingClientRect()),
      viewportWidth: window.innerWidth / zoom,
      viewportHeight: window.innerHeight / zoom,
      flyoutWidth: submenuRef.offsetWidth,
      flyoutHeight: submenuRef.offsetHeight,
    });
  }

  async function openSubmenu(item: FilterDropdownItem): Promise<void> {
    submenuId = item.id;
    await tick();
    positionSubmenu();
    if (!submenuRef) return;
    // The selector also matches hidden inputs and controls in a disabled
    // fieldset; take the first control the browser would actually tab to.
    const first = Array.from(submenuRef.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).find(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(":disabled") &&
        element.getClientRects().length > 0,
    );
    first?.focus();
    // Focus must land in the flyout, or Escape would close the whole dropdown.
    if (!submenuRef.contains(document.activeElement)) submenuRef.focus();
  }

  function closeSubmenu(): void {
    const id = submenuId;
    submenuId = null;
    if (id) submenuAnchor(id)?.focus();
  }

  // Escape goes through the flyout's dismissable layer; ArrowLeft is
  // handled here.
  function handleSubmenuKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowLeft" || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea") || target.isContentEditable) return;
    event.preventDefault();
    closeSubmenu();
  }

  function handleItemKeydown(event: KeyboardEvent, item: FilterDropdownItem): void {
    if (event.key !== "ArrowRight" || !item.submenu || disabled || item.disabled) return;
    event.preventDefault();
    void openSubmenu(item);
  }

  function submenuDomId(item: FilterDropdownItem): string {
    return `${instanceId}-submenu-${item.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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
    if (item.submenu) {
      if (submenuId === item.id) closeSubmenu();
      else await openSubmenu(item);
      return;
    }
    submenuId = null;
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

<div
  class="kit-filter-dropdown"
  style:--kit-filter-dropdown-max-width={viewportLimits ? `${viewportLimits.width}px` : undefined}
  style:--kit-filter-dropdown-max-height={viewportLimits ? `${viewportLimits.height}px` : undefined}
>
  <button
    class="kit-filter-dropdown__btn kit-control-states"
    class:kit-filter-dropdown__btn--active={isActive}
    bind:this={buttonRef}
    onclick={toggleOpen}
    aria-label={label}
    aria-expanded={isOpen}
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
      style:min-width={`min(${minWidth}, var(--kit-filter-dropdown-max-width, calc(100vw - 16px)))`}
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
              class="kit-filter-dropdown__bulk-btn kit-control-states"
              type="button"
              onclick={() => onSelectAll?.()}>{selectAllLabel}</button
            >
          {/if}
          {#if onDeselectAll}
            <button
              class="kit-filter-dropdown__bulk-btn kit-control-states"
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
            class="kit-filter-dropdown__item kit-control-states"
            class:active={item.active}
            class:excluded={item.excluded}
            class:submenu={item.submenu !== undefined}
            class:open={submenuItem?.id === item.id}
            onclick={() => handleSelect(item)}
            onkeydown={(event) => handleItemKeydown(event, item)}
            disabled={disabled || item.disabled}
            title={item.description}
            aria-describedby={item.description ? itemDescriptionId(item) : undefined}
            aria-pressed={item.submenu ? undefined : item.active || item.excluded === true}
            aria-haspopup={item.submenu ? "dialog" : undefined}
            aria-expanded={item.submenu ? submenuItem?.id === item.id : undefined}
            aria-controls={item.submenu && submenuItem?.id === item.id
              ? submenuDomId(item)
              : undefined}
            data-submenu-id={item.submenu ? item.id : undefined}
            type="button"
          >
            <span
              class="kit-filter-dropdown__dot"
              data-filled={item.color ? "" : undefined}
              style:background={item.color
                ? item.active
                  ? item.color
                  : "var(--border-muted)"
                : undefined}
            ></span>
            <span class="kit-filter-dropdown__label">{item.label}</span>
            {#if item.excluded}
              <span class="kit-sr-only">, {excludedLabel}</span>
            {/if}
            {#if item.count !== undefined}
              <span class="kit-filter-dropdown__count">{item.count}</span>
            {/if}
            {#if item.detail}
              <span class="kit-filter-dropdown__detail">{item.detail}</span>
            {/if}
            {#if item.submenu}
              <span class="kit-filter-dropdown__chevron">
                <ChevronRightIcon size="12" strokeWidth="2" aria-hidden="true" />
              </span>
            {:else}
              <span class="kit-filter-dropdown__check" class:on={item.active}>
                {#if item.excluded}
                  <XIcon size="10" strokeWidth="2.2" aria-hidden="true" />
                {:else if item.active}
                  <CheckIcon size="10" strokeWidth="2.2" aria-hidden="true" />
                {/if}
              </span>
            {/if}
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
        <button
          class="kit-filter-dropdown__reset kit-control-states"
          onclick={handleReset}
          {disabled}
          type="button"
        >
          {resetLabel}
        </button>
      {/if}
    </div>
    {#if submenuItem?.submenu}
      <div
        bind:this={submenuRef}
        id={submenuDomId(submenuItem)}
        class="kit-filter-dropdown__submenu kit-popover-card"
        role="dialog"
        aria-label={submenuItem.label}
        tabindex="-1"
        style={submenuStyle}
        onkeydown={handleSubmenuKeydown}
      >
        {@render submenuItem.submenu()}
      </div>
    {/if}
  {/if}
</div>

<style>
  .kit-filter-dropdown {
    position: relative;
    min-width: 0;
  }

  .kit-filter-dropdown__btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    font-family: inherit;
    font-size: var(--kit-control-font-size, var(--font-size-xs));
    font-weight: var(--font-weight-medium, 500);
    color: var(--text-muted);
    background: var(--bg-raised, var(--bg-inset));
    border: var(--border-width) solid var(--border-muted);
    box-shadow: var(--shadow-raised, none);
    border-radius: var(--kit-control-radius, var(--radius-sm));
    cursor: pointer;
    transition:
      border-color var(--transition-fast) var(--transition-ease, ease),
      color var(--transition-fast) var(--transition-ease, ease),
      box-shadow var(--transition-fast) var(--transition-ease, ease);
    position: relative;
    min-height: var(--kit-control-height, 24px);
  }

  .kit-filter-dropdown__btn:where([aria-expanded="true"], :active:not(:disabled)) {
    background: var(--bg-inset);
    box-shadow: var(--shadow-sunken, none);
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

  .kit-filter-dropdown__trigger-label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-filter-dropdown__trigger-detail {
    color: var(--text-secondary);
  }

  .kit-filter-dropdown__badge {
    font-size: 0.9em;
    font-weight: var(--font-weight-bold, 700);
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
    box-sizing: border-box;
    padding: 4px 0;
    /* Long item lists (agentsview's branch filter runs to thousands of
       entries) must scroll instead of growing past the viewport. The script
       sets the limits in unzoomed units; the fallbacks cover first paint. */
    max-width: var(--kit-filter-dropdown-max-width, calc(100vw - 16px));
    max-height: var(--kit-filter-dropdown-max-height, min(max(420px, 50vh), calc(100vh - 16px)));
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
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-muted);
    text-transform: var(--label-transform, uppercase);
    letter-spacing: var(--letter-spacing-label, 0.04em);
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
    transition: background var(--transition-fast) var(--transition-ease, ease);
    background: transparent;
    border: 0;
  }

  .kit-filter-dropdown__item:hover:not(:disabled) {
    background: var(--bg-surface-hover);
  }

  .kit-filter-dropdown__item:not(.active, .excluded) {
    opacity: 0.5;
  }

  .kit-filter-dropdown__item:disabled {
    cursor: default;
  }

  .kit-filter-dropdown__dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-dot, 50%);
    flex-shrink: 0;
    transition: background var(--transition-fast) var(--transition-ease, ease);
  }

  /* As in a menu's icon column: when any row has a dot, every row keeps the
     slot so labels share one left edge. A panel with no dots has no slot. */
  .kit-filter-dropdown__panel:not(:has(.kit-filter-dropdown__dot[data-filled]))
    .kit-filter-dropdown__dot {
    display: none;
  }

  .kit-filter-dropdown__label {
    flex: 1;
  }

  .kit-filter-dropdown__count {
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
    flex-shrink: 0;
  }

  /* A submenu row navigates rather than toggles, so it never dims like an
     unselected option; its detail text carries the value. */
  .kit-filter-dropdown__item.submenu {
    opacity: 1;
  }

  /* The open row stays lit, like a focused kit menu item, so it reads as
     the flyout's source. */
  .kit-filter-dropdown__item.open {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-filter-dropdown__item.open .kit-filter-dropdown__chevron {
    color: var(--text-primary);
  }

  .kit-filter-dropdown__detail {
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
    flex-shrink: 0;
  }

  .kit-filter-dropdown__chevron {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .kit-filter-dropdown__submenu {
    position: fixed;
    z-index: var(--z-popover);
    box-sizing: border-box;
    min-width: min(220px, var(--kit-filter-dropdown-max-width, calc(100vw - 16px)));
    max-width: min(320px, var(--kit-filter-dropdown-max-width, calc(100vw - 16px)));
    max-height: var(--kit-filter-dropdown-max-height, min(max(420px, 50vh), calc(100vh - 16px)));
    padding: 4px 0;
    overflow-y: auto;
    overscroll-behavior: contain;
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

  .kit-filter-dropdown__item.excluded .kit-filter-dropdown__check {
    color: var(--accent-red);
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
    transition: color var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-filter-dropdown__reset:hover {
    color: var(--text-primary);
  }

  .kit-filter-dropdown__item:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }
</style>
