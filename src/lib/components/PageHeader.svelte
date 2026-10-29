<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    /** Muted line under the title. */
    description?: string;
    /** Heading level of the title. Pages use 1; a header inside a pane can use 2 or 3. */
    level?: 1 | 2 | 3;
    /** Rendered above the title, typically a back link or breadcrumbs. */
    before?: Snippet;
    /** Trailing controls or status, aligned with the bottom of the title block. */
    actions?: Snippet;
  }

  let {
    title,
    description = undefined,
    level = 1,
    before = undefined,
    actions = undefined,
  }: Props = $props();
</script>

<!-- The header draws no rule under itself: the page's spacing separates it
  from the content, and the first table or panel below supplies its own edge.
  A rule here would sit beside that edge as a second line. -->
<header class="kit-page-header">
  <div class="kit-page-header__text">
    {#if before}
      <div class="kit-page-header__before">{@render before()}</div>
    {/if}
    <svelte:element this={`h${level}`} class="kit-page-header__title">{title}</svelte:element>
    {#if description}
      <p class="kit-page-header__description">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="kit-page-header__actions">{@render actions()}</div>
  {/if}
</header>

<style>
  .kit-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4) var(--space-6);
    min-width: 0;
  }

  .kit-page-header__text {
    display: grid;
    flex: 1 1 auto;
    gap: var(--space-2);
    min-width: 0;
  }

  .kit-page-header__before {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .kit-page-header__title {
    margin: 0;
    color: var(--text-primary);
    font-family: var(--kit-page-header-title-font, inherit);
    font-size: var(--kit-page-header-title-size, var(--font-size-xl));
    font-weight: var(--font-weight-bold, 700);
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .kit-page-header__description {
    margin: 0;
    max-width: 75ch;
    color: var(--text-secondary);
    font-size: var(--font-size-md);
    line-height: 1.45;
  }

  .kit-page-header__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
</style>
