<script module lang="ts">
  export interface SettingsCategory {
    id: string;
    label: string;
    /** Categories sharing a group get a muted heading rendered above their
     * run; ungrouped categories render as before. */
    group?: string;
    /** Muted one-liner under the label describing the category. */
    summary?: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    categories: SettingsCategory[];
    /** Id of the selected category (bindable). Defaults to the first category. */
    active?: string;
    /** Content for the active category; receives the active category id. */
    panel: Snippet<[string]>;
    /** Sidebar heading. Pass "" to hide it. */
    title?: string;
    /** Rendered above the category nav — e.g. a settings search box or a
     * back-to-app button. */
    sidebarHeader?: Snippet;
    /** Pinned below the scrollable content, e.g. save/cancel actions. */
    footer?: Snippet;
  }

  let {
    categories,
    active = $bindable(categories[0]?.id ?? ""),
    panel,
    title = "Settings",
    sidebarHeader = undefined,
    footer = undefined,
  }: Props = $props();

  // Group headings sit between runs of the same `group` value, so the
  // categories array order stays the display order.
  interface CategoryRun {
    /** First category's id — stable key for the run. */
    key: string;
    group: string | undefined;
    items: SettingsCategory[];
  }

  // Display-level fallback: if the bound `active` id is absent from
  // `categories` (e.g. a transient host-side filter), show the first category
  // instead of a stale panel. `active` itself is left untouched so clearing
  // the filter restores the selection; clicking commits a new one.
  const resolvedActive = $derived(
    categories.some((category) => category.id === active) ? active : (categories[0]?.id ?? ""),
  );

  const runs = $derived.by(() => {
    const result: CategoryRun[] = [];
    for (const category of categories) {
      const last = result.at(-1);
      if (last && last.group === category.group) {
        last.items.push(category);
      } else {
        result.push({ key: category.id, group: category.group, items: [category] });
      }
    }
    return result;
  });
</script>

<div class="kit-settings">
  <aside class="kit-settings__sidebar">
    {#if title}
      <h2 class="kit-settings__title">{title}</h2>
    {/if}
    {#if sidebarHeader}
      <div class="kit-settings__sidebar-header">
        {@render sidebarHeader()}
      </div>
    {/if}
    <nav class="kit-settings__nav" aria-label={title || "Settings"}>
      {#each runs as run (run.key)}
        {#if run.group}
          <div class="kit-settings__group-title">{run.group}</div>
        {/if}
        {#each run.items as category (category.id)}
          <button
            class={[
              "kit-settings__nav-item",
              active === category.id && "kit-settings__nav-item--active",
            ]}
            type="button"
            aria-current={active === category.id ? "true" : undefined}
            onclick={() => (active = category.id)}
          >
            <span class="kit-settings__nav-label">{category.label}</span>
            {#if category.summary}
              <span class="kit-settings__nav-summary">{category.summary}</span>
            {/if}
          </button>
        {/each}
      {/each}
    </nav>
  </aside>

  <div class="kit-settings__content">
    <div class="kit-settings__scroll">
      <div class="kit-settings__panel">
        {@render panel(active)}
      </div>
    </div>
    {#if footer}
      <div class="kit-settings__footer">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

<style>
  .kit-settings {
    display: flex;
    flex: 1;
    min-height: 0;
    width: 100%;
    background: var(--bg-primary);
  }

  .kit-settings__sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: 200px;
    flex-shrink: 0;
    padding: var(--space-6) var(--space-4);
    background: var(--bg-surface);
    border-right: 1px solid var(--border-default);
    overflow-y: auto;
  }

  .kit-settings__title {
    margin: 0;
    padding: 0 var(--space-4);
    color: var(--text-primary);
    font-size: var(--font-size-lg);
    font-weight: 650;
  }

  .kit-settings__sidebar-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .kit-settings__nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .kit-settings__group-title {
    padding: 0 var(--space-4);
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .kit-settings__group-title:not(:first-child) {
    margin-top: var(--space-4);
  }

  .kit-settings__nav-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    border: 0;
    background: transparent;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }

  .kit-settings__nav-summary {
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
    font-weight: 400;
    white-space: normal;
  }

  .kit-settings__nav-item:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-settings__nav-item--active {
    background: var(--bg-inset);
    color: var(--accent-blue);
    font-weight: 650;
  }

  .kit-settings__nav-item--active:hover {
    background: var(--bg-inset);
    color: var(--accent-blue);
  }

  .kit-settings__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .kit-settings__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .kit-settings__panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 760px;
    margin: 0 auto;
    padding: var(--space-7) var(--space-6) var(--space-8);
  }

  .kit-settings__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-4);
    flex-shrink: 0;
    padding: var(--space-5) var(--space-6);
    background: var(--bg-surface);
    border-top: 1px solid var(--border-default);
  }

  /* Narrow: sidebar collapses to a top strip with horizontal categories. */
  @media (max-width: 760px) {
    .kit-settings {
      flex-direction: column;
    }

    .kit-settings__sidebar {
      flex-direction: row;
      align-items: center;
      width: 100%;
      padding: var(--space-4) var(--space-5);
      border-right: 0;
      border-bottom: 1px solid var(--border-default);
      overflow-y: visible;
      overflow-x: auto;
    }

    .kit-settings__title {
      padding: 0;
    }

    .kit-settings__nav {
      flex-direction: row;
    }

    /* The horizontal strip keeps only the labels: group headings and
     * per-item summaries don't fit a single scrolling row. */
    .kit-settings__group-title,
    .kit-settings__nav-summary {
      display: none;
    }
  }
  /* Normalized keyboard focus (gyp8): one ring token, :focus-visible only. */
  .kit-settings__nav-item:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }
</style>
