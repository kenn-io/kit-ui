<script module lang="ts">
  export interface TopBarTab {
    id: string;
    label: string;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import SelectDropdown from "./SelectDropdown.svelte";

  interface Props {
    /** Primary navigation tabs. Omit (or pass []) for a bar with no tabs. */
    tabs?: TopBarTab[];
    /** Active tab id (bindable). */
    active?: string;
    onchange?: (id: string) => void;
    /** True while the tabs are collapsed into the dropdown (bindable,
     * read-only in spirit) — lets the app hide labels etc. in its snippets. */
    collapsed?: boolean;
    /** Center the tab group between the side regions (middleman style)
     * instead of packing it after the left region. */
    centerTabs?: boolean;
    /** aria-label for the tab nav / collapsed dropdown. */
    ariaLabel?: string;
    /** Reserved leading region: brand, sidebar toggle, context pickers. */
    left?: Snippet;
    /** Optional search slot, centered in the remaining space. */
    search?: Snippet;
    /** Reserved trailing region: actions, theme toggle, settings. */
    right?: Snippet;
    class?: string;
  }

  let {
    tabs = [],
    active = $bindable(""),
    onchange = undefined,
    collapsed = $bindable(false),
    centerTabs = false,
    ariaLabel = "Primary",
    left = undefined,
    search = undefined,
    right = undefined,
    class: className = "",
  }: Props = $props();

  let barEl = $state<HTMLElement>();
  let leftEl = $state<HTMLDivElement>();
  let rightEl = $state<HTMLDivElement>();
  let searchEl = $state<HTMLDivElement>();
  let probeEl = $state<HTMLDivElement>();

  const options = $derived(
    tabs.map((tab) => ({
      value: tab.id,
      label: tab.label,
      disabled: tab.disabled,
    })),
  );

  // Rendered active id: an unset/unknown `active` falls back to the first
  // tab in BOTH modes (SelectDropdown already displays the first option for
  // unmatched values — the expanded buttons match that instead of showing
  // no active tab).
  const effectiveActive = $derived(
    tabs.some((tab) => tab.id === active) ? active : (tabs[0]?.id ?? ""),
  );

  function select(id: string): void {
    active = id;
    onchange?.(id);
  }

  // Auto-collapse by measurement, not by breakpoint: a hidden probe always
  // renders the full tab row, and the tabs collapse into a SelectDropdown
  // whenever that row would not fit next to the side regions.
  //
  // Snippets are allowed to shrink when `collapsed` flips (the documented
  // bind:collapsed pattern), which could otherwise oscillate: collapsing
  // frees width, the shrunken bar measures as fitting, re-expands, and so
  // on. `expandThreshold` breaks the loop — it records the bar width the
  // *expanded* content needed at the moment of collapse, and re-expansion
  // requires the bar to actually reach it. A repeated collapse can only
  // raise the threshold, so the state settles.
  let expandThreshold = 0;

  function measure(): void {
    if (!barEl || !probeEl || tabs.length === 0) return;
    const styles = getComputedStyle(barEl);
    const gap = Number.parseFloat(styles.columnGap) || 0;
    let used =
      Number.parseFloat(styles.paddingLeft) +
      Number.parseFloat(styles.paddingRight);
    let regions = 1;
    for (const el of [leftEl, searchEl, rightEl]) {
      if (el) {
        used += el.offsetWidth;
        regions += 1;
      }
    }
    used += gap * (regions - 1);
    const needed = used + probeEl.offsetWidth;
    if (!collapsed) {
      if (needed > barEl.clientWidth) {
        expandThreshold = needed;
        collapsed = true;
      }
    } else if (barEl.clientWidth >= Math.max(expandThreshold, needed)) {
      collapsed = false;
    }
  }

  $effect(() => {
    if (!barEl || tabs.length === 0) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(barEl);
    for (const el of [probeEl, leftEl, searchEl, rightEl]) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  });
</script>

<header class={["kit-top-bar", className]} bind:this={barEl}>
  {#if left}
    <div class="kit-top-bar__left" bind:this={leftEl}>
      {@render left()}
    </div>
  {/if}

  {#if tabs.length > 0}
    <!-- Centering only applies to the expanded tab group; the collapsed
         dropdown packs next to the left region (a lone centered select
         floats oddly in the empty middle). -->
    <nav
      class="kit-top-bar__nav"
      class:kit-top-bar__nav--center={centerTabs && !collapsed}
      aria-label={ariaLabel}
    >
      {#if collapsed}
        <SelectDropdown
          class="kit-top-bar__nav-select"
          value={effectiveActive}
          {options}
          onchange={select}
          title={ariaLabel}
        />
      {:else}
        <div class="kit-top-bar__tabs">
          {#each tabs as tab (tab.id)}
            <button
              type="button"
              class="kit-top-bar__tab"
              class:active={tab.id === effectiveActive}
              disabled={tab.disabled}
              aria-current={tab.id === effectiveActive ? "page" : undefined}
              onclick={() => select(tab.id)}
            >
              {tab.label}
            </button>
          {/each}
        </div>
      {/if}
      <!-- Measurement probe: the full tab row, never collapsed. -->
      <div class="kit-top-bar__probe" bind:this={probeEl} aria-hidden="true">
        {#each tabs as tab (tab.id)}
          <span class="kit-top-bar__tab">{tab.label}</span>
        {/each}
      </div>
    </nav>
  {/if}

  {#if search}
    <div class="kit-top-bar__search" bind:this={searchEl}>
      {@render search()}
    </div>
  {/if}

  {#if right}
    <div class="kit-top-bar__right" bind:this={rightEl}>
      {@render right()}
    </div>
  {/if}
</header>

<style>
  .kit-top-bar {
    box-sizing: border-box;
    position: relative;
    height: var(--header-height, 44px);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: 0 var(--space-5);
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
    min-width: 0;
  }

  /* Side regions never shrink — tabs collapse first, so whatever the app
   * puts left/right keeps its space. */
  .kit-top-bar__left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
    min-width: 0;
  }

  .kit-top-bar__right {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-left: auto;
    flex-shrink: 0;
  }

  .kit-top-bar__nav {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  /* "Centered" means centered in the free space between the reserved
   * regions: the nav takes all remaining width and centers its content.
   * (Competing auto margins would split the space unevenly instead.) */
  .kit-top-bar__nav--center {
    flex: 1 1 0;
    justify-content: center;
  }

  /* Centered search slot; wins the flexible space when present. */
  .kit-top-bar__search {
    display: flex;
    justify-content: center;
    flex: 0 1 auto;
    margin-inline: auto;
    min-width: 0;
  }

  .kit-top-bar__tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--bg-inset);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .kit-top-bar__tab {
    padding: 4px 14px;
    border: 0;
    background: transparent;
    border-radius: calc(var(--radius-md) - 2px);
    font-family: inherit;
    font-size: var(--font-size-md);
    font-weight: 500;
    line-height: 1.4;
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .kit-top-bar__tab:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  .kit-top-bar__tab.active {
    background: var(--bg-surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .kit-top-bar__tab:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .kit-top-bar__probe {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    visibility: hidden;
    pointer-events: none;
  }
</style>
