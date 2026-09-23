type FloatingAlign = "start" | "end";
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
export declare function floatingPopoverStyle({ trigger, viewportWidth, viewportHeight, popoverWidth, popoverHeight, align, edgeGap, triggerGap, maxWidth, constrainWidth, placement, }: FloatingPopoverInput): string;
export {};
