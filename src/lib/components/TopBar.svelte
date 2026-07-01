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

  function select(id: string): void {
    active = id;
    onchange?.(id);
  }

  // Auto-collapse by measurement, not by breakpoint: a hidden probe always
  // renders the full tab row, and the tabs collapse into a SelectDropdown
  // whenever that row would not fit next to the side regions. Because the
  // probe never collapses, the decision only depends on available width —
  // it cannot oscillate.
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
    const next = probeEl.offsetWidth > barEl.clientWidth - used;
    if (next !== collapsed) collapsed = next;
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
    <nav
      class="kit-top-bar__nav"
      class:kit-top-bar__nav--center={centerTabs}
      aria-label={ariaLabel}
    >
      {#if collapsed}
        <SelectDropdown
          class="kit-top-bar__nav-select"
          value={active}
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
              class:active={tab.id === active}
              disabled={tab.disabled}
              aria-current={tab.id === active ? "page" : undefined}
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

  .kit-top-bar__nav--center {
    margin-inline: auto;
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
