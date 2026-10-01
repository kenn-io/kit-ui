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
export declare function backdropCloses(close: () => void): (backdrop: HTMLElement) => () => void;
/**
 * Escape closes one layer at a time: an inner surface that already handled
 * the key (a popover's dismissable(), a search field clearing itself)
 * calls preventDefault, and this respects it — so Escape peels the top
 * layer instead of collapsing the whole stack. Wire on `svelte:window`.
 */
export declare function escapeCloses(close: () => void): (event: KeyboardEvent) => void;
