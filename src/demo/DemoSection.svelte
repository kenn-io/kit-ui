<script lang="ts">
  import type { Snippet } from "svelte";
  import { Card } from "../lib/index.js";

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
  <Card level="raised" class="demo-section__canvas">
    {#if children}
      {@render children()}
    {/if}
  </Card>
  {#if code}
    <Card level="inset" padding="none" class="demo-section__code">
      <pre><code>{code}</code></pre>
    </Card>
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

  /* The canvas is a raised Card so every page's stage exercises the
   * theme's border weight and shadow character. Its body hosts the demo
   * cluster; the direct-child selector keeps Cards demoed INSIDE the
   * canvas (CardDemo) untouched. */
  .demo-section :global(.demo-section__canvas > .kit-card__body) {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .demo-section :global(.demo-section__code) {
    margin-top: 8px;
  }

  .demo-section pre {
    margin: 0;
    padding: 12px 16px;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    overflow-x: auto;
    white-space: pre;
  }
</style>
