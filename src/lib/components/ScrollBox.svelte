<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import type { ClassValue, HTMLAttributes } from "svelte/elements";
  import { getScrollIndicatorGeometry } from "./scroll-indicator.js";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "class" | "onscroll"> {
    class?: ClassValue;
    dataTest?: string | undefined;
    label: string;
    onscroll?: ((event: Event) => void) | undefined;
    viewport?: HTMLDivElement | undefined;
    children: Snippet;
  }

  let {
    class: className = "",
    dataTest,
    label,
    onscroll,
    viewport = $bindable(),
    children,
    ...rest
  }: Props = $props();

  let viewportHeight = $state(0);
  let contentHeight = $state(0);
  let scrollTop = $state(0);
  let visible = $state(false);
  let hideTimer: number | undefined;
  let content = $state<HTMLDivElement>();

  const geometry = $derived(getScrollIndicatorGeometry(viewportHeight, contentHeight, scrollTop));

  function handleScroll(event: Event): void {
    // Re-measure on every scroll: overflowing/transformed descendants can
    // grow scrollHeight without resizing the content wrapper's border box,
    // so the ResizeObserver alone can miss them.
    updateDimensions();
    scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
    if (geometry.scrollable) {
      visible = true;
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        visible = false;
      }, 700);
    }
    onscroll?.(event);
  }

  function updateDimensions(): void {
    if (!viewport) return;
    viewportHeight = viewport.clientHeight;
    // scrollHeight, not the content wrapper's offsetHeight: it includes
    // collapsed margins and overflowing descendants, which is what the
    // viewport can actually scroll across.
    contentHeight = viewport.scrollHeight;
  }

  onMount(() => {
    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (viewport) observer.observe(viewport);
    if (content) observer.observe(content);

    return () => {
      observer.disconnect();
      window.clearTimeout(hideTimer);
    };
  });
</script>

<div class={["kit-scrollbox", className]} data-test={dataTest}>
  <!-- Scrollable regions need keyboard access. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    tabindex="0"
    {...rest}
    class="kit-scrollbox__viewport"
    aria-label={label}
    bind:this={viewport}
    onscroll={handleScroll}
    role="region"
  >
    <div class="kit-scrollbox__content" bind:this={content}>
      {@render children()}
    </div>
  </div>
  <div
    class={[
      "kit-scrollbox__indicator",
      { "kit-scrollbox__indicator--visible": visible && geometry.scrollable },
    ]}
    aria-hidden="true"
  >
    <span
      class="kit-scrollbox__thumb"
      style:height={`${geometry.height}px`}
      style:transform={`translateY(${geometry.top}px)`}
    ></span>
  </div>
</div>

<style>
  .kit-scrollbox {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .kit-scrollbox__viewport {
    height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .kit-scrollbox__viewport::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .kit-scrollbox__content {
    min-height: 100%;
  }

  .kit-scrollbox__indicator {
    position: absolute;
    inset: 0 2px 0 auto;
    z-index: 2;
    width: 4px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 160ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .kit-scrollbox__indicator--visible {
    opacity: 1;
  }

  .kit-scrollbox__thumb {
    display: block;
    width: 100%;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text-muted) 72%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--bg-primary) 35%, transparent);
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-scrollbox__indicator {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .kit-scrollbox__thumb {
      background: CanvasText;
      box-shadow: none;
    }
  }
</style>
