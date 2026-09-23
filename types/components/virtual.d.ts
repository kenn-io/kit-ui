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
