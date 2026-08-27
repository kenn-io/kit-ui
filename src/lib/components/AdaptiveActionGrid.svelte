<script module lang="ts">
  import type { Snippet } from "svelte";

  export type AdaptiveActionGridMode = "row" | "grid" | "compact";
  export type AdaptiveActionGridFrame = "none" | "outline";
  export type AdaptiveActionGridRadius = "none" | "sm" | "md" | "lg" | "pill";
  export type AdaptiveActionGridSpace = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  export interface AdaptiveActionGridItem {
    /** Stable unique key for this item. */
    id: string;
    /** Control or compound control rendered in the item wrapper. */
    content: Snippet;
  }

  const RADIUS_VALUES: Record<AdaptiveActionGridRadius, string> = {
    none: "0px",
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    pill: "999px",
  };

  const SPACE_VALUES: Record<AdaptiveActionGridSpace, string> = {
    0: "0px",
    1: "var(--space-1)",
    2: "var(--space-2)",
    3: "var(--space-3)",
    4: "var(--space-4)",
    5: "var(--space-5)",
    6: "var(--space-6)",
    7: "var(--space-7)",
    8: "var(--space-8)",
  };
</script>

<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { flushSync, tick } from "svelte";

  interface Props {
    /** Atomic top-level controls, in visual and keyboard order. */
    items: AdaptiveActionGridItem[];
    /** Accessible name for the complete control group. */
    ariaLabel: string;
    /** Visible compact trigger label. Defaults to ariaLabel. */
    compactLabel?: string;
    /** Non-interactive state summary rendered inside the compact trigger. */
    summary?: Snippet;
    /** Compact disclosure state. */
    open?: boolean;
    onopenchange?: (open: boolean) => void;
    /** Reports the measured layout for observation only. The callback must not
     * change an item's intrinsic width based on the reported mode. */
    onmodechange?: (mode: AdaptiveActionGridMode) => void;
    /** Host width below which an overflowing row becomes compact. */
    collapseBelow?: number;
    /** Minimum equal grid-track width in CSS pixels. */
    minTrackWidth?: number;
    /** Outer frame treatment. */
    frame?: AdaptiveActionGridFrame;
    /** Outer frame radius. */
    radius?: AdaptiveActionGridRadius;
    /** Radius inherited by kit controls rendered as items. */
    itemRadius?: AdaptiveActionGridRadius;
    /** Spacing-ladder step between grid rows. Zero creates a joined grid. */
    rowGap?: AdaptiveActionGridSpace;
    /** Spacing-ladder step between columns. Zero creates a joined grid. */
    columnGap?: AdaptiveActionGridSpace;
    /** Spacing-ladder step between the frame and its items. */
    padding?: AdaptiveActionGridSpace;
    class?: string;
  }

  let {
    items,
    ariaLabel,
    compactLabel = ariaLabel,
    summary = undefined,
    open = $bindable(false),
    onopenchange = undefined,
    onmodechange = undefined,
    collapseBelow = 640,
    minTrackWidth = 200,
    frame = "outline",
    radius = "md",
    itemRadius = "sm",
    rowGap = 3,
    columnGap = 3,
    padding = 2,
    class: className = "",
  }: Props = $props();

  const componentId = $props.id();
  const panelId = `${componentId}-items`;

  let hostEl = $state<HTMLDivElement>();
  let triggerEl = $state<HTMLButtonElement>();
  let itemsEl = $state<HTMLDivElement>();
  let itemEls = $state<HTMLDivElement[]>([]);
  let mode = $state<AdaptiveActionGridMode>("row");

  const safeCollapseBelow = $derived(
    Number.isFinite(collapseBelow) && collapseBelow >= 0 ? collapseBelow : 640,
  );
  const safeTrackWidth = $derived(
    Number.isFinite(minTrackWidth) && minTrackWidth > 0 ? minTrackWidth : 200,
  );
  const radiusValue = $derived(RADIUS_VALUES[radius]);
  const itemRadiusValue = $derived(RADIUS_VALUES[itemRadius]);
  const rowGapValue = $derived(SPACE_VALUES[rowGap]);
  const columnGapValue = $derived(SPACE_VALUES[columnGap]);
  const paddingValue = $derived(SPACE_VALUES[padding]);
  const joined = $derived(rowGap === 0 && columnGap === 0 && padding === 0);
  const itemKeys = $derived(items.map((item) => item.id).join("\u0000"));

  function setOpen(next: boolean): void {
    if (next === open) return;
    open = next;
    onopenchange?.(next);
  }

  function isSequentiallyFocusable(element: HTMLElement): boolean {
    return (
      element.tabIndex >= 0 &&
      !element.matches(':disabled, [aria-disabled="true"]') &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden"
    );
  }

  function radioGroupTabStop(radio: HTMLInputElement): HTMLInputElement | undefined {
    if (radio.name === "") return radio;
    const root = radio.getRootNode();
    const candidates = radio.form
      ? [...radio.form.elements]
      : root instanceof Document || root instanceof DocumentFragment
        ? [...root.querySelectorAll('input[type="radio"]')]
        : [];
    const group = candidates.filter(
      (candidate): candidate is HTMLInputElement =>
        candidate instanceof HTMLInputElement &&
        candidate.type === "radio" &&
        candidate.name === radio.name &&
        candidate.form === radio.form &&
        candidate.getRootNode() === root &&
        isSequentiallyFocusable(candidate),
    );
    return group.find((candidate) => candidate.checked) ?? group[0];
  }

  async function focusFirstItem(): Promise<void> {
    await tick();
    const candidates = itemsEl?.querySelectorAll<HTMLElement>(
      "button, input, select, textarea, [href], [tabindex]",
    );
    const focusable = [...(candidates ?? [])].filter(isSequentiallyFocusable);
    const sequential = focusable.filter((element) => {
      if (!(element instanceof HTMLInputElement) || element.type !== "radio") return true;
      return radioGroupTabStop(element) === element;
    });
    const first = sequential
      .map((element, index) => ({ element, index }))
      .sort((a, b) => {
        const aOrder = a.element.tabIndex > 0 ? a.element.tabIndex : Number.MAX_SAFE_INTEGER;
        const bOrder = b.element.tabIndex > 0 ? b.element.tabIndex : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.index - b.index;
      })[0]?.element;
    (first ?? hostEl)?.focus();
  }

  function setMode(next: AdaptiveActionGridMode): void {
    if (next === mode) return;
    const previous = mode;
    const focusInsideItems = !!itemsEl?.contains(document.activeElement);
    const focusOnTrigger = triggerEl === document.activeElement;

    if (next === "compact" && focusInsideItems) setOpen(true);
    mode = next;
    onmodechange?.(next);

    if (previous === "compact" && focusOnTrigger) void focusFirstItem();
  }

  function handleInvalid(event: Event): void {
    if (mode !== "compact" || open || !itemsEl?.contains(event.target as Node)) return;
    flushSync(() => setOpen(true));
  }

  function styleWithoutPointerPosition(style: string | null): string {
    return (style ?? "")
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(
        (declaration) =>
          !declaration.startsWith("--kit-pointer-x:") &&
          !declaration.startsWith("--kit-pointer-y:"),
      )
      .join(";");
  }

  function needsMeasurement(mutations: MutationRecord[]): boolean {
    return mutations.some((mutation) => {
      if (mutation.type !== "attributes" || mutation.attributeName !== "style") return true;
      const currentStyle = (mutation.target as Element).getAttribute("style");
      return (
        styleWithoutPointerPosition(mutation.oldValue) !== styleWithoutPointerPosition(currentStyle)
      );
    });
  }

  function measure(): void {
    if (!hostEl || !itemsEl || items.length === 0) {
      setMode("row");
      return;
    }

    // Measure the mounted controls in a temporary no-wrap row on every pass.
    // This keeps content changes authoritative in grid and compact modes while
    // avoiding a cloned control subtree. The measuring CSS removes stretched
    // grid widths before scrollWidth is read.
    itemsEl.dataset.measuring = "";
    const requiredRowWidth = itemsEl.scrollWidth;
    delete itemsEl.dataset.measuring;

    const rowFits = requiredRowWidth <= itemsEl.clientWidth + 1;

    if (rowFits) {
      setMode("row");
    } else if (hostEl.clientWidth < safeCollapseBelow) {
      setMode("compact");
    } else {
      setMode("grid");
    }
  }

  $effect(() => {
    void safeCollapseBelow;
    void safeTrackWidth;
    void rowGapValue;
    void columnGapValue;
    void paddingValue;
    void itemKeys;
    void className;

    if (!hostEl || !itemsEl) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    const contentObserver = new MutationObserver((mutations) => {
      if (needsMeasurement(mutations)) schedule();
    });
    const ancestorObserver = new MutationObserver(schedule);
    observer.observe(hostEl);
    for (const itemEl of itemEls) {
      if (!itemEl) continue;
      observer.observe(itemEl);
      contentObserver.observe(itemEl, {
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
    for (let ancestor = hostEl.parentElement; ancestor; ancestor = ancestor.parentElement) {
      ancestorObserver.observe(ancestor, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
    document.fonts.addEventListener("loadingdone", schedule);
    document.fonts.addEventListener("loadingerror", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      contentObserver.disconnect();
      ancestorObserver.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
      document.fonts.removeEventListener("loadingerror", schedule);
    };
  });

  // A bound `open` value can close the disclosure while a child owns focus.
  // Return focus before inert removes the item region from keyboard access.
  $effect(() => {
    if (mode !== "compact" || open || !itemsEl?.contains(document.activeElement)) return;
    triggerEl?.focus();
  });
</script>

<div
  class={[
    "kit-adaptive-action-grid",
    `kit-adaptive-action-grid--${mode}`,
    {
      "kit-adaptive-action-grid--open": open,
      "kit-adaptive-action-grid--joined": joined,
      "kit-adaptive-action-grid--frameless": frame === "none",
    },
    className,
  ]}
  role="group"
  aria-label={ariaLabel}
  tabindex="-1"
  bind:this={hostEl}
  style:--kit-action-grid-radius={radiusValue}
  style:--kit-action-grid-item-radius={itemRadiusValue}
  style:--kit-action-grid-row-gap={rowGapValue}
  style:--kit-action-grid-column-gap={columnGapValue}
  style:--kit-action-grid-padding={paddingValue}
  style:--kit-action-grid-track="{safeTrackWidth}px"
>
  {#if mode === "compact"}
    <button
      class="kit-adaptive-action-grid__trigger kit-control-states"
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      bind:this={triggerEl}
      onclick={() => setOpen(!open)}
    >
      <span class="kit-adaptive-action-grid__trigger-label">{compactLabel}</span>
      {#if summary}
        <span class="kit-adaptive-action-grid__summary">{@render summary()}</span>
      {/if}
      <ChevronDownIcon
        class="kit-adaptive-action-grid__chevron"
        size={14}
        strokeWidth={2}
        aria-hidden="true"
      />
    </button>
  {/if}

  <div
    id={panelId}
    class="kit-adaptive-action-grid__items"
    aria-hidden={mode === "compact" && !open ? "true" : undefined}
    inert={mode === "compact" && !open ? true : undefined}
    bind:this={itemsEl}
    oninvalidcapture={handleInvalid}
  >
    {#each items as item, index (item.id)}
      <div class="kit-adaptive-action-grid__item" bind:this={itemEls[index]}>
        {@render item.content()}
      </div>
    {/each}
  </div>
</div>

<style>
  .kit-adaptive-action-grid {
    box-sizing: border-box;
    min-width: 0;
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--kit-action-grid-radius);
  }

  .kit-adaptive-action-grid--joined {
    overflow: clip;
  }

  .kit-adaptive-action-grid--frameless {
    background: transparent;
    border: 0;
  }

  .kit-adaptive-action-grid--frameless.kit-adaptive-action-grid--compact
    .kit-adaptive-action-grid__trigger {
    background: var(--bg-inset);
    border: var(--border-width) solid var(--border-default);
  }

  .kit-adaptive-action-grid__trigger {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 36px;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    border: 0;
    border-radius: var(--kit-action-grid-radius);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-medium, 500);
    text-align: left;
    cursor: pointer;
    transition:
      background var(--transition-fast) var(--transition-ease, ease),
      color var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-adaptive-action-grid__trigger:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-adaptive-action-grid--open .kit-adaptive-action-grid__trigger {
    border-radius: var(--kit-action-grid-radius) var(--kit-action-grid-radius) 0 0;
    border-bottom: var(--border-width) solid var(--border-muted);
  }

  .kit-adaptive-action-grid__trigger-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-adaptive-action-grid__summary {
    min-width: 0;
    margin-left: auto;
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-normal, 400);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.kit-adaptive-action-grid__chevron) {
    flex: 0 0 auto;
    color: var(--text-muted);
    transition: transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-adaptive-action-grid--open :global(.kit-adaptive-action-grid__chevron) {
    transform: rotate(180deg);
  }

  .kit-adaptive-action-grid__items {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    column-gap: var(--kit-action-grid-column-gap);
    row-gap: var(--kit-action-grid-row-gap);
    padding: var(--kit-action-grid-padding);
  }

  .kit-adaptive-action-grid--row .kit-adaptive-action-grid__items {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
  }

  .kit-adaptive-action-grid--grid .kit-adaptive-action-grid__items,
  .kit-adaptive-action-grid--compact .kit-adaptive-action-grid__items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--kit-action-grid-track)), 1fr));
    align-items: stretch;
  }

  .kit-adaptive-action-grid--compact:not(.kit-adaptive-action-grid--open)
    .kit-adaptive-action-grid__items {
    block-size: 0;
    padding-block: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  .kit-adaptive-action-grid__item {
    display: grid;
    align-items: center;
    min-width: 0;
    --kit-control-radius: var(--kit-action-grid-item-radius);
    --kit-control-height: 28px;
    --kit-control-font-size: var(--font-size-md);
  }

  .kit-adaptive-action-grid--row .kit-adaptive-action-grid__item {
    flex: 0 0 auto;
  }

  .kit-adaptive-action-grid__items:global([data-measuring]) {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
  }

  .kit-adaptive-action-grid__items:global([data-measuring]) .kit-adaptive-action-grid__item {
    flex: 0 0 auto;
    width: max-content;
  }

  .kit-adaptive-action-grid__items:global([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-button),
  .kit-adaptive-action-grid__items:global([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-filter-dropdown),
  .kit-adaptive-action-grid__items:global([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-select-dropdown),
  .kit-adaptive-action-grid__items:global([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-segmented) {
    width: max-content;
  }

  .kit-adaptive-action-grid__items:global([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-icon-button--sm) {
    width: 24px;
  }

  .kit-adaptive-action-grid__items:global([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-icon-button--md) {
    width: var(--kit-control-height, 28px);
  }

  /* Fill direct controls and compound-control wrappers in grid modes without
   * reaching into transient popovers. */
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__items:not([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-button),
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__items:not([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-icon-button),
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__items:not([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-filter-dropdown),
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__items:not([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-select-dropdown),
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__items:not([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-segmented) {
    width: 100%;
  }

  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__items:not([data-measuring])
    .kit-adaptive-action-grid__item
    > :global(.kit-select-dropdown) {
    min-width: 0;
  }

  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__item
    > :global(.kit-filter-dropdown)
    > :global(.kit-filter-dropdown__btn),
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__item
    > :global(.kit-select-dropdown)
    > :global(.kit-select-dropdown__trigger) {
    width: 100%;
  }

  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__item
    > :global(.kit-segmented)
    > :global(.kit-segmented__btn) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Equal tracks need equal control silhouettes. Compound controls keep their
   * own state treatment, but their resting frame matches a standard Button. */
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__item
    > :global(.kit-segmented),
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__item
    > :global(.kit-icon-button) {
    background: var(--bg-inset);
    border: var(--border-width) solid var(--border-default);
  }

  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__item
    > :global(.kit-filter-dropdown)
    > :global(.kit-filter-dropdown__btn),
  .kit-adaptive-action-grid:not(.kit-adaptive-action-grid--row)
    .kit-adaptive-action-grid__item
    > :global(.kit-select-dropdown)
    > :global(.kit-select-dropdown__trigger) {
    justify-content: center;
    border-color: var(--border-default);
  }

  .kit-adaptive-action-grid--joined .kit-adaptive-action-grid__item :global(:focus-visible) {
    outline-offset: -2px;
  }

  .kit-adaptive-action-grid--joined .kit-adaptive-action-grid__trigger:focus-visible {
    outline-offset: -2px;
  }

  .kit-adaptive-action-grid--joined
    .kit-adaptive-action-grid__item
    :global(.kit-text-input:has(.kit-text-input__control:focus-visible)) {
    outline-offset: -2px;
  }

  @media (hover: none), (pointer: coarse) {
    .kit-adaptive-action-grid__item {
      --kit-control-height: 32px;
    }

    .kit-adaptive-action-grid__trigger {
      min-height: 48px;
    }
  }

  :global(.kit-type-touch) .kit-adaptive-action-grid__item {
    --kit-control-height: 32px;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.kit-adaptive-action-grid__chevron) {
      transition: none;
    }
  }
</style>
