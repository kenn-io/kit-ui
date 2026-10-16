import type { Component, Snippet } from "svelte";
export interface SidebarView {
    id: string;
    label: string;
    href: string;
}
/** A run of views under an optional heading. `heading: null` renders no heading. */
export interface SidebarViewRun {
    heading: string | null;
    views: SidebarView[];
}
export interface SidebarSection {
    id: string;
    label: string;
    href: string;
    /** An icon component, such as one from @lucide/svelte. Rendered at size 16. */
    icon: Component;
    /** Empty when the section has no views. */
    viewRuns: SidebarViewRun[];
}
export interface SidebarGroup {
    label: string | null;
    sections: SidebarSection[];
    /**
     * Places the group at the bottom of the panel, above the footer, apart
     * from the groups before it. List end groups last.
     */
    end?: boolean;
}
export interface SidebarLocation {
    section: string | null;
    view: string | null;
}
interface Props {
    groups: SidebarGroup[];
    location: SidebarLocation;
    /** The page address without its fragment. A change closes any open flyout. */
    page: string;
    /**
     * localStorage key that remembers whether the sidebar is pinned open at
     * rail widths. Until someone chooses, touch screens start pinned open, so
     * views stay reachable without hover, and other devices start as the rail.
     */
    storageKey: string;
    /** Brand area at the top of the panel. `rail` is true in the icon-only rail. */
    brand: Snippet<[{
        rail: boolean;
    }]>;
    /** Everything after the menu button in the narrow top bar. */
    narrowBar: Snippet;
    /**
     * Footer content. `rail` is true in the rail; `drawer` is true inside the
     * narrow drawer. The component adds its own pin button at rail widths.
     * Optional: without it, the footer region renders only at rail widths, to
     * hold the pin button.
     */
    footer?: Snippet<[{
        rail: boolean;
        drawer: boolean;
    }]>;
    /** Accessible name of the navigation landmark. Default "Main navigation". */
    label?: string;
    /** Accessible name of the narrow bar's menu button. Default "Open navigation". */
    menuLabel?: string;
    /** Accessible name of the narrow drawer dialog. Default "Navigation". */
    drawerLabel?: string;
    /** Accessible name of the rail's pin button while collapsed. Default "Expand sidebar". */
    expandLabel?: string;
    /** Accessible name of the rail's pin button while pinned open. Default "Collapse sidebar". */
    collapseLabel?: string;
}
declare const AppSidebar: Component<Props, {}, "">;
type AppSidebar = ReturnType<typeof AppSidebar>;
export default AppSidebar;
