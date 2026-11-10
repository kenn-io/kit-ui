export type { SortDirection } from "./table-sort.js";
import type { Snippet } from "svelte";
import type { SortDirection, TableSortControl } from "./table-sort.js";
interface BaseProps {
    label?: string;
    children?: Snippet;
    /** Render a sort button; `onsort` decides what sorting means. Prefer
     * `sort` + `column` for client-side data. */
    sortable?: boolean;
    /** This column's current direction, or null/undefined when unsorted. */
    sortDirection?: SortDirection | null;
    onsort?: () => void;
    /** Right-align (numbers, costs, durations). */
    numeric?: boolean;
    /** VirtualTable: the column's width in px. Unset, it is measured from
     * rows sampled across the list. */
    width?: number;
    /** VirtualTable: the narrowest a resize or fit makes the column. */
    minWidth?: number;
    /** VirtualTable: the widest a resize or fit makes the column. */
    maxWidth?: number;
    /** VirtualTable: show a handle to resize the column, or double-click it
     * to fit the column to its content. */
    resizable?: boolean;
    /** VirtualTable: the resize handle's accessible name. Defaults to
     * "Resize the {label} column" in English; pass a translated string. */
    resizeLabel?: string;
    /** VirtualTable: the column takes the width the other columns leave in
     * the table's box, and at least `minWidth`. It has no resize handle, and
     * `width` and `maxWidth` do not apply to it. Without a filling column,
     * the last column takes the spare width. */
    fill?: boolean;
    class?: string;
}
type Props = BaseProps & ({
    /** A TableSort (or other TableSortControl) that owns this column's
     * sorting. Replaces `sortable`, `sortDirection`, and `onsort`. */
    sort: TableSortControl;
    /** This column's key in `sort`. */
    column: string;
} | {
    sort?: undefined;
    column?: undefined;
});
declare const TableHeaderCell: import("svelte").Component<Props, {}, "">;
type TableHeaderCell = ReturnType<typeof TableHeaderCell>;
export default TableHeaderCell;
