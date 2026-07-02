<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Optional leading glyph, typically a lucide icon. */
    icon?: Snippet;
    title: string;
    description?: string;
    /** Rendered under the text, typically action buttons. */
    children?: Snippet;
  }

  let { icon = undefined, title, description = undefined, children = undefined }: Props = $props();
</script>

<div class="kit-empty-state">
  {#if icon}
    <div class="kit-empty-state__icon" aria-hidden="true">
      {@render icon()}
    </div>
  {/if}
  <p class="kit-empty-state__title">{title}</p>
  {#if description}
    <p class="kit-empty-state__description">{description}</p>
  {/if}
  {#if children}
    <div class="kit-empty-state__actions">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .kit-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    margin: auto;
    padding: var(--space-8) var(--space-6);
    text-align: center;
  }

  .kit-empty-state__icon {
    display: flex;
    margin-bottom: var(--space-2);
    color: var(--text-muted);
  }

  .kit-empty-state__title {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .kit-empty-state__description {
    margin: 0;
    max-width: 380px;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    line-height: 1.45;
  }

  .kit-empty-state__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
</style>
