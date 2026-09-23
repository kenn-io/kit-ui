/**
 * Close when the press starts on the backdrop element itself (not on a
 * child). Wire as the backdrop's `onpointerdown` — press semantics, so a
 * drag that merely ends on the backdrop doesn't dismiss.
 */
export declare function backdropCloses(close: () => void): (event: Event) => void;
/**
 * Escape closes one layer at a time: an inner surface that already handled
 * the key (a popover's dismissable(), a search field clearing itself)
 * calls preventDefault, and this respects it — so Escape peels the top
 * layer instead of collapsing the whole stack. Wire on `svelte:window`.
 */
export declare function escapeCloses(close: () => void): (event: KeyboardEvent) => void;
