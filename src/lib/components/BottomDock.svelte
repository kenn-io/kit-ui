<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import IconButton from "./IconButton.svelte";
  import SplitResizeHandle from "./SplitResizeHandle.svelte";
  import type { SplitResizeEvent } from "./split-resize.js";

  interface Props {
    open: boolean;
    onclose: () => void;
    ariaLabel: string;
    initialHeight?: string;
    minHeight?: string;
    maxHeight?: string;
    keyboardStep?: number;
    closable?: boolean;
    closeTitle?: string;
    closeAriaLabel?: string;
    class?: string;
    header?: Snippet;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    open,
    onclose,
    ariaLabel,
    initialHeight = "50vh",
    minHeight = "200px",
    maxHeight = "80vh",
    keyboardStep = 24,
    closable = true,
    closeTitle = "Close panel",
    closeAriaLabel = "Close panel",
    class: className = "",
    header,
    children,
    footer,
  }: Props = $props();

  let requestedHeight = $derived(initialHeight);
  let measuredHeight = $state(0);
  let measuredMinHeight = $state(0);
  let measuredMaxHeight = $state(100);
  let startHeight = 0;

  /* Resolve CSS lengths through the dock's real containing block. */
  function measureHeights(
    element: HTMLElement,
    minimum: string,
    maximum: string,
  ): { height: number; min: number; max: number } {
    const originalStyle = element.getAttribute("style");
    let min = 0;
    let max = 0;

    try {
      element.style.setProperty("transition", "none", "important");
      element.style.minHeight = "0px";
      element.style.maxHeight = "none";

      element.style.height = minimum;
      min = Math.round(element.getBoundingClientRect().height);

      element.style.height = maximum;
      max = Math.round(element.getBoundingClientRect().height);
    } finally {
      if (originalStyle === null) element.removeAttribute("style");
      else element.setAttribute("style", originalStyle);
    }

    const height = Math.round(element.getBoundingClientRect().height);
    return { height, min, max: Math.max(min, max) };
  }

  function observeHeight(minimum: string, maximum: string): Attachment<HTMLElement> {
    return (element) => {
      let frame: number | null = null;

      const update = () => {
        frame = null;
        const measured = measureHeights(element, minimum, maximum);
        measuredHeight = measured.height;
        measuredMinHeight = measured.min;
        measuredMaxHeight = measured.max;
      };

      const scheduleUpdate = () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(update);
      };

      update();
      const resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(element);

      const mutationObserver = new MutationObserver(scheduleUpdate);
      mutationObserver.observe(element, {
        attributes: true,
        attributeFilter: ["class"],
      });
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        resizeObserver.observe(ancestor);
        mutationObserver.observe(ancestor, {
          attributes: true,
          attributeFilter: ["class", "style", "data-kit-theme"],
        });
      }

      window.addEventListener("resize", scheduleUpdate);
      return () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        window.removeEventListener("resize", scheduleUpdate);
        if (frame !== null) cancelAnimationFrame(frame);
      };
    };
  }

  function handleResizeStart(): void {
    startHeight = measuredHeight ?? 0;
  }

  function handleResize(event: SplitResizeEvent): void {
    requestedHeight = `${Math.max(0, startHeight - event.delta)}px`;
  }
</script>

{#if open}
  <section
    class={["kit-bottom-dock", className].filter(Boolean).join(" ")}
    aria-label={ariaLabel}
    style:height={requestedHeight}
    style:min-height={minHeight}
    style:max-height={maxHeight}
    {@attach observeHeight(minHeight, maxHeight)}
  >
    <SplitResizeHandle
      {ariaLabel}
      orientation="vertical"
      {keyboardStep}
      ariaValueMin={measuredMinHeight}
      ariaValueMax={measuredMaxHeight}
      ariaValueNow={measuredHeight}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeEnd={handleResize}
    />

    {#if header || closable}
      <div class="kit-bottom-dock__header">
        <div class="kit-bottom-dock__header-content">
          {#if header}
            {@render header()}
          {/if}
        </div>
        {#if closable}
          <IconButton size="sm" title={closeTitle} ariaLabel={closeAriaLabel} onclick={onclose}>
            <XIcon size="14" strokeWidth="2" aria-hidden="true" />
          </IconButton>
        {/if}
      </div>
    {/if}

    <div class="kit-bottom-dock__body">
      {#if children}
        {@render children()}
      {/if}
    </div>

    {#if footer}
      <div class="kit-bottom-dock__footer">
        {@render footer()}
      </div>
    {/if}
  </section>
{/if}

<style>
  .kit-bottom-dock {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
  }

  .kit-bottom-dock__header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: var(--border-width) solid var(--border-muted);
    flex-shrink: 0;
  }

  .kit-bottom-dock__header-content {
    flex: 1;
    min-width: 0;
  }

  .kit-bottom-dock__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .kit-bottom-dock__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-top: var(--border-width) solid var(--border-muted);
    flex-shrink: 0;
  }
</style>
