/*
 * Drag-to-pan and cursor-anchored wheel zoom for a viewport element and
 * the transformed element inside it. Shared by the inline Mermaid viewer
 * (imperative DOM) and MediaViewer (as a Svelte attachment body).
 *
 * The pan element is transformed with `translate() scale()` around its
 * center; the viewport clips it and receives the pointer and wheel events.
 */

const MIN_SCALE = 0.4;
const MAX_SCALE = 8;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;

export interface PanZoom {
  /** Back to scale 1, no offset. */
  reset: () => void;
  /** Remove the listeners (the transform is left as is). */
  destroy: () => void;
}

export function attachPanZoom(viewport: HTMLElement, pan: HTMLElement): PanZoom {
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let activeDrag: { pointerId: number; x: number; y: number } | null = null;

  const updateTransform = () => {
    pan.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${formatScale(scale)})`;
  };

  const zoomTo = (nextScale: number, originX: number, originY: number) => {
    nextScale = clampScale(nextScale);
    if (nextScale === scale) return;
    const scaleRatio = nextScale / scale;
    offsetX = originX - (originX - offsetX) * scaleRatio;
    offsetY = originY - (originY - offsetY) * scaleRatio;
    scale = nextScale;
    updateTransform();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    activeDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.dataset.panning = "true";
    viewport.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    offsetX += event.clientX - activeDrag.x;
    offsetY += event.clientY - activeDrag.y;
    activeDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    updateTransform();
  };

  const endDrag = (event: PointerEvent) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    activeDrag = null;
    delete viewport.dataset.panning;
    viewport.releasePointerCapture?.(event.pointerId);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = viewport.getBoundingClientRect();
    zoomTo(
      scale * Math.exp(-normalizeWheelDelta(event, viewport) * WHEEL_ZOOM_SENSITIVITY),
      event.clientX - rect.left - rect.width / 2,
      event.clientY - rect.top - rect.height / 2,
    );
  };

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  updateTransform();

  return {
    reset() {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
      updateTransform();
    },
    destroy() {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endDrag);
      viewport.removeEventListener("pointercancel", endDrag);
      viewport.removeEventListener("wheel", onWheel);
    },
  };
}

function normalizeWheelDelta(event: WheelEvent, viewport: HTMLElement): number {
  if (event.deltaMode === WHEEL_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WHEEL_DELTA_PAGE)
    return event.deltaY * (viewport.clientHeight || window.innerHeight || 800);
  return event.deltaY;
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

function formatScale(value: number): string {
  return Number(value.toFixed(2)).toString();
}
