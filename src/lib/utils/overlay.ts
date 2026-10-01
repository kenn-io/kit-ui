/*
 * Shared overlay-dialog wiring for full-screen surfaces (Modal,
 * DetailDrawer, CommandPalette). The backdrop handlers were byte-identical
 * copies; the Escape handlers had drifted into three behaviors — this
 * settles both once. Positioning/chrome stay with the components.
 */

/**
 * Close on a click that both starts and ends on the backdrop element
 * itself (not a child). An attachment: `{@attach backdropCloses(close)}`.
 *
 * A press that starts in the panel and ends on the backdrop (a text
 * selection drag) does not dismiss. Closing on the click, not on the
 * press, matters on touch: the browser sends a tap's click after the
 * finger lifts, and if the backdrop were already gone the click would
 * land on whatever page control is underneath and activate it.
 */
export function backdropCloses(close: () => void): (backdrop: HTMLElement) => () => void {
  return (backdrop) => {
    let pressed = false;
    const onPointerDown = (event: PointerEvent) => {
      pressed = event.target === backdrop;
    };
    const onClick = (event: MouseEvent) => {
      const wasPressed = pressed;
      pressed = false;
      if (wasPressed && event.target === backdrop) close();
    };
    backdrop.addEventListener("pointerdown", onPointerDown);
    backdrop.addEventListener("click", onClick);
    return () => {
      backdrop.removeEventListener("pointerdown", onPointerDown);
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
