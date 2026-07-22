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
    height?: string;
    onHeightChange?: (height: string) => void;
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
    height,
    onHeightChange,
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

  let internalHeight = $derived(initialHeight);
  const requestedHeight = $derived(height ?? internalHeight);
  let measuredHeight = $state(0);
  let measuredMinHeight = $state(0);
  let measuredMaxHeight = $state(100);
  let startHeight = 0;
  let dockElement: HTMLElement | null = null;
  let ownResizePending = false;
  let ownResizeResetFrame: number | null = null;
  let suppressedContextResize = false;
  let scheduleConstraintRefresh: (() => void) | null = null;

  interface ScrollPosition {
    element: HTMLElement;
    top: number;
    left: number;
  }

  function scrollPositions(element: HTMLElement): ScrollPosition[] {
    const positions: ScrollPosition[] = [];
    const remember = (candidate: HTMLElement) => {
      if (
        candidate.scrollTop !== 0 ||
        candidate.scrollLeft !== 0 ||
        candidate.scrollHeight > candidate.clientHeight ||
        candidate.scrollWidth > candidate.clientWidth
      ) {
        positions.push({
          element: candidate,
          top: candidate.scrollTop,
          left: candidate.scrollLeft,
        });
      }
    };

    remember(element);
    for (const descendant of element.querySelectorAll<HTMLElement>("*")) remember(descendant);
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      remember(ancestor);
    }
    return positions;
  }

  /* Resolve CSS lengths through the dock's real containing block. */
  function measureHeights(
    element: HTMLElement,
    minimum: string,
    maximum: string,
  ): { height: number; min: number; max: number } {
    const originalStyle = element.getAttribute("style");
    const savedScrollPositions = scrollPositions(element);
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
      element.getBoundingClientRect();
      for (const position of savedScrollPositions) {
        position.element.scrollTop = position.top;
        position.element.scrollLeft = position.left;
      }
    }

    const height = Math.round(element.getBoundingClientRect().height);
    return { height, min, max: Math.max(min, max) };
  }

  function observeHeight(minimum: string, maximum: string): Attachment<HTMLElement> {
    return (element) => {
      dockElement = element;
      let heightFrame: number | null = null;
      let constraintsFrame: number | null = null;

      const updateHeight = () => {
        heightFrame = null;
        measuredHeight = Math.round(element.getBoundingClientRect().height);
      };

      const updateConstraints = () => {
        constraintsFrame = null;
        const measured = measureHeights(element, minimum, maximum);
        measuredHeight = measured.height;
        measuredMinHeight = measured.min;
        measuredMaxHeight = measured.max;
      };

      const scheduleHeightUpdate = () => {
        if (heightFrame !== null || constraintsFrame !== null) return;
        heightFrame = requestAnimationFrame(updateHeight);
      };

      const scheduleConstraintUpdate = () => {
        if (constraintsFrame !== null) return;
        if (heightFrame !== null) {
          cancelAnimationFrame(heightFrame);
          heightFrame = null;
        }
        constraintsFrame = requestAnimationFrame(updateConstraints);
      };
      scheduleConstraintRefresh = scheduleConstraintUpdate;

      updateConstraints();
      const resizeObserver = new ResizeObserver((entries) => {
        const dockResized = entries.some((entry) => entry.target === element);
        const contextResized = entries.some((entry) => entry.target !== element);

        if (dockResized) scheduleHeightUpdate();
        if (contextResized && dockResized && ownResizePending) suppressedContextResize = true;
        else if (contextResized) scheduleConstraintUpdate();
      });
      resizeObserver.observe(element);

      const mutationObserver = new MutationObserver(scheduleConstraintUpdate);
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

      window.addEventListener("resize", scheduleConstraintUpdate);
      return () => {
        if (dockElement === element) dockElement = null;
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        window.removeEventListener("resize", scheduleConstraintUpdate);
        if (heightFrame !== null) cancelAnimationFrame(heightFrame);
        if (constraintsFrame !== null) cancelAnimationFrame(constraintsFrame);
        if (ownResizeResetFrame !== null) cancelAnimationFrame(ownResizeResetFrame);
        if (scheduleConstraintRefresh === scheduleConstraintUpdate)
          scheduleConstraintRefresh = null;
        ownResizePending = false;
        ownResizeResetFrame = null;
        suppressedContextResize = false;
      };
    };
  }

  let lastReportedHeight: string | null = null;
  let gestureResized = false;

  /*
   * SplitResizeHandle calls onResizeStart once per gesture: at pointerdown for
   * drags, and again at the top of every keydown for keyboard steps (before
   * that keydown's onResize/onResizeEnd pair). Resetting the dedup guard here
   * scopes it to exactly one gesture, so a value repeated across separate
   * gestures (a rejected controlled height, or an uncontrolled resize that
   * lands back on a prior report) is still reported. gestureResized tracks
   * whether this gesture produced a genuine, nonzero-delta onResize (real
   * pointer movement on the active axis, or a keyboard step, which always has
   * a nonzero delta); a pointerdown+pointerup with no movement, or pointer
   * jitter on the orthogonal axis only, fires onResize/onResizeEnd with a
   * zero-delta event, which must not report until a real move has occurred.
   * Once a gesture has moved, a return to delta 0 (back to the start height)
   * is a genuine report, not jitter, so the guard only gates the first event.
   * The pointer-up sample can itself be the gesture's first nonzero delta
   * (pointerdown followed directly by a displaced pointerup, with no
   * pointermove delivered in between), so onResizeEnd only ignores zero-delta
   * ends of gestures that never moved.
   */
  function handleResizeStart(): void {
    startHeight = Math.round(dockElement?.getBoundingClientRect().height ?? measuredHeight);
    lastReportedHeight = null;
    gestureResized = false;
  }

  function applyUserHeight(next: string): void {
    if (next === lastReportedHeight) return;
    lastReportedHeight = next;
    onHeightChange?.(next);
    if (height === undefined) internalHeight = next;
  }

  function reportResize(event: SplitResizeEvent): void {
    ownResizePending = true;
    if (ownResizeResetFrame !== null) cancelAnimationFrame(ownResizeResetFrame);
    /* Keep the marker through ResizeObserver delivery, which may follow the next animation frame. */
    ownResizeResetFrame = requestAnimationFrame(() => {
      ownResizeResetFrame = requestAnimationFrame(() => {
        ownResizePending = false;
        ownResizeResetFrame = null;
        if (suppressedContextResize) {
          suppressedContextResize = false;
          scheduleConstraintRefresh?.();
        }
      });
    });
    applyUserHeight(`${Math.max(0, startHeight - event.delta)}px`);
  }

  function handleResize(event: SplitResizeEvent): void {
    if (!gestureResized && event.delta === 0) return;
    gestureResized = true;
    reportResize(event);
  }

  function handleResizeEnd(event: SplitResizeEvent): void {
    if (!gestureResized && event.delta === 0) return;
    reportResize(event);
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
      onResizeEnd={handleResizeEnd}
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
