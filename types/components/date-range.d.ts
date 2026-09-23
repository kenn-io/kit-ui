/**
 * The three ways a user can pick a range with DateRangePicker. Consumers keep one
 * of these; resolveRange() turns any of them into a concrete {from, to}.
 *
 * - relative: a rolling window ending today (last N days; days === 0 means
 *   "all", anchored to `earliestDate`).
 * - calendar: a single day/week/month period the user can step through.
 * - custom: an explicit from/to span.
 */
export type RangeMode = "relative" | "calendar" | "custom";
export type CalendarUnit = "day" | "week" | "month";
export interface RelativeSelection {
    mode: "relative";
    days: number;
}
export interface CalendarSelection {
    mode: "calendar";
    unit: CalendarUnit;
    /** Any YYYY-MM-DD inside the period; bounds derive from it. */
    anchor: string;
}
export interface CustomSelection {
    mode: "custom";
    from: string;
    to: string;
}
export type RangeSelection = RelativeSelection | CalendarSelection | CustomSelection;
export interface DateRange {
    from: string;
    to: string;
}
/**
 * Calendar's i18n-able nav/drill-down labels. DateRangePicker accepts the
 * same keys and forwards them verbatim, so the set (and Calendar's English
 * defaults) live in one place.
 */
export interface CalendarNavLabels {
    previousMonthLabel?: string | undefined;
    nextMonthLabel?: string | undefined;
    /** Nav labels while zoomed out to the month / year grids. */
    previousYearLabel?: string | undefined;
    nextYearLabel?: string | undefined;
    previousYearsLabel?: string | undefined;
    nextYearsLabel?: string | undefined;
    /** Appended to the header button's accessible name to hint at the drill-down. */
    chooseMonthLabel?: string | undefined;
    chooseYearLabel?: string | undefined;
}
export interface RangePreset {
    /** Compact pill label. */
    label: string;
    /** Trigger-button label. */
    longLabel: string;
    /** Days back from today; 0 means all-time. */
    days: number;
}
export declare const DEFAULT_RANGE_PRESETS: RangePreset[];
/** Format a Date as a local-timezone YYYY-MM-DD string. */
export declare function localDateStr(d: Date): string;
/** Local date string for `n` days before today. */
export declare function daysAgo(n: number): string;
/** Today as a local YYYY-MM-DD string. */
export declare function todayStr(): string;
/**
 * The "from" bound of an all-time range: `earliestDate` when known,
 * otherwise one year back.
 */
export declare function allFromDate(earliestDate: string | null | undefined): string;
/**
 * The concrete bounds of a relative preset (days <= 0 means all-time —
 * 0 by contract; negatives are nonsensical and treated the same).
 * "Last N days" means N calendar days inclusive of today — today plus the
 * N−1 preceding dates — so with inclusive bounds `from` is daysAgo(N−1).
 */
export declare function presetRange(days: number, earliestDate?: string | null): DateRange;
/**
 * The inclusive from/to bounds of a calendar period containing `anchor`.
 * Day is a single date; week is the Monday-Sunday ISO week; month is the
 * calendar month.
 */
export declare function periodBounds(unit: CalendarUnit, anchor: string): DateRange;
/**
 * Move a calendar anchor one period in `dir`: one day, seven days, or one
 * calendar month (clamping the day so Jan 31 -> Feb 28 rather than
 * overflowing into March).
 */
export declare function stepAnchor(unit: CalendarUnit, anchor: string, dir: -1 | 1): string;
/**
 * The 42 dates (six Monday-first weeks) covering `anchor`'s month — the
 * cells of a fixed-height month grid. Leading/trailing dates belong to the
 * adjacent months.
 */
export declare function monthGridDates(anchor: string): string[];
/** Monday-first weekday column labels ("Mon", …). `locale` is a BCP 47 tag;
 * omitted = the browser locale. */
export declare function weekdayLabels(locale?: string): string[];
/** January-first month labels ("Jan"/"January", …). `locale` omitted = the
 * browser locale. */
export declare function monthLabels(style: "short" | "long", locale?: string): string[];
/** Turn any selection into concrete inclusive {from, to} bounds. */
export declare function resolveRange(sel: RangeSelection, earliestDate?: string | null): DateRange;
/** "Jun 29" style short label. `locale` omitted = the browser locale. */
export declare function formatShortDate(date: string, locale?: string): string;
/**
 * Apply a week trigger label template to a formatted week-start date.
 * A "{date}" placeholder is substituted, so date-first locales can put the
 * date anywhere ("{date}所在周"); a template without one is treated as a
 * prefix ("Week of" → "Week of Jun 29", the pre-template behavior).
 */
export declare function formatWeekOfLabel(template: string, dateLabel: string): string;
/** "Jun 29, 2026" style label for a day anchor. `locale` omitted = the
 * browser locale. */
export declare function formatDayLabel(anchor: string, locale?: string): string;
/** "June 2026" style label for a month anchor. `locale` omitted = the
 * browser locale. */
export declare function formatMonthLabel(anchor: string, locale?: string): string;
