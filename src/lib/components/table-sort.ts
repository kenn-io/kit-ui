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

/** The state after clicking `key`. A new column starts in its first
 * direction and a second click reverses it. With `unsortable`, the click
 * after that returns to the input order (null) instead of starting over. */
export function nextSort<Row, Key extends string>(
  current: SortState<Key> | null,
  key: Key,
  columns: SortColumns<Row, Key>,
  unsortable = false,
): SortState<Key> | null {
  const first = column(columns, key).firstDirection ?? "asc";
  if (current?.key !== key) return { key, direction: first };
  if (current.direction === first) {
    return { key, direction: first === "asc" ? "desc" : "asc" };
  }
  return unsortable ? null : { key, direction: first };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Numbers, bigints, and dates first, then text, then booleans. */
function typeRank(value: string | number | bigint | boolean): number {
  if (typeof value === "string") return 1;
  if (typeof value === "boolean") return 2;
  return 0;
}

/** Ascending order of two present values: text by locale with natural
 * numbers ("v2" before "v10"), dates by time, numbers and bigints by value
 * (also against each other), everything else by `<`. Values of different
 * kinds order by kind, so a column mixing them still sorts consistently. */
export function compareSortValues(
  a: Exclude<SortValue, null | undefined>,
  b: Exclude<SortValue, null | undefined>,
): number {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  const rank = typeRank(x) - typeRank(y);
  if (rank !== 0) return rank;
  if (typeof x === "string" && typeof y === "string") return collator.compare(x, y);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The rows in `state` order, or the input order when `state` is null. The
 * sort is stable, so ties keep the input order, and rows without a value
 * (null, undefined, NaN, invalid dates) always sort last. */
export function sortRows<Row, Key extends string>(
  rows: readonly Row[],
  state: SortState<Key> | null,
  columns: SortColumns<Row, Key>,
): Row[] {
  if (state === null) return [...rows];
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
