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
