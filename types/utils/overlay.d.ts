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
export declare function backdropCloses(close: () => void): (backdrop: HTMLElement) => () => void;
/**
 * Escape closes one layer at a time: an inner surface that already handled
 * the key (a popover's dismissable(), a search field clearing itself)
 * calls preventDefault, and this respects it — so Escape peels the top
 * layer instead of collapsing the whole stack. Wire on `svelte:window`.
 */
export declare function escapeCloses(close: () => void): (event: KeyboardEvent) => void;
