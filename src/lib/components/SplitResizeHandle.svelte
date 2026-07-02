<script lang="ts">
  import { onDestroy } from "svelte";
  import type { SplitResizeEvent } from "./split-resize.js";

  interface Props {
    ariaLabel: string;
    class?: string;
    /** Pixels moved per arrow-key press. */
    keyboardStep?: number;
    onResizeStart?: (event: KeyboardEvent | MouseEvent) => void;
    onResize?: (event: SplitResizeEvent) => void;
    onResizeEnd?: (event: SplitResizeEvent) => void;
  }

  let {
    ariaLabel,
    class: className = "",
    keyboardStep = 24,
    onResizeStart,
    onResize,
    onResizeEnd,
  }: Props = $props();

  let cleanup: (() => void) | null = null;

  function resizeEventFromMouse(event: MouseEvent, startX: number): SplitResizeEvent {
    return {
      deltaX: event.clientX - startX,
      startX,
      currentX: event.clientX,
      event,
    };
  }

  function stopResize(): void {
    cleanup?.();
    cleanup = null;
  }

  function startResize(event: MouseEvent): void {
    event.preventDefault();
    stopResize();
    const startX = event.clientX;

    onResizeStart?.(event);

    function onMove(moveEvent: MouseEvent): void {
      onResize?.(resizeEventFromMouse(moveEvent, startX));
    }

    function onUp(upEvent: MouseEvent): void {
      onResizeEnd?.(resizeEventFromMouse(upEvent, startX));
      stopResize();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const deltaX = event.key === "ArrowLeft" ? -keyboardStep : keyboardStep;
    const resizeEvent: SplitResizeEvent = {
      deltaX,
      startX: 0,
      currentX: deltaX,
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

<button
  class={["kit-split-resize-handle", className].filter(Boolean).join(" ")}
  type="button"
  aria-label={ariaLabel}
  onkeydown={handleKeydown}
  onmousedown={startResize}
></button>

<style>
  .kit-split-resize-handle {
    width: 4px;
    cursor: col-resize;
    background: var(--border-muted);
    appearance: none;
    border: 0;
    padding: 0;
    flex-shrink: 0;
  }

  .kit-split-resize-handle:hover,
  .kit-split-resize-handle:focus-visible {
    background: var(--accent-blue);
  }

  .kit-split-resize-handle:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }
</style>
