/*
 * Shared overlay-dialog wiring for full-screen surfaces (Modal,
 * DetailDrawer, CommandPalette). The backdrop handlers were byte-identical
 * copies; the Escape handlers had drifted into three behaviors — this
 * settles both once. Positioning/chrome stay with the components.
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
      // Without layout (jsdom) there is no hit test; trust the target. A
      // release off-screen hits nothing (null) and does not count.
      const hit =
        typeof document.elementFromPoint === "function"
          ? document.elementFromPoint(event.clientX, event.clientY)
          : event.target;
      released = hit === backdrop;
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

/**
 * Escape closes one layer at a time: an inner surface that already handled
 * the key (a popover's dismissable(), a search field clearing itself)
 * calls preventDefault, and this respects it — so Escape peels the top
 * layer instead of collapsing the whole stack. Wire on `svelte:window`.
 */
export function escapeCloses(close: () => void): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    close();
  };
}
