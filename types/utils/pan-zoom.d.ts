export interface PanZoomView {
    scale: number;
    /** CSS pixel offsets from the viewport center. */
    offsetX: number;
    offsetY: number;
}
export interface PanZoomLimits {
    /** Minimum scale, above 0 and at most 1. Defaults to 0.4 for invalid values. */
    minScale?: number;
    /** Maximum scale, at least 1. Defaults to 8 for invalid values. */
    maxScale?: number;
}
/** Contained image sizing, after load, using positive fractional CSS box dimensions.
 * Rotation is a multiple of 90 degrees; dpr is physical pixels per CSS pixel. */
export declare function actualPixelSize(image: {
    width: number;
    height: number;
}, box: {
    width: number;
    height: number;
}, dpr: number, rotation?: number): {
    fittedWidth: number;
    scale: number;
};
export interface PanZoomOptions extends PanZoomLimits {
    /** One-finger touch or pen swipe at scale 1 (not mouse drags): 1 when
     * the finger moved left (show the next item), -1 when it moved right. */
    onSwipe?: (direction: 1 | -1) => void;
    /** Changed gesture input, settling, and cancellation report the completed view.
     * reset() always reports, even at identity; construction and setView are silent. */
    onChange?: (view: PanZoomView) => void;
}
export interface PanZoom {
    /** A detached copy of the current view. */
    getView: () => PanZoomView;
    /** Apply a view silently. Invalid views are ignored; scale is clamped. */
    setView: (view: PanZoomView) => void;
    /** Replace limits silently, clamping the current view while retaining active gestures. */
    setLimits: (limits: PanZoomLimits) => void;
    /** Back to scale 1, no offset. */
    reset: () => void;
    /** Remove the listeners (the transform is left as is). */
    destroy: () => void;
}
export declare function attachPanZoom(viewport: HTMLElement, pan: HTMLElement, options?: PanZoomOptions): PanZoom;
