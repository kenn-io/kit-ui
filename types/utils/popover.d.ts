export interface DismissableOptions {
    /** Elements that count as "inside"; a pointer-down outside them all dismisses. */
    owners: () => (Element | null | undefined)[];
    dismiss: () => void;
    /** Focused after an Escape dismiss so keyboard users land back on the trigger. */
    escapeFocus?: () => HTMLElement | null | undefined;
}
/**
 * Dismiss on `mousedown` outside the owning elements (mousedown, not click:
 * the popover should yield at press, and a press-inside-release-outside
 * drag should not dismiss) or on Escape anywhere in the document.
 */
export declare function dismissable({ owners, dismiss, escapeFocus }: DismissableOptions): () => void;
/**
 * Keep a floating panel positioned while open: window resize, scroll in any
 * ancestor (capture phase — the panel is position: fixed, so every nested
 * scroll container moves the trigger under it), and observed element size
 * changes (panel content, trigger stretching, or layout-host resizing).
 * Repositions are coalesced to one per animation frame: each event's handler
 * does a layout read + style write, which would force synchronous layout when
 * interleaved per-event with other frame work.
 */
export declare function autoReposition(observedElements: () => (Element | null | undefined)[], reposition: () => void): () => void;
