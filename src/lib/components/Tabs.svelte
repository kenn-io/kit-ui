<script module lang="ts">
  export interface TabItem {
    id: string;
    label: string;
    disabled?: boolean;
    /** Muted count after the label, e.g. the number of changed files. */
    count?: number | string;
  }

  export type TabsActivation = "automatic" | "manual";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    tabs: TabItem[];
    /** Selected tab id (bindable). */
    value: string;
    /** Called when the user selects another tab. */
    onchange?: (id: string) => void;
    /** Accessible name for the tab list. */
    ariaLabel?: string;
    /** `automatic` (default) selects a tab as arrow keys focus it. Use
     * `manual` when showing a panel is slow: arrows only move focus, and
     * Enter or Space selects. */
    activation?: TabsActivation;
    /** Custom tab content (icons, badges) rendered instead of the label.
     * `tab.label` stays the accessible name. */
    tab?: Snippet<[TabItem, boolean]>;
    /** The selected tab's panel, rendered in a tabpanel labelled by the
     * selected tab. Omit it to render the tab list alone. */
    children?: Snippet<[string]>;
    class?: string;
  }

  let {
    tabs,
    value = $bindable(),
    onchange = undefined,
    ariaLabel = undefined,
    activation = "automatic",
    tab = undefined,
    children = undefined,
    class: className = "",
  }: Props = $props();

  const uid = $props.id();
  const panelId = `${uid}-panel`;
  const tabId = (id: string) => `${uid}-tab-${id}`;

  // The tab arrow keys last moved focus to while focus is in the list. In
  // manual mode it differs from the selection, and it must hold the roving
  // tabindex so Tab and Shift+Tab leave the list instead of stepping back
  // to the selected tab.
  let rovingId = $state<string | undefined>(undefined);

  const enabledId = (id: string | undefined) => tabs.find((t) => t.id === id && !t.disabled)?.id;

  // The one tab in the Tab order: the roving one while focus is in the
  // list, else the selected one, else the first enabled tab.
  const focusId = $derived(
    enabledId(rovingId) ?? enabledId(value) ?? tabs.find((t) => !t.disabled)?.id,
  );

  // Coming back into the list should land on the selected tab.
  function handleFocusout(event: FocusEvent): void {
    const list = event.currentTarget as HTMLElement;
    if (!list.contains(event.relatedTarget as Node | null)) rovingId = undefined;
  }

  function select(item: TabItem): void {
    if (item.disabled || item.id === value) return;
    value = item.id;
    onchange?.(item.id);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const enabled = tabs.filter((t) => !t.disabled);
    if (enabled.length === 0) return;
    const focused = (event.target as HTMLElement).dataset["tabId"];
    const current = enabled.findIndex((t) => t.id === focused);
    let next: TabItem | undefined;
    switch (event.key) {
      case "ArrowRight":
        next = enabled[(current + 1) % enabled.length];
        break;
      case "ArrowLeft":
        next = enabled[(current - 1 + enabled.length) % enabled.length];
        break;
      case "Home":
        next = enabled[0];
        break;
      case "End":
        next = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    if (!next) return;
    event.preventDefault();
    rovingId = next.id;
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(next.id)}"]`)
      ?.focus();
    if (activation === "automatic") select(next);
  }
</script>

<div class="kit-tabs {className}">
  <div
    class="kit-tabs__list"
    role="tablist"
    aria-label={ariaLabel}
    aria-orientation="horizontal"
    tabindex="-1"
    onkeydown={handleKeydown}
    onfocusout={handleFocusout}
  >
    {#each tabs as item (item.id)}
      {@const selected = item.id === value}
      <button
        type="button"
        class="kit-tabs__tab"
        class:kit-tabs__tab--selected={selected}
        role="tab"
        id={tabId(item.id)}
        data-tab-id={item.id}
        aria-selected={selected}
        aria-controls={selected && children ? panelId : undefined}
        aria-label={tab ? item.label : undefined}
        tabindex={item.id === focusId ? 0 : -1}
        disabled={item.disabled}
        onclick={() => {
          rovingId = item.id;
          select(item);
        }}
      >
        {#if tab}
          {@render tab(item, selected)}
        {:else}
          <span class="kit-tabs__label">{item.label}</span>
          {#if item.count !== undefined}
            <span class="kit-tabs__count">{item.count}</span>
          {/if}
        {/if}
      </button>
    {/each}
  </div>
  {#if children && value !== undefined}
    <div
      class="kit-tabs__panel"
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId(value)}
      tabindex="0"
    >
      {@render children(value)}
    </div>
  {/if}
</div>

<style>
  .kit-tabs {
    min-width: 0;
  }

  .kit-tabs__list {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    border-bottom: var(--border-width) solid var(--border-muted);
    scrollbar-width: none;
  }

  .kit-tabs__list::-webkit-scrollbar {
    display: none;
  }

  .kit-tabs__tab {
    position: relative;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    color: var(--text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
  }

  .kit-tabs__tab:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  .kit-tabs__tab:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }

  .kit-tabs__tab:disabled {
    cursor: default;
    opacity: var(--opacity-disabled, 0.5);
  }

  .kit-tabs__tab--selected {
    color: var(--text-primary);
  }

  /* The selection bar sits on the list's bottom rule. */
  .kit-tabs__tab--selected::after {
    content: "";
    position: absolute;
    right: var(--space-3);
    bottom: 0;
    left: var(--space-3);
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: var(--accent-blue);
  }

  .kit-tabs__count {
    padding: 0 var(--space-2);
    background: var(--bg-inset);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
  }

  .kit-tabs__panel {
    padding-top: var(--space-5);
  }

  .kit-tabs__panel:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
</style>
