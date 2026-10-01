/*
 * Drag-to-pan, cursor-anchored wheel zoom (which also covers trackpad
 * pinch), two-finger touch pinch, and double-tap (or double-click) zoom
 * for a viewport
 * element and the transformed element inside it. Shared by the inline
 * Mermaid viewer (imperative DOM) and MediaViewer (as a Svelte attachment
 * body).
 *
 * The pan element is transformed with `translate() scale()` around its
 * center; the viewport clips it and receives the pointer and wheel events.
 * While zoomed the viewport carries `data-zoomed`, so CSS can hand
 * touch-action back to the page only at scale 1.
 */

const MIN_SCALE = 0.4;
const MAX_SCALE = 8;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;
const DOUBLE_TAP_SCALE = 2.5;
// A tap never moves TAP_SLOP px from its start and lasts under TAP_MS;
// a second tap
// within DOUBLE_TAP_MS and DOUBLE_TAP_SLOP px of the first is a double tap.
const TAP_SLOP = 10;
const TAP_MS = 300;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;
// A swipe travels at least SWIPE_MIN px, mostly horizontally.
const SWIPE_MIN = 50;
const SWIPE_AXIS_RATIO = 1.5;

export interface PanZoomOptions {
  /** One-finger touch or pen swipe at scale 1 (not mouse drags): 1 when
   * the finger moved left (show the next item), -1 when it moved right. */
  onSwipe?: (direction: 1 | -1) => void;
}

export interface PanZoom {
  /** Back to scale 1, no offset. */
  reset: () => void;
  /** Remove the listeners (the transform is left as is). */
  destroy: () => void;
}

export function attachPanZoom(
  viewport: HTMLElement,
  pan: HTMLElement,
  options: PanZoomOptions = {},
): PanZoom {
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  // Active pointers by id, at their last seen position. One pointer
  // drags; two pinch (zoom around their midpoint) and pan together.
  const pointers = new Map<number, { x: number; y: number }>();
  // The touch or pen gesture in progress, from its first pointer down to
  // its last pointer up, with the view it started from; `multi` once a
  // second finger joined, `moved` once it left the tap slop.
  let gesture: {
    x: number;
    y: number;
    time: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    multi: boolean;
    moved: boolean;
  } | null = null;
  let lastTap: { x: number; y: number; time: number } | null = null;
  // When the pointer path last handled a double tap, so the dblclick the
  // browser may send for the same taps is not handled again.
  let doubleTapTime = -Infinity;

  const updateTransform = () => {
    pan.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${formatScale(scale)})`;
    if (atRest(scale)) delete viewport.dataset.zoomed;
    else viewport.dataset.zoomed = "true";
  };

  const reset = () => {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
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
    if (event.pointerType !== "mouse") {
      if (pointers.size === 0) {
        gesture = {
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
          scale,
          offsetX,
          offsetY,
          multi: false,
          moved: false,
        };
      } else if (gesture) {
        gesture.multi = true;
        lastTap = null;
      }
    }
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
    if (gesture && !gesture.moved && distance(next, gesture) >= TAP_SLOP) gesture.moved = true;
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
    try {
      viewport.releasePointerCapture?.(event.pointerId);
    } catch {
      // Already released.
    }
    if (event.type === "pointercancel" && gesture) {
      // The browser took the gesture (e.g. to scroll the page past an
      // inline diagram): undo what its first moves did, and it is no tap.
      scale = gesture.scale;
      offsetX = gesture.offsetX;
      offsetY = gesture.offsetY;
      updateTransform();
      gesture = null;
      lastTap = null;
    }
    if (pointers.size > 0) return;
    delete viewport.dataset.panning;
    // A pinch out and back ends a hair off 1: settle it at exactly 1.
    if (atRest(scale) && scale !== 1) {
      scale = 1;
      updateTransform();
    }
    const ended = gesture;
    gesture = null;
    if (!ended) return;
    if (ended.multi) {
      lastTap = null;
      return;
    }
    endTouchGesture(ended, event);
  };

  const endTouchGesture = (start: NonNullable<typeof gesture>, event: PointerEvent) => {
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (
      options.onSwipe &&
      atRest(start.scale) &&
      Math.abs(dx) >= SWIPE_MIN &&
      Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO
    ) {
      lastTap = null;
      options.onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (start.moved || Math.hypot(dx, dy) >= TAP_SLOP || event.timeStamp - start.time >= TAP_MS) {
      lastTap = null;
      return;
    }
    const tap = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    if (
      lastTap &&
      tap.time - lastTap.time < DOUBLE_TAP_MS &&
      distance(tap, lastTap) < DOUBLE_TAP_SLOP
    ) {
      lastTap = null;
      doubleTapTime = event.timeStamp;
      toggleZoom(tap.x, tap.y);
      return;
    }
    lastTap = tap;
  };

  /** Zoomed: back to the whole view. At scale 1: zoom in on the point. */
  const toggleZoom = (x: number, y: number) => {
    if (!atRest(scale)) {
      reset();
    } else {
      const origin = fromCenter(x, y);
      zoomTo(DOUBLE_TAP_SCALE, origin.x, origin.y);
    }
  };

  // iOS Safari sends pointer events for only the first tap of a double
  // tap; the second arrives as clicks and a dblclick. A mouse double-click
  // lands here too.
  const onDoubleClick = (event: MouseEvent) => {
    lastTap = null;
    if (event.timeStamp - doubleTapTime < DOUBLE_TAP_MS * 2) return;
    toggleZoom(event.clientX, event.clientY);
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

  viewport.addEventListener("dblclick", onDoubleClick);
  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  updateTransform();

  return {
    reset,
    destroy() {
      viewport.removeEventListener("dblclick", onDoubleClick);
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

// Scale keeps full precision: a pinch or slow wheel arrives as many tiny
// ratios, and rounding or snapping each step would discard them. Only the
// CSS value is rounded.
function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/** Unzoomed for paging, page scroll, and double tap: within 0.1% of 1,
 * so float residue from a pinch out and back does not count as zoom. */
function atRest(value: number): boolean {
  return Math.abs(value - 1) < 0.001;
}

function formatScale(value: number): string {
  return Number(value.toFixed(4)).toString();
}
