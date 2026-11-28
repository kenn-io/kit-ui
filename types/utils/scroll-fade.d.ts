import type { Attachment } from "svelte/attachments";
/**
 * Fades the top or bottom edge of a scroll container while more content lies
 * past it. Overlay scrollbars (macOS, touch) stay hidden until the user
 * scrolls, so without a fade a list cut at a row boundary looks complete.
 *
 * Attach it to the element that scrolls: `<div {@attach scrollFade}>`. It
 * sets `data-kit-scroll-fade`, plus `data-kit-scroll-fade-top` and
 * `data-kit-scroll-fade-bottom` while that edge hides content; theme.css
 * draws the fades from those attributes. The fades are painted in
 * `--kit-scroll-fade-color` (default `--bg-popover`), so set it on a
 * container whose background is something else.
 */
export declare const scrollFade: Attachment<HTMLElement>;
