import {
  nextSort,
  sortRows,
  type SortColumns,
  type SortDirection,
  type SortState,
  type TableSortControl,
} from "./table-sort.js";

/**
 * Client-side sort state for a Table. Declare each column's sort value once,
 * pass the instance to every TableHeaderCell with `sort={sorter} column="key"`,
 * and render `sorter.sort(rows)`.
 *
 * For server-sorted or paginated data, keep the order on the server and use
 * TableHeaderCell's `sortable` / `sortDirection` / `onsort` props instead.
 */
export class TableSort<Row, Key extends string = string> implements TableSortControl {
  #columns: SortColumns<Row, Key>;
  #state: SortState<Key> = $state()!;

  constructor(columns: SortColumns<Row, Key>, initial: { key: Key; direction?: SortDirection }) {
    this.#columns = columns;
    this.#state = { key: initial.key, direction: initial.direction ?? "asc" };
  }

  get key(): Key {
    return this.#state.key;
  }

  get direction(): SortDirection {
    return this.#state.direction;
  }

  directionOf(column: Key): SortDirection | null {
    return this.#state.key === column ? this.#state.direction : null;
  }

  toggle(column: Key): void {
    this.#state = nextSort(this.#state, column, this.#columns);
  }

  /** The rows in the current order. Reactive: call it inside `$derived` or markup. */
  sort(rows: readonly Row[]): Row[] {
    return sortRows(rows, this.#state, this.#columns);
  }
}
