export interface PanZoomOptions {
    /** One-finger touch or pen swipe at scale 1 (not mouse drags): 1 when
     * the finger moved left (show the next item), -1 when it moved right. */
    onSwipe?: (direction: 1 | -1) => void;
}
export interface PanZoom {
    /** Back to scale 1, no offset. */
    reset: () => void;
    /** Remove the listeners (the transform is left as is). */
    destroy: () => void;
}
export declare function attachPanZoom(viewport: HTMLElement, pan: HTMLElement, options?: PanZoomOptions): PanZoom;
