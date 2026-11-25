import type { Attachment } from "svelte/attachments";
export type OverlayScrollbarAxis = "x" | "y" | "both";
export type OverlayScrollbarVisibility = "auto" | "always" | "never";
export type OverlayScrollbarInset = number | HTMLElement | null | undefined | (() => number | HTMLElement | null | undefined);
export interface OverlayScrollbarsOptions {
    /** Which axes render overlay scrollbar tracks. Default `"both"`. */
    axis?: OverlayScrollbarAxis;
    /** When thumbs show: `"auto"` (on hover, scroll, or drag), `"always"`
     * (while overflowing), or `"never"` (suppress native scrollbars with no
     * overlay thumbs). Default `"auto"`. */
    visibility?: OverlayScrollbarVisibility;
    /** Extra top inset in px for the vertical track (e.g. below a sticky
     * header), or an element / getter whose height sets the inset (such as a
     * sticky `<thead>`). */
    insetTop?: OverlayScrollbarInset;
    /** Extra bottom inset in px for the vertical track. */
    insetBottom?: OverlayScrollbarInset;
    /** Extra left inset in px for the horizontal track. */
    insetLeft?: OverlayScrollbarInset;
    /** Extra right inset in px for the horizontal track. */
    insetRight?: OverlayScrollbarInset;
    /** Non-scrolling outer frame that holds the overlay tracks. When provided,
     * tracks mount inside `host` (zero scroll jitter and no extra children in
     * the scrolling viewport) aligned to the viewport's box inside `host`. */
    host?: HTMLElement | null | (() => HTMLElement | null | undefined);
    /** Corner clearance in px, or `"auto"` (default) to read computed border
     * radii from the frame/viewport so thumbs stay clear of rounded corners. */
    cornerRadius?: number | "auto";
    /** Delay in ms before thumbs fade out after scrolling stops while not
     * hovered or dragging. Default `900`. */
    hideDelay?: number;
}
export interface ThumbMetrics {
    /** Whether this axis overflows and has room to render a thumb. */
    visible: boolean;
    /** Thumb length along the scroll axis, in px. */
    size: number;
    /** Thumb offset from the start of the track, in px. */
    offset: number;
}
export interface TrackBounds {
    /** Offset from the viewport's leading edge along the scroll axis, in px. */
    start: number;
    /** Total track length along the scroll axis, in px. */
    length: number;
}
/** Compute thumb length and position along one axis. */
export declare function computeThumbMetrics(params: {
    scrollSize: number;
    clientSize: number;
    scrollPos: number;
    trackLength: number;
    minThumbSize: number;
}): ThumbMetrics;
/** Map a pointer drag delta along the track back to a clamped scroll offset. */
export declare function scrollPosForThumbDelta(params: {
    startScrollPos: number;
    deltaPx: number;
    scrollSize: number;
    clientSize: number;
    trackLength: number;
    thumbSize: number;
}): number;
/** Map a pointer click inside the track to the scroll offset that centers the
 * thumb under the pointer. */
export declare function scrollPosForTrackClick(params: {
    clickOffsetInTrack: number;
    scrollSize: number;
    clientSize: number;
    trackLength: number;
    thumbSize: number;
}): number;
/** Compute track start and length along one axis, clearing edge insets,
 * explicit insets (such as a sticky header), rounded corners, and the
 * perpendicular track when both axes overflow. */
export declare function computeTrackBounds(params: {
    viewportLength: number;
    edgeInset: number;
    startInset: number;
    endInset: number;
    startCornerRadius: number;
    endCornerRadius: number;
    reserveEndForOtherAxis: number;
}): TrackBounds;
/** Convert wheel event deltas in pixel (0), line (1), or page (2) units into
 * CSS pixels for forwarding wheel input over host-mounted scrollbar tracks. */
export declare function wheelDeltaToPixels(params: {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    lineHeight: number;
    pageWidth: number;
    pageHeight: number;
}): {
    dx: number;
    dy: number;
};
/**
 * Svelte 5 attachment that replaces native scrollbars with zero-gutter floating
 * overlay scrollbars while keeping native wheel, trackpad, touch, keyboard,
 * scroll-anchoring, and programmatic scrolling intact.
 *
 * Attach to the scrolling element:
 * `<div class="panel" {@attach overlayScrollbars()}>…</div>`
 *
 * When a non-scrolling outer frame exists, pass it as `host` so tracks mount
 * outside the scrolling element (zero compositor jitter, no extra children
 * inside the viewport):
 * `<div bind:this={frame}><div class="viewport" {@attach overlayScrollbars({ host: () => frame })}>…</div></div>`
 */
export declare function overlayScrollbars(options?: OverlayScrollbarsOptions): Attachment<HTMLElement>;
