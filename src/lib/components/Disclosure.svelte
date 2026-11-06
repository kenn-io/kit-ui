<script module lang="ts">
  export type DisclosureVariant = "card" | "plain";
</script>

<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { getContext, setContext, type Snippet } from "svelte";
  import { accordionContext, type AccordionContext } from "./accordion-context.js";

  interface Props {
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
     * use, such as a collapsible tool call in a transcript. Ignored inside
     * an Accordion, which draws its own frame. */
    variant?: DisclosureVariant;
    ontoggle?: (open: boolean) => void;
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
    class: className = "",
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

<details
  class="kit-disclosure {className}"
  class:kit-disclosure--card={look === "card"}
  class:kit-disclosure--plain={look === "plain"}
  class:kit-disclosure--grouped={look === "grouped"}
  {id}
  name={groupName}
  bind:open
  ontoggle={(event) => ontoggle?.(event.currentTarget.open)}
>
  <summary class="kit-disclosure__summary">
    <span class="kit-disclosure__chevron" aria-hidden="true"><ChevronRightIcon size={14} /></span>
    <span class="kit-disclosure__title">
      {#if summary}{@render summary()}{:else}{title}{/if}
    </span>
    {#if meta}<span class="kit-disclosure__meta">{@render meta()}</span>{/if}
  </summary>
  <div class="kit-disclosure__content">{@render children()}</div>
</details>

<style>
  .kit-disclosure {
    min-width: 0;
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

  .kit-disclosure__summary::-webkit-details-marker {
    display: none;
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
