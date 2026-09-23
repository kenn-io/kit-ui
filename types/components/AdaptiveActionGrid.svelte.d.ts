import type { Snippet } from "svelte";
export type AdaptiveActionGridMode = "row" | "grid" | "compact";
export type AdaptiveActionGridFrame = "none" | "outline";
export type AdaptiveActionGridRadius = "none" | "sm" | "md" | "lg" | "pill";
export type AdaptiveActionGridSpace = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type AdaptiveActionGridLayout = "adaptive" | "fill";
export interface AdaptiveActionGridItem {
    /** Stable unique key for this item. */
    id: string;
    /** Control or compound control rendered in the item wrapper. */
    content: Snippet;
}
interface Props {
    /** Atomic top-level controls, in visual and keyboard order. */
    items: AdaptiveActionGridItem[];
    /** Accessible name for the complete control group. */
    ariaLabel: string;
    /** Visible compact trigger label. Defaults to ariaLabel. */
    compactLabel?: string;
    /** Non-interactive state summary rendered inside the compact trigger. */
    summary?: Snippet;
    /** Compact disclosure state. */
    open?: boolean;
    onopenchange?: (open: boolean) => void;
    /** Reports the measured layout for observation only. The callback must not
     * change an item's intrinsic width based on the reported mode. */
    onmodechange?: (mode: AdaptiveActionGridMode) => void;
    /** Layout policy. "adaptive" keeps a natural-width row while it fits.
     * "fill" packs items into rows by their natural width and stretches each
     * row's items to span the container, so the group reads as one
     * full-width control at any width and no label is truncated. Each row
     * is laid out independently of the rows around it. */
    layout?: AdaptiveActionGridLayout;
    /** Host width below which an overflowing row becomes compact. */
    collapseBelow?: number;
    /** Minimum equal grid-track width in CSS pixels. */
    minTrackWidth?: number;
    /** Outer frame treatment. */
    frame?: AdaptiveActionGridFrame;
    /** Outer frame radius. */
    radius?: AdaptiveActionGridRadius;
    /** Radius inherited by kit controls rendered as items. */
    itemRadius?: AdaptiveActionGridRadius;
    /** Spacing-ladder step between grid rows. Zero creates a joined grid. */
    rowGap?: AdaptiveActionGridSpace;
    /** Spacing-ladder step between columns. Zero creates a joined grid. */
    columnGap?: AdaptiveActionGridSpace;
    /** Spacing-ladder step between the frame and its items. */
    padding?: AdaptiveActionGridSpace;
    class?: string;
}
declare const AdaptiveActionGrid: import("svelte").Component<Props, {}, "open">;
type AdaptiveActionGrid = ReturnType<typeof AdaptiveActionGrid>;
export default AdaptiveActionGrid;
