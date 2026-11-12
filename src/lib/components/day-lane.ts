// Pure layout for DayLane: where each item of one day sits on a vertical
// hour axis. No DOM, no time zones, no instants. The caller places every
// item in minutes from the start of the day on an elapsed-time axis and
// says how long the day is (`dayMinutes`: 1440, or 1380 and 1500 on DST
// days), so each hour row is sixty elapsed minutes.

import type { ChipTone } from "./Chip.svelte";

export const HOUR_MINUTES = 60;

/** One thing that happened on the day. */
export interface DayLaneItem {
  /** Unique within the day. */
  id: string;
  /** True for a date-only or all-day item: shown in the strip above the hours. */
  dateOnly?: boolean | undefined;
  /** Minutes from the day's start. Negative when the item began the day before. */
  startMinute?: number | undefined;
  /** Omit (or pass `startMinute`) for a point item, such as a document or a message. */
  endMinute?: number | undefined;
  /** Lane key, or several, for the multi-lane layout. Ignored in a single lane. */
  lane?: string | readonly string[] | undefined;
  selected?: boolean | undefined;
  /** De-emphasized (for example by a filter); never hidden. */
  dimmed?: boolean | undefined;
  /** Accent bar and tick color, from the Chip tone vocabulary. */
  tone?: ChipTone | undefined;
}

/** A labelled line on the hour axis, in minutes from the day's start. */
export interface DayLaneTick {
  minute: number;
  label: string;
}

export interface DayLaneLayoutOptions {
  /** Length of the day in minutes. */
  dayMinutes: number;
  /** Pixels per hour. */
  hourHeight?: number;
  /** Smallest card height in pixels; point items get exactly this. */
  minItemHeight?: number;
  /** Side-by-side columns before the rest go into a "+N more" item. */
  maxColumns?: number;
  /** Empty stretches at least this long (in whole hours) fold to a band. 0 turns folding off. */
  foldQuietMinutes?: number;
  /** Height of a folded band in pixels. */
  foldHeight?: number;
  /** Keys of folds the viewer opened (`DayLaneSegment.key`). */
  expandedFolds?: Iterable<string>;
}

export const DAY_LANE_DEFAULTS = {
  hourHeight: 96,
  minItemHeight: 44,
  maxColumns: 3,
  foldQuietMinutes: 120,
  foldHeight: 32,
} as const;

/** A row of the axis: one hour, or a folded run of empty hours. */
export interface DayLaneSegment {
  kind: "hour" | "fold";
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  /** For a fold, and for the first hour of an opened fold: the fold's key. */
  key?: string;
  /** Hours in the fold this row belongs to (folds and opened folds). */
  foldHours?: number;
}

export interface DayLanePlacedItem {
  kind: "item";
  item: DayLaneItem;
  top: number;
  height: number;
  column: number;
  columns: number;
  point: boolean;
  /** The item began before the day. */
  clippedStart: boolean;
  /** The item ends after the day. */
  clippedEnd: boolean;
}

/** Items that did not fit in the columns, shown as one "+N more" card. */
export interface DayLaneOverflow {
  kind: "overflow";
  key: string;
  items: DayLaneItem[];
  /** Earliest start among them, in minutes. */
  startMinute: number;
  top: number;
  height: number;
  column: number;
  columns: number;
}

export type DayLaneEntry = DayLanePlacedItem | DayLaneOverflow;

export interface DayLaneLayout {
  segments: DayLaneSegment[];
  height: number;
  /** Timed items and overflows, in reading order (top, then column). */
  entries: DayLaneEntry[];
  /** Date-only items, in input order. */
  dateOnly: DayLaneItem[];
  /** Ids of items that are neither date-only nor inside the day. */
  outside: string[];
}

type Resolved = Required<Omit<DayLaneLayoutOptions, "expandedFolds">> & {
  expanded: ReadonlySet<string>;
};

