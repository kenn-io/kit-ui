import type { MediaViewerItem } from "../utils/media-gallery.js";
interface Props {
    /** What to show; with more than one item the viewer pages between
     * them (buttons, ArrowLeft/ArrowRight), wrapping at the ends. */
    items: MediaViewerItem[];
    /** Index of the item on display. */
    index?: number;
    onclose: () => void;
    /** Suspend app-level keyboard handling while open; returns the
     * restore function. Defaults to an `appShortcuts` scope. */
    onViewerOpen?: () => () => void;
    closeLabel?: string;
    resetLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
}
declare const MediaViewer: import("svelte").Component<Props, {}, "index">;
type MediaViewer = ReturnType<typeof MediaViewer>;
export default MediaViewer;
