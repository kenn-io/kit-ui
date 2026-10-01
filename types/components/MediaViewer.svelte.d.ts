import type { MediaViewerItem } from "../utils/media-gallery.js";
interface Props {
    /** What to show; with more than one item the viewer pages between
     * them (buttons, ArrowLeft/ArrowRight), wrapping at the ends. An
     * empty list renders nothing. */
    items: MediaViewerItem[];
    /** Index of the item on display; out-of-range values wrap. */
    index?: number;
    onclose: () => void;
    /** Suspend app-level keyboard handling while open; returns the
     * restore function. Defaults to an `appShortcuts` scope. */
    onViewerOpen?: () => () => void;
    closeLabel?: string;
    resetLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
    /** Accessible name when the item has none (an image with empty alt). */
    fallbackLabel?: string;
    /** Visible position counter when paging (1-based). */
    formatCounter?: (position: number, total: number) => string;
    /** Accessible name when paging, from the item's name (1-based). */
    formatLabel?: (label: string, position: number, total: number) => string;
}
declare const MediaViewer: import("svelte").Component<Props, {}, "index">;
type MediaViewer = ReturnType<typeof MediaViewer>;
export default MediaViewer;
