export type MediaViewerItem = {
    kind: "image";
    src: string;
    alt: string;
} | {
    kind: "element";
    /** Deep-cloned into the viewer on display; the original stays in
     * place. Suited to static markup such as an SVG diagram: a clone
     * keeps no event listeners, canvas pixels, shadow roots, or live
     * form/media state, and it repeats the original's ids. */
    element: Element;
    /** Accessible name for the expanded view. */
    label: string;
    /** Extra class on the viewer's content wrapper (content-specific
     * global styles, e.g. Mermaid edge labels). */
    class?: string;
    /** Panel background (any CSS color) behind this item. */
    background?: string;
};
/** User-facing strings of the viewer, all with English defaults. */
export interface MediaViewerLabels {
    closeLabel?: string;
    resetLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
    /** Accessible name when the item has none (an image with empty alt). */
    fallbackLabel?: string;
    /** Position suffix of the accessible name when paging, e.g.
     * `(position, total) => \`${position} of ${total}\``. 1-based. */
    formatPosition?: (position: number, total: number) => string;
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
 * eligible items. Replaces any viewer that is already open. The viewer
 * component loads on first use; if `origin` is removed or unregistered
 * meanwhile (its owner unmounted), nothing opens. Resolves to a function
 * that closes this viewer (a no-op once it has closed or never opened). */
export declare function openMediaViewerGallery(origin: Element, options?: OpenMediaViewerOptions): Promise<() => void>;
/** Close the open gallery viewer and cancel a pending open. With
 * `showing`, only when the open viewer's items include one of those
 * elements (e.g. diagrams about to be re-rendered). */
export declare function closeMediaViewerGallery(showing?: Iterable<Element>): void;
