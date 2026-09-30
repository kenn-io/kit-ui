/*
 * Drag-to-pan, cursor-anchored wheel zoom (which also covers trackpad
 * pinch), and two-finger touch pinch for a viewport element and the
 * transformed element inside it. Shared by the inline Mermaid viewer
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
  // Active pointers by id, at their last seen position. One pointer
  // drags; two pinch (zoom around their midpoint) and pan together.
  const pointers = new Map<number, { x: number; y: number }>();

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

  /** Viewport-center-relative coordinates, the origin zoomTo expects. */
  const fromCenter = (x: number, y: number) => {
    const rect = viewport.getBoundingClientRect();
    return { x: x - rect.left - rect.width / 2, y: y - rect.top - rect.height / 2 };
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (pointers.size >= 2) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.dataset.panning = "true";
    try {
      viewport.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic or already-released pointers can't be captured.
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    if (pointers.size === 1) {
      offsetX += next.x - previous.x;
      offsetY += next.y - previous.y;
      pointers.set(event.pointerId, next);
      updateTransform();
      return;
    }
    const other = Array.from(pointers.entries()).find(([id]) => id !== event.pointerId)?.[1];
    if (!other) return;
    const before = { distance: distance(previous, other), mid: midpoint(previous, other) };
    const after = { distance: distance(next, other), mid: midpoint(next, other) };
    pointers.set(event.pointerId, next);
    // Follow the fingers' midpoint, then scale around it.
    offsetX += after.mid.x - before.mid.x;
    offsetY += after.mid.y - before.mid.y;
    updateTransform();
    if (before.distance > 0) {
      const origin = fromCenter(after.mid.x, after.mid.y);
      zoomTo(scale * (after.distance / before.distance), origin.x, origin.y);
    }
  };

  const endPointer = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size === 0) delete viewport.dataset.panning;
    try {
      viewport.releasePointerCapture?.(event.pointerId);
    } catch {
      // Already released.
    }
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const origin = fromCenter(event.clientX, event.clientY);
    zoomTo(
      scale * Math.exp(-normalizeWheelDelta(event, viewport) * WHEEL_ZOOM_SENSITIVITY),
      origin.x,
      origin.y,
    );
  };

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
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
      viewport.removeEventListener("pointerup", endPointer);
      viewport.removeEventListener("pointercancel", endPointer);
      viewport.removeEventListener("wheel", onWheel);
    },
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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
