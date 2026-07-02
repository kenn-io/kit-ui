/*
 * Shared overlay-dialog wiring for full-screen surfaces (Modal,
 * DetailDrawer, CommandPalette). The backdrop handlers were byte-identical
 * copies; the Escape handlers had drifted into three behaviors — this
 * settles both once. Positioning/chrome stay with the components.
 */

/**
 * Close when the press starts on the backdrop element itself (not on a
 * child). Wire as the backdrop's `onpointerdown` — press semantics, so a
 * drag that merely ends on the backdrop doesn't dismiss.
 */
export function backdropCloses(close: () => void): (event: Event) => void {
  return (event) => {
    if (event.target === event.currentTarget) close();
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
