export interface PanZoomView {
    scale: number;
    /** CSS pixel offsets from the viewport center. */
    offsetX: number;
    offsetY: number;
}
export interface PanZoomOptions {
    /** One-finger touch or pen swipe at scale 1 (not mouse drags): 1 when
     * the finger moved left (show the next item), -1 when it moved right. */
    onSwipe?: (direction: 1 | -1) => void;
    /** Changed gesture input, settling, and cancellation report the completed view.
     * reset() always reports, even at identity; construction and setView are silent. */
    onChange?: (view: PanZoomView) => void;
    /** Minimum scale, above 0 and at most 1. Defaults to 0.4 for invalid values. */
    minScale?: number;
    /** Maximum scale, at least 1. Defaults to 8 for invalid values. */
    maxScale?: number;
}
export interface PanZoom {
    /** A detached copy of the current view. */
    getView: () => PanZoomView;
    /** Apply a view silently. Invalid views are ignored; scale is clamped. */
    setView: (view: PanZoomView) => void;
    /** Back to scale 1, no offset. */
    reset: () => void;
    /** Remove the listeners (the transform is left as is). */
    destroy: () => void;
}
export declare function attachPanZoom(viewport: HTMLElement, pan: HTMLElement, options?: PanZoomOptions): PanZoom;
