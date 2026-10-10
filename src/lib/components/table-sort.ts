/*
 * Pure sorting helpers behind TableSort. Kept free of runes so they can be
 * unit-tested without compiling Svelte.
 */

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
export type SortColumns<Row, Key extends string> = Record<
  Key,
  SortColumn<Row> | ((row: Row) => SortValue)
>;

export interface SortState<Key extends string> {
  key: Key;
  direction: SortDirection;
}

/** What TableHeaderCell needs to sort a column; TableSort implements it. */
export interface TableSortControl {
  directionOf(column: string): SortDirection | null;
  toggle(column: string): void;
}

function column<Row, Key extends string>(
  columns: SortColumns<Row, Key>,
  key: Key,
): SortColumn<Row> {
  const entry = columns[key];
  if (entry === undefined) throw new Error(`TableSort: unknown column "${key}"`);
  return typeof entry === "function" ? { value: entry } : entry;
}

/** The state after clicking `key`: reverse the active column, or start a new
 * column in its first direction. */
export function nextSort<Row, Key extends string>(
  current: SortState<Key>,
  key: Key,
  columns: SortColumns<Row, Key>,
): SortState<Key> {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: column(columns, key).firstDirection ?? "asc" };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Ascending order of two present values: text by locale with natural
 * numbers ("v2" before "v10"), dates by time, everything else by `<`. */
export function compareSortValues(
  a: Exclude<SortValue, null | undefined>,
  b: Exclude<SortValue, null | undefined>,
): number {
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  if (typeof x !== typeof y) return collator.compare(String(x), String(y));
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The rows in `state` order. The sort is stable, so ties keep the input
 * order, and rows without a value (null, undefined, NaN, invalid dates)
 * always sort last. */
export function sortRows<Row, Key extends string>(
  rows: readonly Row[],
  state: SortState<Key>,
  columns: SortColumns<Row, Key>,
): Row[] {
  const { value } = column(columns, state.key);
  const sign = state.direction === "asc" ? 1 : -1;
  const missing = (v: SortValue): v is null | undefined =>
    v === null ||
    v === undefined ||
    (typeof v === "number" && Number.isNaN(v)) ||
    (v instanceof Date && Number.isNaN(v.getTime()));
  return rows
    .map((row) => ({ row, key: value(row) }))
    .sort((a, b) => {
      const am = missing(a.key);
      const bm = missing(b.key);
      if (am || bm) return am === bm ? 0 : am ? 1 : -1;
      return sign * compareSortValues(a.key!, b.key!);
    })
    .map(({ row }) => row);
}
