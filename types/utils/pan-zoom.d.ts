export interface PanZoom {
    /** Back to scale 1, no offset. */
    reset: () => void;
    /** Remove the listeners (the transform is left as is). */
    destroy: () => void;
}
export declare function attachPanZoom(viewport: HTMLElement, pan: HTMLElement): PanZoom;
