export interface TabItem {
    id: string;
    label: string;
    disabled?: boolean;
    /** Muted count after the label, e.g. the number of changed files. */
    count?: number | string;
}
export type TabsActivation = "automatic" | "manual";
import type { Snippet } from "svelte";
interface Props {
    tabs: TabItem[];
    /** Selected tab id (bindable). */
    value: string;
    /** Called when the user selects another tab. */
    onchange?: (id: string) => void;
    /** Accessible name for the tab list. */
    ariaLabel?: string;
    /** `automatic` (default) selects a tab as arrow keys focus it. Use
     * `manual` when showing a panel is slow: arrows only move focus, and
     * Enter or Space selects. */
    activation?: TabsActivation;
    /** Custom tab content (icons, badges) rendered instead of the label.
     * `tab.label` stays the accessible name. */
    tab?: Snippet<[TabItem, boolean]>;
    /** The selected tab's panel, rendered in a tabpanel labelled by the
     * selected tab. Omit it to render the tab list alone. */
    children?: Snippet<[string]>;
    class?: string;
}
declare const Tabs: import("svelte").Component<Props, {}, "value">;
type Tabs = ReturnType<typeof Tabs>;
export default Tabs;
