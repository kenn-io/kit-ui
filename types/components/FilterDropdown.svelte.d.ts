import type { Snippet } from "svelte";
export interface FilterDropdownItem {
    id: string;
    label: string;
    description?: string;
    active: boolean;
    color?: string;
    count?: number;
    disabled?: boolean;
    closeOnSelect?: boolean;
    /** Short value summary at the row's end, such as "2 selected". */
    detail?: string;
    /** Content for a flyout beside the panel. A row with a submenu opens
     * the flyout instead of calling `onSelect`. */
    submenu?: Snippet;
    onSelect: () => void;
}
export interface FilterDropdownSection {
    title?: string;
    items: FilterDropdownItem[];
}
interface Props {
    label: string;
    detail?: string;
    title?: string;
    active?: boolean;
    badgeCount?: number;
    showBadge?: boolean;
    disabled?: boolean;
    sections: FilterDropdownSection[];
    resetLabel?: string;
    onReset?: () => void;
    /** Show a text input that filters items across all sections. */
    searchable?: boolean;
    searchPlaceholder?: string;
    /** Show "Select all" / "Deselect all" bulk actions at the top. */
    onSelectAll?: () => void;
    onDeselectAll?: () => void;
    selectAllLabel?: string;
    deselectAllLabel?: string;
    emptyLabel?: string;
    minWidth?: string;
    align?: "start" | "end";
    icon?: "filter" | "sort" | "more";
    /** Render the panel and flyout in `document.body`, so an ancestor that
     * clips overflow or sets CSS containment cannot clip them. Tab then
     * cycles inside the panel or the flyout. */
    portal?: boolean;
    /** Called when the panel opens or closes, for an app that suspends its
     * own shortcuts while the panel is open. */
    onOpenChange?: (open: boolean) => void;
}
declare const FilterDropdown: import("svelte").Component<Props, {}, "">;
type FilterDropdown = ReturnType<typeof FilterDropdown>;
export default FilterDropdown;
