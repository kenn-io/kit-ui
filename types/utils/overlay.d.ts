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
export declare function escapeLayer(onEscape: () => void, element?: Element | null): () => void;
