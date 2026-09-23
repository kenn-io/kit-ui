import type { Snippet } from "svelte";
interface Props {
    /** Main-area content. */
    children?: Snippet | undefined;
    sidebar: Snippet;
    /** Rendered after the main area (e.g. a right-hand rail). */
    trailing?: Snippet | undefined;
    isCollapsed?: boolean;
    hideSidebar?: boolean;
    sidebarWidth?: number;
    /** Sidebar fills the layout; no main area or resize handle. */
    sidebarOnly?: boolean;
    hasMain?: boolean;
    /** When collapsed, keep a thin strip with an expand toggle. */
    showCollapsedStrip?: boolean;
    mainEmpty?: boolean;
    mainOverflow?: "auto" | "hidden";
    minSidebarWidth?: number;
    maxSidebarWidth?: number;
    /** Below the `wide` breakpoint (900px), float the expanded sidebar over
     * the main area instead of squeezing it. */
    overlayOnNarrow?: boolean;
    /** Host-driven overlay: when set, floats (or doesn't float) the expanded
     * sidebar regardless of viewport width — for hosts whose narrow signal is
     * a measured container width rather than the viewport (embedded panes,
     * split-pane layouts). Leave unset to let `overlayOnNarrow`'s media query
     * drive. */
    overlay?: boolean | undefined;
    onSidebarResize?: ((width: number) => void) | undefined;
    onExpand?: (() => void) | undefined;
}
declare const CollapsibleSidebar: import("svelte").Component<Props, {}, "">;
type CollapsibleSidebar = ReturnType<typeof CollapsibleSidebar>;
export default CollapsibleSidebar;