function resolve(options: DayLaneLayoutOptions): Resolved {
  return {
    dayMinutes: options.dayMinutes,
    hourHeight: options.hourHeight ?? DAY_LANE_DEFAULTS.hourHeight,
    minItemHeight: options.minItemHeight ?? DAY_LANE_DEFAULTS.minItemHeight,
    maxColumns: Math.max(1, Math.floor(options.maxColumns ?? DAY_LANE_DEFAULTS.maxColumns)),
    foldQuietMinutes: options.foldQuietMinutes ?? DAY_LANE_DEFAULTS.foldQuietMinutes,
    foldHeight: options.foldHeight ?? DAY_LANE_DEFAULTS.foldHeight,
    expanded: new Set(options.expandedFolds ?? []),
  };
}

/** The key of the fold covering [start, end), stable for the same day. */
export function foldKey(startMinute: number, endMinute: number): string {
  return `${startMinute}-${endMinute}`;
}

/** True when an item has no length of its own. */
export function isPointItem(item: DayLaneItem): boolean {
  return item.endMinute === undefined || item.endMinute <= (item.startMinute ?? 0);
}

/** True when a timed item has any part inside [0, dayMinutes). */
export function isInDay(item: DayLaneItem, dayMinutes: number): boolean {
  const start = item.startMinute;
  if (item.dateOnly || start === undefined || !Number.isFinite(start)) return false;
  if (start >= dayMinutes) return false;
  return isPointItem(item) ? start >= 0 : (item.endMinute as number) > 0;
}

/** End of the time an item takes up on screen: its real end, or as far as
 * its minimum height reaches from where it is drawn (its start, clipped to
 * the day), whichever is later. Folding uses this, so the hours a card
 * covers stay open. */
export function renderedEndMinute(
  item: DayLaneItem,
  hourHeight: number,
  minItemHeight: number,
): number {
  const start = item.startMinute ?? 0;
  const end = isPointItem(item) ? start : (item.endMinute as number);
  return Math.max(end, Math.max(start, 0) + (minItemHeight / hourHeight) * HOUR_MINUTES);
}

/**
 * Rows of the axis. An hour is busy when any item's rendered span touches
 * it; a run of empty hours lasting at least `foldQuietMinutes` becomes one
 * fold unless its key is in `expandedFolds`. Linear in items plus hours.
 */
export function buildDayLaneSegments(
  items: readonly DayLaneItem[],
  options: DayLaneLayoutOptions,
): DayLaneSegment[] {
  const o = resolve(options);
  if (!(o.dayMinutes > 0)) return [];
  const hours = Math.ceil(o.dayMinutes / HOUR_MINUTES);
  // Difference array: +1 at the hour an item's busy span starts, -1 after it ends.
  const diff = new Int32Array(hours + 1);
  for (const item of items) {
    if (!isInDay(item, o.dayMinutes)) continue;
    const s = Math.max(item.startMinute as number, 0);
    const e = Math.min(renderedEndMinute(item, o.hourHeight, o.minItemHeight), o.dayMinutes);
    const first = Math.floor(s / HOUR_MINUTES);
    const last = Math.max(first, Math.ceil(e / HOUR_MINUTES) - 1);
    diff[first]! += 1;
    diff[Math.min(last + 1, hours)]! -= 1;
  }
  const busy: boolean[] = [];
  let running = 0;
  for (let h = 0; h < hours; h++) {
    running += diff[h]!;
    busy.push(running > 0);
  }

  const hourEnd = (h: number) => Math.min((h + 1) * HOUR_MINUTES, o.dayMinutes);
  const segments: DayLaneSegment[] = [];
  let top = 0;
  const pushHour = (h: number, fold?: { key: string; hours: number }) => {
    const startMinute = h * HOUR_MINUTES;
    const endMinute = hourEnd(h);
    const height = ((endMinute - startMinute) / HOUR_MINUTES) * o.hourHeight;
    const segment: DayLaneSegment = { kind: "hour", startMinute, endMinute, top, height };
    if (fold) {
      segment.key = fold.key;
      segment.foldHours = fold.hours;
    }
    segments.push(segment);
    top += height;
  };

  let h = 0;
  while (h < hours) {
    if (busy[h]) {
      pushHour(h);
      h++;
      continue;
    }
    let j = h;
    while (j < hours && !busy[j]) j++;
    const startMinute = h * HOUR_MINUTES;
    const endMinute = hourEnd(j - 1);
    const foldable = o.foldQuietMinutes > 0 && endMinute - startMinute >= o.foldQuietMinutes;
    if (!foldable) {
      for (let k = h; k < j; k++) pushHour(k);
    } else {
      const key = foldKey(startMinute, endMinute);
      const foldHours = Math.round(((endMinute - startMinute) / HOUR_MINUTES) * 100) / 100;
      if (o.expanded.has(key)) {
        pushHour(h, { key, hours: foldHours });
        for (let k = h + 1; k < j; k++) pushHour(k);
      } else {
        segments.push({
          kind: "fold",
          startMinute,
          endMinute,
          top,
          height: o.foldHeight,
          key,
          foldHours,
        });
        top += o.foldHeight;
      }
    }
    h = j;
  }
  return segments;
}

