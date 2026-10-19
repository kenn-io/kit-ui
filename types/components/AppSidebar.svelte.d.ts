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
     * localStorage key that remembers whether someone collapsed the sidebar to
     * the rail or expanded it. The choice applies at every width above the
     * narrow drawer. Until someone chooses, the window width decides: the rail
     * below 1440px, except on touch screens, where views must stay reachable
     * without hover, and the full sidebar from 1440px.
     */
    storageKey: string;
    /**
     * A saved collapse choice from the host, for a host whose localStorage
     * does not last, such as a throwaway browser session. It wins over
     * `storageKey`. `null` or absent means the host has none.
     */
    collapsed?: boolean | null;
    /** Called with the new state when someone collapses or expands the sidebar. */
    oncollapsedchange?: (collapsed: boolean) => void;
    /** Brand area at the top of the panel. `rail` is true in the icon-only rail. */
    brand: Snippet<[{
        rail: boolean;
    }]>;
    /** Everything after the menu button in the narrow top bar. */
    narrowBar: Snippet;
    /**
     * Footer content. `rail` is true in the rail; `drawer` is true inside the
     * narrow drawer. The component adds its own collapse button outside the
     * drawer. Optional: without it, the footer region holds only that button.
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
    /** Accessible name of the collapse button while collapsed. Default "Expand sidebar". */
    expandLabel?: string;
    /** Accessible name of the collapse button while expanded. Default "Collapse sidebar". */
    collapseLabel?: string;
}
declare const AppSidebar: Component<Props, {}, "">;
type AppSidebar = ReturnType<typeof AppSidebar>;
export default AppSidebar;
