export type SortDirection = "asc" | "desc";
/** A value a column sorts by. null and undefined mean "no value". */
export type SortValue = string | number | bigint | boolean | Date | null | undefined;
export interface SortColumn<Row> {
    /** The value this column sorts by. Rows without a value sort last in both directions. */
    value: (row: Row) => SortValue;
    /** Direction of the first click on this column. Defaults to "asc". Use "desc" for
     * columns where the biggest or most recent value is the interesting one. */
    firstDirection?: SortDirection;
}
/** Columns by key. A bare function is shorthand for `{ value }`. */
export type SortColumns<Row, Key extends string> = Record<Key, SortColumn<Row> | ((row: Row) => SortValue)>;
export interface SortState<Key extends string> {
    key: Key;
    direction: SortDirection;
}
/** What TableHeaderCell needs to sort a column; TableSort implements it. */
export interface TableSortControl {
    directionOf(column: string): SortDirection | null;
    toggle(column: string): void;
}
/** The state after clicking `key`: reverse the active column, or start a new
 * column in its first direction. */
export declare function nextSort<Row, Key extends string>(current: SortState<Key>, key: Key, columns: SortColumns<Row, Key>): SortState<Key>;
/** Ascending order of two present values: text by locale with natural
 * numbers ("v2" before "v10"), dates by time, everything else by `<`. */
export declare function compareSortValues(a: Exclude<SortValue, null | undefined>, b: Exclude<SortValue, null | undefined>): number;
/** The rows in `state` order. The sort is stable, so ties keep the input
 * order, and rows without a value (null, undefined, NaN, invalid dates)
 * always sort last. */
export declare function sortRows<Row, Key extends string>(rows: readonly Row[], state: SortState<Key>, columns: SortColumns<Row, Key>): Row[];
