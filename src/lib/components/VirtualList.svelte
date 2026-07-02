<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { tick, untrack } from "svelte";
  import { offsetOfIndex, virtualSlice } from "./virtual.js";

  interface Props {
    items: T[];
    /** Fixed row height in px — the fast path. Omit for variable-height
     * rows (measured as they render, `estimateHeight` until then). */
    itemHeight?: number;
    /** Initial height guess for unmeasured variable rows. */
    estimateHeight?: number;
    /** Rows rendered beyond each edge of the viewport. */
    overscan?: number;
    /** CSS height of the scroll container. */
    height?: string;
    /** Active (keyboard-highlighted) row index (bindable). −1 = none. */
    activeIndex?: number;
    /** Enter/double-click on the active row. */
    onactivate?: (item: T, index: number) => void;
    /** Fires when the rendered range changes: [start, end). */
    onrangechange?: (start: number, end: number) => void;
    /** Accessible name for the listbox — required: the container is the
     * focusable keyboard target and must be announced with a name. */
    ariaLabel: string;
    row: Snippet<[T, number, boolean]>;
    empty?: Snippet;
    class?: string;
  }

  let {
    items,
    itemHeight = undefined,
    estimateHeight = 32,
    overscan = 4,
    height = "100%",
    activeIndex = $bindable(-1),
    onactivate = undefined,
    onrangechange = undefined,
    ariaLabel,
    row,
    empty = undefined,
    class: className = "",
  }: Props = $props();

  const uid = $props.id();
  let containerEl = $state<HTMLDivElement>();
  let scrollTop = $state(0);
  let viewport = $state(0);

  // Measured heights for variable mode. The Map itself is non-reactive
  // (rows write during ResizeObserver callbacks); `measureVersion` is the
  // reactive signal that a measurement changed.
  const measured = new Map<number, number>();
  let measureVersion = $state(0);
  let measuredFor: T[] | undefined;

  // Index-keyed measurements are only valid for the array they were taken
  // from — filtering/sorting/replacing items reuses indexes for different
  // rows, so a new array identity invalidates the cache (rows re-measure
  // as they render).
  $effect(() => {
    if (measuredFor !== undefined && items !== measuredFor) {
      measured.clear();
      measureVersion += 1;
    }
    measuredFor = items;
  });

  // Guard against nonsensical sizing props: zero/negative heights would
  // degenerate the windowing math, fractional/negative overscan the loops.
  const heightOf = (index: number): number => {
    const h = itemHeight ?? measured.get(index) ?? estimateHeight;
    return h > 0 ? h : 1;
  };

  const slice = $derived.by(() => {
    void measureVersion;
    void items.length;
    return virtualSlice({
      scrollTop,
      viewport,
      count: items.length,
      overscan: Math.max(0, Math.floor(overscan)),
      heightOf,
    });
  });

  $effect(() => {
    onrangechange?.(slice.start, slice.end);
  });

  // Item-change policy: when the list shrinks past the active row, clamp
  // to the last row (−1 when empty) so the bound activeIndex, the visual
  // highlight, and Enter's target never disagree.
  $effect(() => {
    if (activeIndex >= items.length) {
      activeIndex = items.length - 1;
    }
  });

  // aria-activedescendant can only reference a rendered row, so an
  // activeIndex set from outside the rendered slice (controlled usage,
  // initial selection) is scrolled back into view. `viewport` is tracked
  // so a scroll requested before ResizeObserver has measured (mount-time
  // initial selection → viewport 0) retries once real geometry exists.
  let lastActive = -1;
  $effect(() => {
    const index = activeIndex;
    const measured = viewport > 0;
    untrack(() => {
      if (index === lastActive) return;
      if (index >= 0 && index < items.length && (index < slice.start || index >= slice.end)) {
        if (!measured) return; // leave unhandled — retry when viewport lands
        lastActive = index;
        void scrollToIndex(index);
      } else {
        lastActive = index;
      }
    });
  });

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver(() => {
      viewport = containerEl?.clientHeight ?? 0;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  function measureRow(index: number) {
    return (node: HTMLElement) => {
      if (itemHeight !== undefined) return;
      const observer = new ResizeObserver(() => {
        const h = node.offsetHeight;
        if (h > 0 && measured.get(index) !== h) {
          measured.set(index, h);
          measureVersion += 1;
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    };
  }

  /** Scroll a row into view (aligned to the nearest edge). */
  export async function scrollToIndex(index: number): Promise<void> {
    if (!containerEl || items.length === 0) return;
    const i = Math.min(Math.max(0, index), items.length - 1);
    const top = offsetOfIndex(i, items.length, heightOf);
    const bottom = top + heightOf(i);
    if (top < containerEl.scrollTop) {
      containerEl.scrollTop = top;
    } else if (bottom > containerEl.scrollTop + viewport) {
      containerEl.scrollTop = bottom - viewport;
    }
    await tick();
  }

  // Keyboard navigation lives on the container, so focus never sits on a
  // row that virtualization might unmount (focus retention by design).
  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    // Only navigate while the container itself has focus — keys typed into
    // interactive row content (inputs, buttons) are none of our business.
    if (event.target !== containerEl) return;
    if (items.length === 0) return;
    const current = Math.min(Math.max(-1, activeIndex), items.length - 1);
    let next = current;
    if (event.key === "ArrowDown") next = Math.min(items.length - 1, current + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, current - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Enter" && current >= 0) {
      const item = items[current];
      if (item !== undefined) onactivate?.(item, current);
      return;
    } else {
      return;
    }
    event.preventDefault();
    activeIndex = next;
    await scrollToIndex(next);
  }

  // Clicks that land on interactive row content (buttons, links, fields)
  // belong to that content, not to row selection/activation.
  function onInteractiveContent(event: Event): boolean {
    const el = event.target as HTMLElement | null;
    return (
      el?.closest(
        "button, a[href], input, textarea, select, [contenteditable], [role='button'], [role='link']",
      ) != null
    );
  }

  function handleScroll(): void {
    scrollTop = containerEl?.scrollTop ?? 0;
  }
</script>

{#if items.length === 0 && empty}
  {@render empty()}
{:else}
  <!-- The container is the keyboard-nav target so focus never sits on a
       row that virtualization might unmount. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class={["kit-virtual-list", className]}
    bind:this={containerEl}
    style:height
    tabindex="0"
    role="listbox"
    aria-label={ariaLabel}
    aria-activedescendant={activeIndex >= slice.start && activeIndex < slice.end
      ? `${uid}-row-${activeIndex}`
      : undefined}
    onscroll={handleScroll}
    onkeydown={handleKeydown}
  >
    <div
      class="kit-virtual-list__spacer"
      style:height="{slice.totalHeight}px"
    >
      <div
        class="kit-virtual-list__window"
        style:transform="translateY({slice.topPad}px)"
      >
        {#each items.slice(slice.start, slice.end) as item, i (slice.start + i)}
          {@const index = slice.start + i}
          <!-- Pointer shortcuts only — Enter on the focused container is the
               accessible activation path. -->
          <div
            class="kit-virtual-list__row"
            class:kit-virtual-list__row--active={index === activeIndex}
            role="option"
            id="{uid}-row-{index}"
            aria-selected={index === activeIndex}
            tabindex="-1"
            onpointerdown={(event) => {
              if (!onInteractiveContent(event)) activeIndex = index;
            }}
            ondblclick={(event) => {
              if (!onInteractiveContent(event)) onactivate?.(item, index);
            }}
            {@attach measureRow(index)}
          >
            {@render row(item, index, index === activeIndex)}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .kit-virtual-list {
    position: relative;
    overflow-y: auto;
    overflow-anchor: none;
    min-height: 0;
  }

  .kit-virtual-list:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }

  .kit-virtual-list__spacer {
    position: relative;
    width: 100%;
    pointer-events: none;
  }

  .kit-virtual-list__window {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    pointer-events: auto;
  }

  .kit-virtual-list__row--active {
    background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  }
</style>
