<script module lang="ts">
  export interface SettingsCategory {
    id: string;
    label: string;
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
    /** Pinned below the scrollable content, e.g. save/cancel actions. */
    footer?: Snippet;
  }

  let {
    categories,
    active = $bindable(categories[0]?.id ?? ""),
    panel,
    title = "Settings",
    footer = undefined,
  }: Props = $props();
</script>

<div class="kit-settings">
  <aside class="kit-settings__sidebar">
    {#if title}
      <h2 class="kit-settings__title">{title}</h2>
    {/if}
    <nav class="kit-settings__nav" aria-label={title || "Settings"}>
      {#each categories as category (category.id)}
        <button
          class={[
            "kit-settings__nav-item",
            active === category.id && "kit-settings__nav-item--active",
          ]}
          type="button"
          aria-current={active === category.id ? "true" : undefined}
          onclick={() => (active = category.id)}
        >
          {category.label}
        </button>
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

  .kit-settings__nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .kit-settings__nav-item {
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
  }
  /* Normalized keyboard focus (gyp8): one ring token, :focus-visible only. */
  .kit-settings__nav-item:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }
</style>
