<script lang="ts">
  import { onDestroy } from "svelte";
  import type { SplitResizeEvent, SplitResizeOrientation } from "./split-resize.js";

  interface Props {
    ariaLabel: string;
    /** Direction in which the two panes are arranged. */
    orientation?: SplitResizeOrientation;
    /** `column` draws a 1px line for resizing a table column; its pointer
     * target stays as easy to grab as a pane divider's. */
    variant?: "pane" | "column";
    disabled?: boolean;
    /** Pixels moved per arrow-key press. */
    keyboardStep?: number;
    ariaValueMin: number;
    ariaValueMax: number;
    ariaValueNow: number;
    /** Reads the value aloud in place of `ariaValueNow`, such as "Collapsed". */
    ariaValueText?: string;
    /** Called when someone presses Enter on the focused handle or
     * double-clicks it, for example to collapse or restore a pane. */
    onActivate?: (event: KeyboardEvent | MouseEvent) => void;
    onResizeStart?: (event: KeyboardEvent | PointerEvent) => void;
    onResize?: (event: SplitResizeEvent) => void;
    onResizeEnd?: (event: SplitResizeEvent) => void;
  }

  let {
    ariaLabel,
    orientation = "horizontal",
    variant = "pane",
    disabled = false,
    keyboardStep = 24,
    ariaValueMin,
    ariaValueMax,
    ariaValueNow,
    ariaValueText,
    onActivate,
    onResizeStart,
    onResize,
    onResizeEnd,
  }: Props = $props();

  let cleanup: (() => void) | null = null;
  let dragging = $state(false);

  function position(event: PointerEvent, resizeOrientation: SplitResizeOrientation): number {
    return resizeOrientation === "horizontal" ? event.clientX : event.clientY;
  }

  function resizeEventFromPointer(
    event: PointerEvent,
    start: number,
    resizeOrientation: SplitResizeOrientation,
  ): SplitResizeEvent {
    const current = position(event, resizeOrientation);
    return {
      orientation: resizeOrientation,
      delta: current - start,
      start,
      current,
      event,
    };
  }

  function stopResize(): void {
    cleanup?.();
    cleanup = null;
    dragging = false;
  }

  function startResize(event: PointerEvent): void {
    if (disabled || cleanup || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLButtonElement;
    const resizeOrientation = orientation;
    const start = position(event, resizeOrientation);
    const pointerId = event.pointerId;
    let lastResizeEvent = resizeEventFromPointer(event, start, resizeOrientation);
    handle.setPointerCapture(pointerId);
    dragging = true;

    onResizeStart?.(event);

    function onMove(moveEvent: PointerEvent): void {
      if (moveEvent.pointerId !== pointerId) return;
      lastResizeEvent = resizeEventFromPointer(moveEvent, start, resizeOrientation);
      onResize?.(lastResizeEvent);
    }

    function finish(endEvent: PointerEvent, cancelled: boolean): void {
      if (endEvent.pointerId !== pointerId) return;
      const finalResizeEvent = cancelled
        ? lastResizeEvent
        : resizeEventFromPointer(endEvent, start, resizeOrientation);
      onResizeEnd?.(finalResizeEvent);
      stopResize();
    }

    function onUp(upEvent: PointerEvent): void {
      finish(upEvent, false);
    }

    function onCancel(cancelEvent: PointerEvent): void {
      finish(cancelEvent, true);
    }

    function onLostPointerCapture(lostEvent: PointerEvent): void {
      finish(lostEvent, true);
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    handle.addEventListener("lostpointercapture", onLostPointerCapture);
    cleanup = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      handle.removeEventListener("lostpointercapture", onLostPointerCapture);
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    };
  }

  function keyboardDelta(event: KeyboardEvent): number | null {
    if (orientation === "horizontal") {
      if (event.key === "ArrowLeft") return -keyboardStep;
      if (event.key === "ArrowRight") return keyboardStep;
      return null;
    }
    if (event.key === "ArrowUp") return -keyboardStep;
    if (event.key === "ArrowDown") return keyboardStep;
    return null;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    if (event.key === "Enter" && onActivate) {
      // A button turns Enter into a click; the handle has no click action.
      event.preventDefault();
      onActivate(event);
      return;
    }
    const delta = keyboardDelta(event);
    if (delta === null) return;
    event.preventDefault();
    const resizeEvent: SplitResizeEvent = {
      orientation,
      delta,
      start: 0,
      current: delta,
      event,
    };
    onResizeStart?.(event);
    onResize?.(resizeEvent);
    onResizeEnd?.(resizeEvent);
  }

  onDestroy(() => {
    stopResize();
  });
</script>

<!-- A separator is an adjustable widget; the button supplies native focus and disabled semantics. -->
<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
<button
  class="kit-split-resize-handle kit-control-states kit-split-resize-handle--{orientation}"
  class:kit-split-resize-handle--column={variant === "column"}
  class:kit-split-resize-handle--dragging={dragging}
  type="button"
  role="separator"
  aria-label={ariaLabel}
  aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
  aria-valuemin={ariaValueMin}
  aria-valuemax={ariaValueMax}
  aria-valuenow={ariaValueNow}
  aria-valuetext={ariaValueText}
  {disabled}
  onkeydown={handleKeydown}
  onpointerdown={startResize}
  ondblclick={onActivate}
></button>

<style>
  /* Every split in every app has the same thickness: --split-handle-size from
     brand.json. There is deliberately no class prop, and the thickness is
     !important, so a consumer cannot restyle one handle; kit-ui-check's
     split-handle-override rule rejects the attempt. Consumers only place the
     handle (display, position, z-index). */
  .kit-split-resize-handle {
    --press-transform: none;

    position: relative;
    z-index: 1;
    background: var(--border-muted);
    appearance: none;
    border: 0;
    margin: 0;
    padding: 0;
    flex: none;
  }

  /* A thin line is hard to grab. Extend the pointer target 2px past both
     edges with a transparent pseudo-element; it hit-tests as the button but
     paints nothing, so the visible line keeps the token's thickness. */
  .kit-split-resize-handle::after {
    content: "";
    position: absolute;
    inset: 0 -2px;
  }

  .kit-split-resize-handle--horizontal {
    width: var(--split-handle-size) !important;
    min-width: var(--split-handle-size) !important;
    max-width: var(--split-handle-size) !important;
    cursor: col-resize;
    touch-action: pan-y;
  }

  .kit-split-resize-handle--vertical {
    height: var(--split-handle-size) !important;
    min-height: var(--split-handle-size) !important;
    max-height: var(--split-handle-size) !important;
    cursor: row-resize;
    touch-action: pan-x;
  }

  .kit-split-resize-handle--vertical::after {
    inset: -2px 0;
  }

  /* A drag keeps the line lit even when the pointer leaves it. */
  .kit-split-resize-handle:hover:not(:disabled),
  .kit-split-resize-handle:focus-visible,
  .kit-split-resize-handle--dragging {
    background: var(--accent-blue);
  }

  /* A table column's edge is a hairline next to the cell borders, not a
   * pane divider. The pointer target still reaches 4px past each side. */
  .kit-split-resize-handle--horizontal.kit-split-resize-handle--column {
    width: 1px !important;
    min-width: 1px !important;
    max-width: 1px !important;
  }

  .kit-split-resize-handle--horizontal.kit-split-resize-handle--column::after {
    inset: 0 -4px;
  }

  .kit-split-resize-handle:disabled {
    cursor: default;
    opacity: var(--opacity-disabled);
  }
</style>
