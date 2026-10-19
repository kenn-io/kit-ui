import type { Component } from "svelte";
export interface SettingsCategory {
    id: string;
    label: string;
    /** Categories sharing a group get a muted heading rendered above their
     * run; ungrouped categories render as before. */
    group?: string;
    /** Muted one-liner under the label describing the category. */
    summary?: string;
    /** An icon component, such as one from @lucide/svelte, shown before the
     * label. Rendered at size 16. */
    icon?: Component;
}
import type { Snippet } from "svelte";
interface Props {
    categories: SettingsCategory[];
    /** Id of the selected category (bindable). Defaults to the first category. */
    active?: string;
    /** Content for the active category; receives the active category id. */
    panel: Snippet<[string]>;
    /** Sidebar heading. Pass "" to hide it. */
    title?: string;
    /** Rendered above the category nav — e.g. a settings search box or a
     * back-to-app button. */
    sidebarHeader?: Snippet;
    /** Pinned below the scrollable content, e.g. save/cancel actions. */
    footer?: Snippet;
}
declare const SettingsLayout: Component<Props, {}, "active">;
type SettingsLayout = ReturnType<typeof SettingsLayout>;
export default SettingsLayout;
