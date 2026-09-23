export type SortDirection = "asc" | "desc";
import type { Snippet } from "svelte";
interface Props {
    label?: string;
    children?: Snippet;
    /** Render a sort button; `onsort` decides what sorting means. */
    sortable?: boolean;
    /** This column's current direction, or null/undefined when unsorted. */
    sortDirection?: SortDirection | null;
    onsort?: () => void;
    /** Right-align (numbers, costs, durations). */
    numeric?: boolean;
    class?: string;
}
declare const TableHeaderCell: import("svelte").Component<Props, {}, "">;
type TableHeaderCell = ReturnType<typeof TableHeaderCell>;
export default TableHeaderCell;
