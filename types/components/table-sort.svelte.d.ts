import { type SortColumns, type SortDirection, type TableSortControl } from "./table-sort.js";
/**
 * Client-side sort state for a Table. Declare each column's sort value once,
 * pass the instance to every TableHeaderCell with `sort={sorter} column="key"`,
 * and render `sorter.sort(rows)`.
 *
 * For server-sorted or paginated data, keep the order on the server and use
 * TableHeaderCell's `sortable` / `sortDirection` / `onsort` props instead.
 */
export declare class TableSort<Row, Key extends string = string> implements TableSortControl {
    #private;
    constructor(columns: SortColumns<Row, Key>, initial: {
        key: Key;
        direction?: SortDirection;
    });
    get key(): Key;
    get direction(): SortDirection;
    directionOf(column: Key): SortDirection | null;
    toggle(column: Key): void;
    /** The rows in the current order. Reactive: call it inside `$derived` or markup. */
    sort(rows: readonly Row[]): Row[];
}
