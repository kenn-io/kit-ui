<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    /** Muted helper text under the title. */
    description?: string;
    /** The setting rows. */
    children: Snippet;
  }

  let { title, description = undefined, children }: Props = $props();
</script>

<section class="kit-settings-section">
  <header class="kit-settings-section__header">
    <h3 class="kit-settings-section__title">{title}</h3>
    {#if description}
      <p class="kit-settings-section__description">{description}</p>
    {/if}
  </header>
  <div class="kit-settings-section__body">
    {@render children()}
  </div>
</section>

<style>
  .kit-settings-section {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
  }

  .kit-settings-section__header {
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--border-muted);
  }

  .kit-settings-section__title {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .kit-settings-section__description {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    line-height: 1.45;
  }

  .kit-settings-section__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-6);
  }
</style>
