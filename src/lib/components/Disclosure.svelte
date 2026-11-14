<script module lang="ts">
  import type { HTMLAttributes, HTMLDetailsAttributes } from "svelte/elements";

  export type DisclosureVariant = "card" | "plain" | "bare";

  /** Extra attributes and handlers for the summary, the element that
   * toggles the disclosure. `class` is added to the summary's own classes.
   * Handlers run before the native toggle; `preventDefault` in `onclick`
   * cancels it. */
  export type DisclosureSummaryAttributes = Omit<HTMLAttributes<HTMLElement>, "children">;
</script>

<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { getContext, setContext, type Snippet } from "svelte";
  import { accordionContext, type AccordionContext } from "./accordion-context.js";

  /** Other attributes, such as `inert` or `data-*`, go on the `<details>`
   * element. */
  interface Props extends Omit<
    HTMLDetailsAttributes,
    "title" | "children" | "open" | "id" | "name" | "ontoggle" | "class"
  > {
    /** Header text. Use `summary` for rich header content. */
    title?: string;
    /** Rich header content, rendered instead of `title`. */
    summary?: Snippet;
    /** Trailing header content such as a count or status chip. It sits
     * inside the toggle, so keep it non-interactive. */
    meta?: Snippet;
    children: Snippet;
    /** Expanded state (bindable). Starts collapsed. */
    open?: boolean;
    /** Anchor for deep links: the disclosure opens when the URL hash
     * matches it, on load and on hash changes. */
    id?: string;
    /** Native exclusive group: opening one disclosure closes the others
     * with the same name. Accordion sets this for its items. */
    name?: string;
    /** `card` is a bordered panel; `plain` is a bare toggle row for inline
     * use, such as a collapsible tool call in a transcript. `bare` drops
     * the chevron, padding, and type styles and renders the header and body
     * without wrappers, so the summary can be laid out as a data row.
     * Ignored inside an Accordion, which draws its own frame. */
    variant?: DisclosureVariant;
    ontoggle?: (open: boolean) => void;
    /** Extra attributes and handlers for the summary, such as `aria-label`,
     * `data-*`, `onclick`, or `onkeydown`. */
    summaryAttributes?: DisclosureSummaryAttributes;
    class?: string;
  }

  let {
    title = undefined,
    summary = undefined,
    meta = undefined,
    children,
    open = $bindable(false),
    id = undefined,
    name = undefined,
    variant = "card",
    ontoggle = undefined,
    summaryAttributes = {},
    class: className = "",
    ...rest
  }: Props = $props();

  const accordion = getContext<AccordionContext | undefined>(accordionContext);
  // The accordion owns only its direct items. A Disclosure nested in an
  // item must not join the item's exclusive group, or opening it would
  // close the item that contains it.
  setContext(accordionContext, undefined);
  const groupName = $derived(name ?? accordion?.name);
  const look = $derived(accordion ? "grouped" : variant);

  function openIfTargeted() {
    if (!id) return;
    let target: string;
    try {
      target = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (target === id) open = true;
  }

  // The URL hash lives outside Svelte; sync it in on mount and when the id
  // changes. Hash changes after mount arrive through svelte:window.
  $effect(openIfTargeted);
</script>

<svelte:window onhashchange={openIfTargeted} />

{#snippet header()}
  {#if summary}{@render summary()}{:else}{title}{/if}
{/snippet}

<details
  {...rest}
  class={["kit-disclosure", `kit-disclosure--${look}`, className]}
  {id}
  name={groupName}
  bind:open
  ontoggle={(event) => ontoggle?.(event.currentTarget.open)}
>
  {#if look === "bare"}
    <summary {...summaryAttributes} class={["kit-disclosure__row", summaryAttributes.class]}>
      {@render header()}{@render meta?.()}
    </summary>
    {@render children()}
  {:else}
    <summary {...summaryAttributes} class={["kit-disclosure__summary", summaryAttributes.class]}>
      <span class="kit-disclosure__chevron" aria-hidden="true"><ChevronRightIcon size={14} /></span>
      <span class="kit-disclosure__title">{@render header()}</span>
      {#if meta}<span class="kit-disclosure__meta">{@render meta()}</span>{/if}
    </summary>
    <div class="kit-disclosure__content">{@render children()}</div>
  {/if}
</details>

<style>
  .kit-disclosure {
    min-width: 0;
  }

  .kit-disclosure--card,
  .kit-disclosure--plain,
  .kit-disclosure--grouped {
    color: var(--text-primary);
  }

  .kit-disclosure--card {
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
  }

  .kit-disclosure--grouped:not(:first-child) {
    border-top: var(--border-width) solid var(--border-muted);
  }

  .kit-disclosure__summary {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-radius: inherit;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    list-style: none;
    user-select: none;
  }

  .kit-disclosure__summary::-webkit-details-marker,
  .kit-disclosure__row::-webkit-details-marker {
    display: none;
  }

  /* Zero specificity, so a consumer's own summary class wins. */
  :where(.kit-disclosure__row) {
    cursor: pointer;
    list-style: none;
  }

  .kit-disclosure__row:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }

  .kit-disclosure--plain > .kit-disclosure__summary {
    padding: var(--space-2) 0;
    font-weight: var(--font-weight-medium);
  }

  .kit-disclosure--card[open] > .kit-disclosure__summary {
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }

  .kit-disclosure__summary:hover {
    background: var(--bg-surface-hover);
  }

  .kit-disclosure--plain > .kit-disclosure__summary:hover {
    background: transparent;
    color: var(--text-primary);
  }

  .kit-disclosure__summary:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }

  .kit-disclosure--plain > .kit-disclosure__summary:focus-visible {
    outline-offset: 2px;
  }

  .kit-disclosure__chevron {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
    transition: transform var(--transition-fast);
  }

  .kit-disclosure[open] > .kit-disclosure__summary .kit-disclosure__chevron {
    transform: rotate(90deg);
  }

  .kit-disclosure__title {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .kit-disclosure__meta {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
  }

  /* Body text lines up with the title, past the chevron and its gap. */
  .kit-disclosure__content {
    padding: 0 var(--space-5) var(--space-5) calc(var(--space-5) + 14px + var(--space-3));
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .kit-disclosure--plain > .kit-disclosure__content {
    padding: 0 0 var(--space-3) calc(14px + var(--space-3));
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-disclosure__chevron {
      transition: none;
    }
  }
</style>
