export interface FilterDropdownItem {
    id: string;
    label: string;
    description?: string;
    active: boolean;
    color?: string;
    count?: number;
    disabled?: boolean;
    closeOnSelect?: boolean;
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
}
declare const FilterDropdown: import("svelte").Component<Props, {}, "">;
type FilterDropdown = ReturnType<typeof FilterDropdown>;
export default FilterDropdown;
