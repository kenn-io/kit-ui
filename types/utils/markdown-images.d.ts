/**
 * Expand controls for images in rendered markdown, consolidated from
 * Forge's frontend. `initMarkdownImageViewer` watches a root for images
 * matching `selector`, wraps each in a hover expand button, and registers
 * it with the page gallery: expanding one opens the shared MediaViewer,
 * which pages through the page's other images and diagrams.
 *
 * The wrapper and button are imperative DOM, so their styles are global:
 * import `@kenn-io/kit-ui/markdown-images.css` alongside theme.css.
 */
import { type MediaViewerLabels } from "./media-gallery.js";
export interface MarkdownImageViewerOptions {
    /** Images to enhance under the root. Defaults to images inside kit-ui's
     * `Markdown` component. */
    selector?: string;
    /** Suspend app-level keyboard handling while the expanded view is open
     * (see MediaViewer's `onViewerOpen`). */
    onViewerOpen?: () => () => void;
    expandLabel?: string;
    /** Strings for the expanded view (see MediaViewer's label props). */
    viewerLabels?: MediaViewerLabels;
}
export interface MarkdownImageViewerController {
    /** Enhance matching images now instead of on the next DOM mutation. */
    refresh: () => void;
    /** Stop watching and close a viewer this controller opened. */
    disconnect: () => void;
}
export declare function initMarkdownImageViewer(root?: HTMLElement | Document, options?: MarkdownImageViewerOptions): MarkdownImageViewerController;
