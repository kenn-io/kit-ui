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

export interface PanZoomView {
  scale: number;
  /** CSS pixel offsets from the viewport center. */
  offsetX: number;
  offsetY: number;
}

export interface PanZoomOptions {
  /** One-finger touch or pen swipe at scale 1 (not mouse drags): 1 when
   * the finger moved left (show the next item), -1 when it moved right. */
  onSwipe?: (direction: 1 | -1) => void;
  /** Each changed gesture input, settle, cancellation, and reset reports
   * its completed view; construction and setView do not. */
  onChange?: (view: PanZoomView) => void;
  /** Minimum scale, above 0 and at most 1. Defaults to 0.4 for invalid values. */
  minScale?: number;
  /** Maximum scale, at least 1. Defaults to 8 for invalid values. */
  maxScale?: number;
}

export interface PanZoom {
  /** A detached copy of the current view. */
  getView: () => PanZoomView;
  /** Apply a view silently. Invalid views are ignored; scale is clamped. */
  setView: (view: PanZoomView) => void;
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
  const requestedMin = options.minScale ?? MIN_SCALE;
  const minScale =
    Number.isFinite(requestedMin) && requestedMin > 0 && requestedMin <= 1
      ? requestedMin
      : MIN_SCALE;
  const requestedMax = options.maxScale ?? MAX_SCALE;
  const maxScale = Number.isFinite(requestedMax) && requestedMax >= 1 ? requestedMax : MAX_SCALE;
  // Scale keeps full precision: a pinch or slow wheel arrives as many tiny
  // ratios, and rounding each step would discard them. CSS gets the same
  // precision, so exact image sizing survives.
  const clamp = (value: number) => Math.min(maxScale, Math.max(minScale, value));
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
    swipeEligible: boolean;
  } | null = null;
  let lastTap: { x: number; y: number; time: number } | null = null;
  // When the pointer path last handled a double tap, so the dblclick the
  // browser may send for the same taps is not handled again.
  let doubleTapTime = -Infinity;

  const getView = (): PanZoomView => ({ scale, offsetX, offsetY });

  const updateTransform = (notify = true) => {
    pan.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    if (atRest(scale)) delete viewport.dataset["zoomed"];
    else viewport.dataset["zoomed"] = "true";
    if (notify) options.onChange?.(getView());
  };

  /** Apply a view from outside the gesture. A changed view also becomes
   * the active touch gesture's cancellation destination, so only later
   * movement rolls back; an equal echo leaves the destination alone. */
  const apply = (view: PanZoomView): boolean => {
    if (view.scale === scale && view.offsetX === offsetX && view.offsetY === offsetY) return false;
    ({ scale, offsetX, offsetY } = view);
    if (gesture) {
      Object.assign(gesture, view);
      if (!atRest(scale)) gesture.swipeEligible = false;
    }
    return true;
  };

  const setView = (view: PanZoomView) => {
    if (
      !Number.isFinite(view.scale) ||
      view.scale <= 0 ||
      !Number.isFinite(view.offsetX) ||
      !Number.isFinite(view.offsetY)
    )
      return;
    if (apply({ scale: clamp(view.scale), offsetX: view.offsetX, offsetY: view.offsetY }))
      updateTransform(false);
  };

  const reset = () => {
    apply({ scale: 1, offsetX: 0, offsetY: 0 });
    updateTransform();
  };

  /** Scale around a viewport-center-relative origin without committing. */
  const scaleAround = (nextScale: number, originX: number, originY: number): boolean => {
    nextScale = clamp(nextScale);
    if (nextScale === scale) return false;
    const scaleRatio = nextScale / scale;
    offsetX = originX - (originX - offsetX) * scaleRatio;
    offsetY = originY - (originY - offsetY) * scaleRatio;
    scale = nextScale;
    return true;
  };

  const zoomTo = (nextScale: number, originX: number, originY: number) => {
    if (scaleAround(nextScale, originX, originY)) updateTransform();
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
          swipeEligible: atRest(scale),
        };
      } else if (gesture) {
        gesture.multi = true;
        lastTap = null;
      }
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.dataset["panning"] = "true";
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
      pointers.set(event.pointerId, next);
      if (next.x === previous.x && next.y === previous.y) return;
      offsetX += next.x - previous.x;
      offsetY += next.y - previous.y;
      updateTransform();
      return;
    }
    const other = Array.from(pointers.entries()).find(([id]) => id !== event.pointerId)?.[1];
    if (!other) return;
    const before = { distance: distance(previous, other), mid: midpoint(previous, other) };
    const after = { distance: distance(next, other), mid: midpoint(next, other) };
    pointers.set(event.pointerId, next);
    // Follow the fingers' midpoint, then scale around it, and commit both
    // as one view. A pinch clamped at a limit still pans.
    const panned = after.mid.x !== before.mid.x || after.mid.y !== before.mid.y;
    offsetX += after.mid.x - before.mid.x;
    offsetY += after.mid.y - before.mid.y;
    const origin = fromCenter(after.mid.x, after.mid.y);
    const zoomed =
      before.distance > 0 &&
      scaleAround(scale * (after.distance / before.distance), origin.x, origin.y);
    if (panned || zoomed) updateTransform();
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
      const start = gesture;
      gesture = null;
      if (start.scale !== scale || start.offsetX !== offsetX || start.offsetY !== offsetY) {
        ({ scale, offsetX, offsetY } = start);
        updateTransform();
      }
      lastTap = null;
    }
    if (pointers.size > 0) return;
    delete viewport.dataset["panning"];
    // A pinch out and back ends a hair off 1: settle it at exactly 1. Drags
    // keep whatever scale they started from, such as exact image sizing.
    if (gesture?.multi && scale !== gesture.scale && atRest(scale) && scale !== 1) {
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
      start.swipeEligible &&
      atRest(scale) &&
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
  updateTransform(false);

  return {
    getView,
    setView,
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

/** Unzoomed for paging, page scroll, and double tap: within 0.1% of 1,
 * so float residue from a pinch out and back does not count as zoom. */
function atRest(value: number): boolean {
  return Math.abs(value - 1) < 0.001;
}
