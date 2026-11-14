import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements";
export interface TabItem {
    id: string;
    label: string;
    disabled?: boolean;
    /** Muted count after the label, e.g. the number of changed files. */
    count?: number | string;
}
export type TabsActivation = "automatic" | "manual";
/** `underline` (default) draws padded tabs with an accent bar under the
 * selected one. `bare` keeps the behavior and drops the look, for tabs the
 * consumer styles itself, such as a compact browser-style strip. */
export type TabsVariant = "underline" | "bare";
/** Attributes Tabs sets on each tab button itself; consumers cannot
 * override them. `data-tab-id` is owned too. */
type TabOwnedAttribute = "type" | "role" | "id" | "tabindex" | "disabled" | "aria-selected" | "aria-controls" | "aria-label" | "children";
/** Extra attributes and handlers for one tab button. `class` is added to
 * the tab's own classes, and `onclick` runs after Tabs selects the tab. */
export type TabAttributes = Omit<HTMLButtonAttributes, TabOwnedAttribute>;
/** Extra attributes and handlers for the scrolling tab list. `class` is
 * added to the list's own classes; `onkeydown` and `onfocusout` run after
 * Tabs' own keyboard and focus handling. */
export type TabListAttributes = Omit<HTMLAttributes<HTMLDivElement>, "role" | "aria-label" | "aria-orientation" | "tabindex" | "children">;
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
    /** Extra attributes and handlers for each tab button, such as `title`,
     * `data-*`, `draggable`, drag and drop handlers, `oncontextmenu`, or an
     * `onclick` that runs after selection. Called with the tab and whether
     * it is selected. */
    tabAttributes?: (item: TabItem, selected: boolean) => TabAttributes;
    /** Extra attributes and handlers for the tab list, such as `class`,
     * `style`, `onscroll`, or `onwheel`. */
    listAttributes?: TabListAttributes;
    /** The tab list element (bindable), for measuring and scrolling it. */
    listElement?: HTMLDivElement | undefined;
    /** Content rendered after the tab list, outside it, inside the root:
     * controls that must not sit in `role="tablist"`, such as scroll
     * buttons laid over the list's ends. */
    afterList?: Snippet;
    variant?: TabsVariant;
    /** The selected tab's panel, rendered in a tabpanel labelled by the
     * selected tab. Omit it to render the tab list alone. */
    children?: Snippet<[string]>;
    class?: string;
}
declare const Tabs: import("svelte").Component<Props, {}, "value" | "listElement">;
type Tabs = ReturnType<typeof Tabs>;
export default Tabs;
