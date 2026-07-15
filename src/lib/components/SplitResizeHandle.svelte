<script lang="ts">
  import { onDestroy } from "svelte";
  import type { SplitResizeEvent, SplitResizeOrientation } from "./split-resize.js";

  interface Props {
    ariaLabel: string;
    /** Direction in which the two panes are arranged. */
    orientation?: SplitResizeOrientation;
    class?: string;
    disabled?: boolean;
    /** Pixels moved per arrow-key press. */
    keyboardStep?: number;
    ariaValueMin: number;
    ariaValueMax: number;
    ariaValueNow: number;
    onResizeStart?: (event: KeyboardEvent | PointerEvent) => void;
    onResize?: (event: SplitResizeEvent) => void;
    onResizeEnd?: (event: SplitResizeEvent) => void;
  }

  let {
    ariaLabel,
    orientation = "horizontal",
    class: className = "",
    disabled = false,
    keyboardStep = 24,
    ariaValueMin,
    ariaValueMax,
    ariaValueNow,
    onResizeStart,
    onResize,
    onResizeEnd,
  }: Props = $props();

  let cleanup: (() => void) | null = null;

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
  }

  function startResize(event: PointerEvent): void {
    if (disabled || cleanup) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLButtonElement;
    const resizeOrientation = orientation;
    const start = position(event, resizeOrientation);
    const pointerId = event.pointerId;
    let lastResizeEvent = resizeEventFromPointer(event, start, resizeOrientation);
    handle.setPointerCapture(pointerId);

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

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    cleanup = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
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
  class={["kit-split-resize-handle", `kit-split-resize-handle--${orientation}`, className]
    .filter(Boolean)
    .join(" ")}
  type="button"
  role="separator"
  aria-label={ariaLabel}
  aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
  aria-valuemin={ariaValueMin}
  aria-valuemax={ariaValueMax}
  aria-valuenow={ariaValueNow}
  {disabled}
  onkeydown={handleKeydown}
  onpointerdown={startResize}
></button>

<style>
  .kit-split-resize-handle {
    background: var(--border-muted);
    appearance: none;
    border: 0;
    padding: 0;
    flex-shrink: 0;
  }

  .kit-split-resize-handle--horizontal {
    width: 4px;
    cursor: col-resize;
    touch-action: pan-y;
  }

  .kit-split-resize-handle--vertical {
    height: 4px;
    cursor: row-resize;
    touch-action: pan-x;
  }

  .kit-split-resize-handle:hover,
  .kit-split-resize-handle:focus-visible {
    background: var(--accent-blue);
  }

  .kit-split-resize-handle:disabled {
    cursor: default;
    opacity: 0.6;
  }
</style>
