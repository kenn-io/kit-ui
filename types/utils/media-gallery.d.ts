export type MediaViewerItem = {
    kind: "image";
    src: string;
    alt: string;
} | {
    kind: "element";
    /** Cloned into the viewer on display; the original stays in place. */
    element: Element;
    /** Accessible name for the expanded view. */
    label: string;
    /** Extra class on the viewer's content wrapper (content-specific
     * global styles, e.g. Mermaid edge labels). */
    class?: string;
    /** Panel background (any CSS color) behind this item. */
    background?: string;
};
export interface MediaViewerLabels {
    closeLabel?: string;
    resetLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
}
export interface OpenMediaViewerOptions extends MediaViewerLabels {
    /** Suspend app-level keyboard handling while the viewer is open;
     * returns the restore function called on close. Defaults to pushing a
     * "kit-media-viewer" scope on `appShortcuts`. Apps with their own
     * shortcut manager or modal stack hook in here. */
    onViewerOpen?: () => () => void;
    /** Called after the viewer closes, however it was closed. */
    onClose?: () => void;
}
/** Mark `element` as an expandable gallery entry. `item` is called at
 * open time, so it can describe the element's current content. */
export declare function registerMediaViewerItem(element: Element, item: () => MediaViewerItem): void;
export declare function unregisterMediaViewerItem(element: Element): void;
/** The eligible registered elements, in document order, for a viewer
 * opened from `origin`. `origin` itself is always included. */
export declare function collectMediaViewerGallery(origin: Element): Element[];
/** Open MediaViewer on `origin`, paging through the page's other
 * eligible items. Replaces any viewer that is already open. Resolves to
 * a function that closes this viewer (a no-op once it has closed). */
export declare function openMediaViewerGallery(origin: Element, options?: OpenMediaViewerOptions): Promise<() => void>;
/** Close the open gallery viewer, if any (e.g. before content it shows
 * is re-rendered). */
export declare function closeMediaViewerGallery(): void;