/** Total height of the axis. */
export function segmentsHeight(segments: readonly DayLaneSegment[]): number {
  const last = segments[segments.length - 1];
  return last ? last.top + last.height : 0;
}

/** Vertical position of a minute. Inside a fold it is the fold's top;
 * before the day 0, after it the full height. Binary search. */
export function minuteToY(
  segments: readonly DayLaneSegment[],
  minute: number,
  hourHeight: number,
): number {
  const first = segments[0];
  if (!first || minute <= first.startMinute) return 0;
  let lo = 0;
  let hi = segments.length - 1;
  if (minute >= segments[hi]!.endMinute) return segmentsHeight(segments);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid]!.endMinute <= minute) lo = mid + 1;
    else hi = mid;
  }
  const s = segments[lo]!;
  if (s.kind === "fold") return s.top;
  return s.top + ((minute - s.startMinute) / HOUR_MINUTES) * hourHeight;
}

/** A vertical span to lay out in columns. */
export interface ColumnInput {
  top: number;
  bottom: number;
}

export interface ColumnResult<T extends ColumnInput> {
  placed: Array<{ entry: T; column: number; columns: number }>;
  /** Groups of entries that did not fit, each shown as one card in the last column. */
  overflows: Array<{ entries: T[]; top: number; column: number; columns: number }>;
}

/**
 * Interval partitioning: sort by top, split into clusters of overlapping
 * spans, give each span the first column that is free at its top. A
 * cluster that needs more than `maxColumns` keeps the first
 * `maxColumns - 1` columns and moves the rest into overflow groups in the
 * last column, one group per run of hidden spans that would overlap a
 * card of `minHeight` placed at the run's first top. Nothing is dropped.
 */
