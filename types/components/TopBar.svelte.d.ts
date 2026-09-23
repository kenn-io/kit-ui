import type { SelectDropdownIndicator, SelectDropdownIndicatorTone } from "./select-dropdown.js";
/** Same shape as the collapsed dropdown's option indicator — the tab's
 * indicator is handed to SelectDropdown verbatim when the tabs collapse. */
export type TopBarTabIndicator = SelectDropdownIndicator;
export type TopBarTabIndicatorTone = SelectDropdownIndicatorTone;
export interface TopBarTab {
    id: string;
    label: string;
    disabled?: boolean;
    /** Small status dot after the label ("daemon unreachable" etc.).
     * Rendered on the expanded tab, in the collapsed dropdown's option and
     * trigger, and in the measurement probe (it counts toward collapse). */
    indicator?: TopBarTabIndicator;
}
import { type Snippet } from "svelte";
interface Props {
    /** Primary navigation tabs. Omit (or pass []) for a bar with no tabs. */
    tabs?: TopBarTab[];
    /** Active tab id (bindable). */
    active?: string;
    onchange?: (id: string) => void;
    /** True while the tabs are collapsed into the dropdown (bindable,
     * read-only in spirit) — lets the app hide labels etc. in its snippets. */
    collapsed?: boolean;
    /** Center the tab group between the side regions (Forge style)
     * instead of packing it after the left region. */
    centerTabs?: boolean;
    /** aria-label for the tab nav / collapsed dropdown. */
    ariaLabel?: string;
    /** Reserved leading region: brand, sidebar toggle, context pickers. */
    left?: Snippet;
    /** Optional search slot, centered in the remaining space. */
    search?: Snippet;
    /** Opt the search region into the flexible middle: it grows to absorb
     * all slack (so its content can span, e.g. a FitStages search field)
     * and this value — not its grown width — is what tab-collapse
     * measurement charges it. Set it to the narrowest width the search
     * content can take; lower it via `bind:collapsed` for staged
     * degradation. Omit for a shrink-wrapped centered slot. */
    searchMinWidth?: number;
    /** Reserved trailing region: actions, theme toggle, settings. */
    right?: Snippet;
    class?: string;
}
declare const TopBar: import("svelte").Component<Props, {}, "collapsed" | "active">;
type TopBar = ReturnType<typeof TopBar>;
export default TopBar;
