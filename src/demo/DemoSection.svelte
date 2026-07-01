<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description?: string;
    code?: string;
    children?: Snippet;
  }

  let { title, description, code, children }: Props = $props();
</script>

<section class="demo-section">
  <h3 class="demo-section__title">{title}</h3>
  {#if description}
    <p class="demo-section__description">{description}</p>
  {/if}
  <div class="demo-section__canvas">
    {#if children}
      {@render children()}
    {/if}
  </div>
  {#if code}
    <pre class="demo-section__code"><code>{code}</code></pre>
  {/if}
</section>

<style>
  .demo-section {
    margin-bottom: 32px;
  }

  .demo-section__title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .demo-section__description {
    color: var(--text-secondary);
    margin-bottom: 12px;
    max-width: 640px;
  }

  .demo-section__canvas {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-5);
    padding: 20px;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
  }

  .demo-section__code {
    margin-top: 8px;
    padding: 12px 16px;
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    overflow-x: auto;
    white-space: pre;
  }
</style>
