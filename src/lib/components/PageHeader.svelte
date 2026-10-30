<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Heading text, or a snippet for a title with markup such as inline code or an edit field. */
    title: string | Snippet;
    /** Muted line under the title, as text or a snippet with markup. */
    description?: string | Snippet;
    /** Heading level of the title. Pages use 1; a header inside a pane can use 2 or 3. */
    level?: 1 | 2 | 3;
    /** Title size, independent of the heading level. */
    size?: "large" | "medium" | "small";
    /** Lets the title take focus from script, for moving focus to it after a view change. */
    focusable?: boolean;
    /** The rendered heading element. */
    titleElement?: HTMLHeadingElement | undefined;
    /** Rendered above the title, typically a back link or breadcrumbs. */
    before?: Snippet;
    /** Beside the title on its line, typically a status chip or label. */
    trailing?: Snippet;
    /** Trailing controls or status, aligned with the bottom of the title block. */
    actions?: Snippet;
  }

  let {
    title,
    description = undefined,
    level = 1,
    size = "large",
    focusable = false,
    titleElement = $bindable(undefined),
    before = undefined,
    trailing = undefined,
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
    <div class="kit-page-header__title-row">
      <svelte:element
        this={`h${level}`}
        bind:this={titleElement}
        class="kit-page-header__title kit-page-header__title--{size}"
        tabindex={focusable ? -1 : undefined}
      >
        {#if typeof title === "string"}{title}{:else}{@render title()}{/if}
      </svelte:element>
      {#if trailing}
        <div class="kit-page-header__trailing">{@render trailing()}</div>
      {/if}
    </div>
    {#if description}
      <p class="kit-page-header__description">
        {#if typeof description === "string"}{description}{:else}{@render description()}{/if}
      </p>
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

  .kit-page-header__title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    min-width: 0;
  }

  .kit-page-header__title {
    min-width: 0;
    margin: 0;
    color: var(--text-primary);
    font-family: var(--kit-page-header-title-font, inherit);
    font-weight: var(--kit-page-header-title-weight, var(--font-weight-bold, 700));
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .kit-page-header__title--large {
    font-size: var(--kit-page-header-title-size, var(--font-size-xl));
  }

  .kit-page-header__title--medium {
    font-size: var(--kit-page-header-title-size-medium, var(--font-size-lg));
  }

  .kit-page-header__title--small {
    font-size: var(--kit-page-header-title-size-small, var(--font-size-md));
  }

  .kit-page-header__trailing {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
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
