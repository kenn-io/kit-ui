import type { ChipTone } from "./Chip.svelte";
export declare const HOUR_MINUTES = 60;
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
export declare const DAY_LANE_DEFAULTS: {
    readonly hourHeight: 96;
    readonly minItemHeight: 44;
    readonly maxColumns: 3;
    readonly foldQuietMinutes: 120;
    readonly foldHeight: 32;
};
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
/** The key of the fold covering [start, end), stable for the same day. */
export declare function foldKey(startMinute: number, endMinute: number): string;
/** True when an item has no length of its own. */
export declare function isPointItem(item: DayLaneItem): boolean;
/** True when a timed item has any part inside [0, dayMinutes). */
export declare function isInDay(item: DayLaneItem, dayMinutes: number): boolean;
/** End of the time an item takes up on screen: its real end, or as far as
 * its minimum height reaches from where it is drawn (its start, clipped to
 * the day), whichever is later. Folding uses this, so the hours a card
 * covers stay open. */
export declare function renderedEndMinute(item: DayLaneItem, hourHeight: number, minItemHeight: number): number;
/**
 * Rows of the axis. An hour is busy when any item's rendered span touches
 * it; a run of empty hours lasting at least `foldQuietMinutes` becomes one
 * fold unless its key is in `expandedFolds`. Linear in items plus hours.
 */
export declare function buildDayLaneSegments(items: readonly DayLaneItem[], options: DayLaneLayoutOptions): DayLaneSegment[];
/** Total height of the axis. */
export declare function segmentsHeight(segments: readonly DayLaneSegment[]): number;
/** Vertical position of a minute. Inside a fold it is the fold's top;
 * before the day 0, after it the full height. Binary search. */
export declare function minuteToY(segments: readonly DayLaneSegment[], minute: number, hourHeight: number): number;
/** A vertical span to lay out in columns. */
export interface ColumnInput {
    top: number;
    bottom: number;
}
export interface ColumnResult<T extends ColumnInput> {
    placed: Array<{
        entry: T;
        column: number;
        columns: number;
    }>;
    /** Groups of entries that did not fit, each shown as one card in the last column. */
    overflows: Array<{
        entries: T[];
        top: number;
        column: number;
        columns: number;
    }>;
}
/**
 * Interval partitioning: sort by top, split into clusters of overlapping
 * spans, give each span the first column that is free at its top. A
 * cluster that needs more than `maxColumns` keeps the first
 * `maxColumns - 1` columns and moves the rest into overflow groups in the
 * last column, one group per run of hidden spans that would overlap a
 * card of `minHeight` placed at the run's first top. Nothing is dropped.
 */
export declare function placeColumns<T extends ColumnInput>(entries: readonly T[], maxColumns: number, minHeight: number): ColumnResult<T>;
/** Place timed items on already-built segments (once per lane). */
export declare function placeDayLaneItems(items: readonly DayLaneItem[], segments: readonly DayLaneSegment[], options: DayLaneLayoutOptions): DayLaneEntry[];
/** Lay out one day: axis rows, timed items in columns, and the date-only strip. */
export declare function layoutDayLane(items: readonly DayLaneItem[], options: DayLaneLayoutOptions): DayLaneLayout;
/** One column of a multi-lane day, such as a person. */
export interface DayLaneLane {
    key: string;
    label: string;
}
export interface DayLaneLanesLayout extends Omit<DayLaneLayout, "entries"> {
    /** Entries per lane, in the order of `laneKeys`. */
    lanes: Array<{
        key: string;
        entries: DayLaneEntry[];
    }>;
    /** Ids of timed items in the day whose lanes are all missing from `laneKeys`. */
    unassigned: string[];
}
/** The lane keys an item belongs to. */
export declare function lanesOf(item: DayLaneItem): readonly string[];
/**
 * Several lanes on one axis ("By person"). Rows are shared, so the hours
 * line up across lanes; a fold needs every lane to be empty. Each lane then
 * gets the same column and overflow rules as a single lane. An item with
 * several lane keys appears in each of those lanes.
 */
export declare function layoutDayLanes(items: readonly DayLaneItem[], laneKeys: readonly string[], options: DayLaneLayoutOptions): DayLaneLanesLayout;
/** Hour ticks for a plain day: one per hour, labelled by `label(hour)`.
 * Apps with DST days pass their own ticks instead. */
export declare function hourTicks(dayMinutes: number, label: (hour: number) => string): DayLaneTick[];
export interface DayLanePlacedTick extends DayLaneTick {
    top: number;
    /** The tick opens a folded band: draw the label, not the line. */
    atFold: boolean;
}
/** Position ticks on the axis. Ticks inside a fold are dropped, except
 * one at the fold's first minute, which labels the band. */
export declare function placeTicks(ticks: readonly DayLaneTick[], segments: readonly DayLaneSegment[], hourHeight: number): DayLanePlacedTick[];
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
