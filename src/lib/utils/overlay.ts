/*
 * Shared overlay-dialog wiring for full-screen surfaces (Modal,
 * DetailDrawer, CommandPalette) and the Escape stack they share with
 * popovers. Positioning/chrome stay with the components.
 */

/**
 * Close on a press that starts and ends on the backdrop element itself
 * (not a child). An attachment: `{@attach backdropCloses(close)}`.
 *
 * A press that starts in the panel and ends on the backdrop (a text
 * selection drag), or starts on the backdrop and ends in the panel, does
 * not dismiss. The release is hit-tested, since touch pointer capture can
 * report the backdrop as the target wherever the finger lifts. Closing
 * waits for the press's click: on touch the browser sends it after the
 * finger lifts, and if the backdrop were already gone the click would
 * land on whatever page control is underneath and activate it.
 */
export function backdropCloses(close: () => void): (backdrop: HTMLElement) => () => void {
  return (backdrop) => {
    let pointerId: number | null = null;
    let released = false;
    const onPointerDown = (event: PointerEvent) => {
      pointerId = event.target === backdrop ? event.pointerId : null;
      released = false;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      released = releaseTarget(event) === backdrop;
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      released = false;
    };
    const onClick = (event: MouseEvent) => {
      const dismiss = released && event.target === backdrop;
      released = false;
      if (dismiss) close();
    };
    backdrop.addEventListener("pointerdown", onPointerDown);
    // Window, so the release is seen wherever it lands.
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    backdrop.addEventListener("click", onClick);
    return () => {
      backdrop.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      backdrop.removeEventListener("click", onClick);
    };
  };
}

/** The element under a pointer release. A release off-screen hits
 * nothing (null). Without layout (jsdom) there is no real hit test: the
 * API is missing, or a test stub returns null for every point. A browser
 * returns null only outside the viewport, so a null inside it means no
 * layout, and the event target is the best answer. */
function releaseTarget(event: PointerEvent): EventTarget | null {
  if (typeof document.elementFromPoint !== "function") return event.target;
  const { clientX: x, clientY: y } = event;
  const hit = document.elementFromPoint(x, y);
  const inViewport = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
  return hit === null && inViewport ? event.target : hit;
}

// Every open layer, oldest first: overlays (Modal, DetailDrawer) and
// popovers (dismissable) alike. One document listener hands Escape to the
// newest, so a dialog opened over a drawer or a dropdown closes before them,
// wherever it sits in the markup.
const layers: { onEscape: () => void; element: Element | null }[] = [];

function handleEscape(event: KeyboardEvent): void {
  // A handler nearer the focus already used the key: a search field
  // clearing itself, a list closing its own menu.
  if (event.key !== "Escape" || event.defaultPrevented) return;
  // An input method uses Escape to cancel its candidate list. Safari ends
  // the composition first and sends the key with isComposing false but the
  // IME keyCode 229.
  if (event.isComposing || event.keyCode === 229) return;
  const top = layers.at(-1);
  if (!top) return;
  // Claimed, so app shortcuts on window leave it alone.
  event.preventDefault();
  top.onEscape();
}

/**
 * Open a layer that Escape closes. Escape goes only to the layer opened
 * last, one per press. Returns the function that removes the layer; call it
 * from an `$effect` or an attachment so the layer lives while the surface
 * is mounted: `{@attach (node) => escapeLayer(close, node)}`.
 *
 * `element` is the layer's outermost element. Svelte mounts a child before
 * its parent, so a dialog that opens already holding an open dialog would
 * otherwise land beneath it; a layer goes below any open layer inside its
 * element instead.
 */
export function escapeLayer(onEscape: () => void, element: Element | null = null): () => void {
  const layer = { onEscape, element };
  if (layers.length === 0) document.addEventListener("keydown", handleEscape);
  const inside = element
    ? layers.findIndex((other) => other.element && element.contains(other.element))
    : -1;
  if (inside === -1) layers.push(layer);
  else layers.splice(inside, 0, layer);
  return () => {
    const index = layers.indexOf(layer);
    if (index !== -1) layers.splice(index, 1);
    if (layers.length === 0) document.removeEventListener("keydown", handleEscape);
  };
}
