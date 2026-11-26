type FloatingAlign = "start" | "center" | "end";
type FloatingPlacement = "auto" | "below" | "above";
export interface FloatingPopoverInput {
    trigger: Pick<DOMRect, "left" | "right" | "top" | "bottom">;
    viewportWidth: number;
    viewportHeight?: number;
    popoverWidth?: number;
    popoverHeight?: number;
    align?: FloatingAlign;
    edgeGap?: number;
    triggerGap?: number;
    maxWidth?: number;
    constrainWidth?: boolean;
    /** "auto" (default) flips above the trigger when it would overflow the
     * viewport bottom; "below"/"above" force one side. */
    placement?: FloatingPlacement;
}
export interface FloatingPopoverPosition {
    left: number;
    top: number;
    /** Set only with `constrainWidth`. */
    width: number | undefined;
}
/** Viewport coordinates for a fixed popover; `floatingPopoverStyle` formats
 * them as inline style. */
export declare function floatingPopoverPosition({ trigger, viewportWidth, viewportHeight, popoverWidth, popoverHeight, align, edgeGap, triggerGap, maxWidth, constrainWidth, placement, }: FloatingPopoverInput): FloatingPopoverPosition;
export declare function floatingPopoverStyle(input: FloatingPopoverInput): string;
export interface FloatingFlyoutInput {
    /** The row the flyout belongs to; the flyout's top lines up with it. */
    anchor: Pick<DOMRect, "top">;
    /** The parent panel; the flyout opens beside it, right side first. */
    panel: Pick<DOMRect, "left" | "right">;
    viewportWidth: number;
    viewportHeight: number;
    flyoutWidth: number;
    flyoutHeight: number;
    edgeGap?: number;
    /** Space between panel and flyout. The default -1 overlaps the two
     * borders, so the flyout reads as attached to the panel. */
    panelGap?: number;
}
/** Inline style for a fixed submenu flyout beside its parent panel. It opens
 * to the right, flips to the left when the right side is too narrow, and
 * overlaps the panel only when neither side fits. */
export declare function floatingFlyoutStyle({ anchor, panel, viewportWidth, viewportHeight, flyoutWidth, flyoutHeight, edgeGap, panelGap, }: FloatingFlyoutInput): string;
export {};