export function placeColumns<T extends ColumnInput>(
  entries: readonly T[],
  maxColumns: number,
  minHeight: number,
): ColumnResult<T> {
  const max = Math.max(1, Math.floor(maxColumns));
  const sorted = [...entries].sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  const result: ColumnResult<T> = { placed: [], overflows: [] };
  let cluster: Array<{ entry: T; column: number }> = [];
  let clusterBottom = -Infinity;
  let columnBottoms: number[] = [];

  const flush = () => {
    if (!cluster.length) return;
    const needed = columnBottoms.length;
    if (needed <= max) {
      for (const c of cluster) result.placed.push({ ...c, columns: needed });
    } else {
      const keep = max - 1;
      const hidden: T[] = [];
      for (const c of cluster) {
        if (c.column < keep) result.placed.push({ ...c, columns: max });
        else hidden.push(c.entry);
      }
      let group: T[] = [];
      let groupTop = 0;
      for (const entry of hidden) {
        if (group.length && entry.top >= groupTop + minHeight) {
          result.overflows.push({ entries: group, top: groupTop, column: keep, columns: max });
          group = [];
        }
        if (!group.length) groupTop = entry.top;
        group.push(entry);
      }
      if (group.length) {
        result.overflows.push({ entries: group, top: groupTop, column: keep, columns: max });
      }
    }
    cluster = [];
    columnBottoms = [];
    clusterBottom = -Infinity;
  };

  for (const entry of sorted) {
    if (cluster.length && entry.top >= clusterBottom) flush();
    let column = columnBottoms.findIndex((bottom) => bottom <= entry.top);
    if (column < 0) {
      column = columnBottoms.length;
      columnBottoms.push(entry.bottom);
    } else {
      columnBottoms[column] = entry.bottom;
    }
    cluster.push({ entry, column });
    clusterBottom = Math.max(clusterBottom, entry.bottom);
  }
  flush();
  return result;
}

/** Place timed items on already-built segments (once per lane). */
export function placeDayLaneItems(
  items: readonly DayLaneItem[],
  segments: readonly DayLaneSegment[],
  options: DayLaneLayoutOptions,
): DayLaneEntry[] {
  const o = resolve(options);
  // Cards end at the day's end even when that leaves less than the minimum height.
  const dayBottom = segmentsHeight(segments);
  const spans: Array<ColumnInput & { item: DayLaneItem }> = [];
  for (const item of items) {
    if (!isInDay(item, o.dayMinutes)) continue;
    const start = item.startMinute as number;
    const top = minuteToY(segments, start, o.hourHeight);
    const end = isPointItem(item) ? start : (item.endMinute as number);
    const bottom = Math.min(
      Math.max(minuteToY(segments, end, o.hourHeight), top + o.minItemHeight),
      dayBottom,
    );
    spans.push({ item, top, bottom });
  }
  const { placed, overflows } = placeColumns(spans, o.maxColumns, o.minItemHeight);
  const entries: DayLaneEntry[] = placed.map(({ entry, column, columns }) => ({
    kind: "item",
    item: entry.item,
    top: entry.top,
    height: entry.bottom - entry.top,
    column,
    columns,
    point: isPointItem(entry.item),
    clippedStart: (entry.item.startMinute as number) < 0,
    clippedEnd: !isPointItem(entry.item) && (entry.item.endMinute as number) > o.dayMinutes,
  }));
  for (const overflow of overflows) {
    const hidden = overflow.entries.map((e) => e.item);
    entries.push({
      kind: "overflow",
      key: JSON.stringify(hidden.map((i) => i.id)),
      items: hidden,
      startMinute: Math.min(...hidden.map((i) => i.startMinute as number)),
      top: overflow.top,
      height: Math.min(o.minItemHeight, dayBottom - overflow.top),
      column: overflow.column,
      columns: overflow.columns,
    });
  }
  return entries.sort((a, b) => a.top - b.top || a.column - b.column);
}

/** Lay out one day: axis rows, timed items in columns, and the date-only strip. */
export function layoutDayLane(
  items: readonly DayLaneItem[],
  options: DayLaneLayoutOptions,
): DayLaneLayout {
  const segments = buildDayLaneSegments(items, options);
  return {
    segments,
    height: segmentsHeight(segments),
    entries: placeDayLaneItems(items, segments, options),
    dateOnly: items.filter((i) => i.dateOnly),
    outside: items.filter((i) => !i.dateOnly && !isInDay(i, options.dayMinutes)).map((i) => i.id),
  };
}

/** One column of a multi-lane day, such as a person. */
export interface DayLaneLane {
  key: string;
  label: string;
}

