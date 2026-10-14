/**
 * Pure windowing math for VirtualList — separated so the slice logic is
 * unit-testable without a DOM. One O(count) pass per call; at the list
 * sizes this library targets (tens of thousands of rows) that is well
 * under a millisecond and beats maintaining an incremental prefix tree.
 * Uniform-height lists skip the pass entirely via `fixedHeight`.
 */
export interface VirtualSliceInput {
    /** Scroll offset of the viewport within the list. */
    scrollTop: number;
    /** Viewport height in px. */
    viewport: number;
    /** Total row count. */
    count: number;
    /** Extra rows rendered on each side of the visible range. */
    overscan?: number;
    /** Height of row `index` in px (fixed value, measurement, or estimate). */
    heightOf: (index: number) => number;
    /** Uniform row height in px (must be > 0). When the caller can
     * guarantee every row is exactly this tall the slice is computed in
     * O(1) and `heightOf` is never called. */
    fixedHeight?: number;
}
export interface VirtualSlice {
    /** First rendered row (inclusive). */
    start: number;
    /** One past the last rendered row (exclusive). */
    end: number;
    /** Offset of row `start` from the top of the list, in px. */
    topPad: number;
    /** Height of the entire list, in px. */
    totalHeight: number;
}
export declare function virtualSlice({ scrollTop, viewport, count, overscan, heightOf, fixedHeight, }: VirtualSliceInput): VirtualSlice;
/** Offset of a row's top edge from the top of the list. `fixedHeight`
 * carries the same uniform-height contract as in {@link VirtualSliceInput}. */
export declare function offsetOfIndex(index: number, count: number, heightOf: (index: number) => number, fixedHeight?: number): number;
/** A box's vertical extent in viewport coordinates. */
export interface VerticalBounds {
    top: number;
    bottom: number;
}
/** Scroll offset and viewport height of a list body, in the body's own
 * coordinates, for virtualizing a list that does not own its scroll
 * container (VirtualTable). `bodyTop` is the body's top edge and `view` the
 * scroller's visible area (its client box, or the window for the document),
 * both in viewport coordinates. The result feeds {@link virtualSlice}. */
export declare function visibleWindow(bodyTop: number, view: VerticalBounds): {
    scrollTop: number;
    viewport: number;
};
/** The element that scrolls `el` vertically: its nearest ancestor with
 * `overflow-y` auto, scroll, or overlay, or the document's scrolling element
 * when none is. Used for tables whose rows the page scrolls. */
export declare function scrollerOf(el: Element): HTMLElement;
