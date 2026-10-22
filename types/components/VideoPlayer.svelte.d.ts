import "@videojs/html/video/player";
import "@videojs/html/ui/container";
import "@videojs/html/ui/controls";
import "@videojs/html/ui/controls-backdrop";
import "@videojs/html/ui/controls-content";
import "@videojs/html/ui/controls-group";
import "@videojs/html/ui/play-button";
import "@videojs/html/ui/mute-button";
import "@videojs/html/ui/volume-slider";
import "@videojs/html/ui/time-slider";
import "@videojs/html/ui/slider-track";
import "@videojs/html/ui/slider-fill";
import "@videojs/html/ui/slider-buffer";
import "@videojs/html/ui/slider-thumb";
import "@videojs/html/ui/time";
import "@videojs/html/ui/time-group";
import "@videojs/html/ui/time-separator";
import "@videojs/html/ui/fullscreen-button";
import "@videojs/html/ui/playback-rate-button";
import "@videojs/html/ui/hotkey";
import "@videojs/html/ui/gesture";
import type { Attachment } from "svelte/attachments";
import { type MediaViewerLabels } from "../utils/media-gallery.js";
interface Props {
    /** The video URL. Give `sources` instead for several formats. */
    src?: string;
    /** Sources in preference order, rendered as `<source>` elements; the
     * browser plays the first it supports. */
    sources?: {
        src: string;
        type?: string;
    }[];
    /** Accessible name of the video. */
    label: string;
    poster?: string;
    preload?: "none" | "metadata" | "auto";
    /** Show the expand control, which opens the page gallery (MediaViewer)
     * on this video. The gallery pages through the page's other images,
     * diagrams, and videos. */
    expandable?: boolean;
    expandLabel?: string;
    /** Suspend app-level keyboard handling while the expanded view is
     * open (see MediaViewer's `onViewerOpen`). */
    onViewerOpen?: () => () => void;
    /** Strings for the expanded view (see MediaViewer's label props). */
    viewerLabels?: MediaViewerLabels;
    /** Accessible name of the control bar. */
    controlsLabel?: string;
    /** The `<video>` element, for hosts that drive playback. */
    video?: HTMLVideoElement;
    /** Attached to the `<video>` element. */
    videoAttachment?: Attachment<HTMLVideoElement>;
    class?: string;
}
declare const VideoPlayer: import("svelte").Component<Props, {}, "video">;
type VideoPlayer = ReturnType<typeof VideoPlayer>;
export default VideoPlayer;