export interface DayLaneLanesLayout extends Omit<DayLaneLayout, "entries"> {
  /** Entries per lane, in the order of `laneKeys`. */
  lanes: Array<{ key: string; entries: DayLaneEntry[] }>;
  /** Ids of timed items in the day whose lanes are all missing from `laneKeys`. */
  unassigned: string[];
}

/** The lane keys an item belongs to. */
export function lanesOf(item: DayLaneItem): readonly string[] {
  if (item.lane === undefined) return [];
  return typeof item.lane === "string" ? [item.lane] : item.lane;
}

/**
 * Several lanes on one axis ("By person"). Rows are shared, so the hours
 * line up across lanes; a fold needs every lane to be empty. Each lane then
 * gets the same column and overflow rules as a single lane. An item with
 * several lane keys appears in each of those lanes.
 */
export function layoutDayLanes(
  items: readonly DayLaneItem[],
  laneKeys: readonly string[],
  options: DayLaneLayoutOptions,
): DayLaneLanesLayout {
  const buckets = new Map<string, DayLaneItem[]>(laneKeys.map((key) => [key, []]));
  const assigned: DayLaneItem[] = [];
  const unassigned: string[] = [];
  for (const item of items) {
    if (!isInDay(item, options.dayMinutes)) continue;
    let placed = false;
    // A repeated key would place the same card twice in one lane.
    for (const key of new Set(lanesOf(item))) {
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.push(item);
      placed = true;
    }
    if (placed) assigned.push(item);
    else unassigned.push(item.id);
  }
  const segments = buildDayLaneSegments(assigned, options);
  return {
    segments,
    height: segmentsHeight(segments),
    lanes: laneKeys.map((key) => ({
      key,
      entries: placeDayLaneItems(buckets.get(key) ?? [], segments, options),
    })),
    dateOnly: items.filter((i) => i.dateOnly),
    outside: items.filter((i) => !i.dateOnly && !isInDay(i, options.dayMinutes)).map((i) => i.id),
    unassigned,
  };
}

/** Hour ticks for a plain day: one per hour, labelled by `label(hour)`.
 * Apps with DST days pass their own ticks instead. */
export function hourTicks(dayMinutes: number, label: (hour: number) => string): DayLaneTick[] {
  const ticks: DayLaneTick[] = [];
  for (let minute = 0; minute < dayMinutes; minute += HOUR_MINUTES) {
    ticks.push({ minute, label: label(minute / HOUR_MINUTES) });
  }
  return ticks;
}

export interface DayLanePlacedTick extends DayLaneTick {
  top: number;
  /** The tick opens a folded band: draw the label, not the line. */
  atFold: boolean;
}

/** Position ticks on the axis. Ticks inside a fold are dropped, except
 * one at the fold's first minute, which labels the band. */
export function placeTicks(
  ticks: readonly DayLaneTick[],
  segments: readonly DayLaneSegment[],
  hourHeight: number,
): DayLanePlacedTick[] {
  const placed: DayLanePlacedTick[] = [];
  const end = segments[segments.length - 1]?.endMinute ?? 0;
  for (const tick of ticks) {
    if (tick.minute < 0 || tick.minute >= end) continue;
    const fold = segments.find(
      (s) => s.kind === "fold" && tick.minute >= s.startMinute && tick.minute < s.endMinute,
    );
    if (fold && tick.minute !== fold.startMinute) continue;
    placed.push({ ...tick, top: minuteToY(segments, tick.minute, hourHeight), atFold: !!fold });
  }
  return placed;
}

/** What the `item` snippet receives for each card. */
export interface DayLaneItemContext {
  item: DayLaneItem;
  /** Card height in pixels (the minimum height for date-only items). */
  height: number;
  /** Shorter than two lines of text: show one line. */
  compact: boolean;
  point: boolean;
  dateOnly: boolean;
  /** Columns sharing this card's cluster; narrow cards should show less. */
  columns: number;
}
