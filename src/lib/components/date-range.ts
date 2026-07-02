/*
 * Types and pure date helpers for DateRangePicker.
 *
 * Ported from agentsview's `rangeSelection.ts` / `dateRangeSelector.ts`,
 * decoupled from its stores and i18n. All dates are local-timezone
 * YYYY-MM-DD strings; ranges are inclusive on both ends.
 */

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
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  /** Nav labels while zoomed out to the month / year grids. */
  previousYearLabel?: string;
  nextYearLabel?: string;
  previousYearsLabel?: string;
  nextYearsLabel?: string;
  /** Appended to the header button's accessible name to hint at the drill-down. */
  chooseMonthLabel?: string;
  chooseYearLabel?: string;
}

export interface RangePreset {
  /** Compact pill label. */
  label: string;
  /** Trigger-button label. */
  longLabel: string;
  /** Days back from today; 0 means all-time. */
  days: number;
}

export const DEFAULT_RANGE_PRESETS: RangePreset[] = [
  { label: "7d", longLabel: "Last 7 days", days: 7 },
  { label: "30d", longLabel: "Last 30 days", days: 30 },
  { label: "90d", longLabel: "Last 90 days", days: 90 },
  { label: "1y", longLabel: "Last year", days: 365 },
  { label: "All", longLabel: "All time", days: 0 },
];

/** Parse a YYYY-MM-DD date string as local midnight. */
function parseLocal(date: string): Date {
  return new Date(date + "T00:00:00");
}

/** Format a Date as a local-timezone YYYY-MM-DD string. */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local date string for `n` days before today. */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

/** Today as a local YYYY-MM-DD string. */
export function todayStr(): string {
  return localDateStr(new Date());
}

/**
 * The "from" bound of an all-time range: `earliestDate` when known,
 * otherwise one year back.
 */
export function allFromDate(earliestDate: string | null | undefined): string {
  if (earliestDate && earliestDate.length >= 10) {
    return earliestDate.slice(0, 10);
  }
  return daysAgo(365);
}

/**
 * The concrete bounds of a relative preset (days <= 0 means all-time —
 * 0 by contract; negatives are nonsensical and treated the same).
 * "Last N days" means N calendar days inclusive of today — today plus the
 * N−1 preceding dates — so with inclusive bounds `from` is daysAgo(N−1).
 */
export function presetRange(days: number, earliestDate?: string | null): DateRange {
  return {
    from: days <= 0 ? allFromDate(earliestDate) : daysAgo(days - 1),
    to: todayStr(),
  };
}

/**
 * The inclusive from/to bounds of a calendar period containing `anchor`.
 * Day is a single date; week is the Monday-Sunday ISO week; month is the
 * calendar month.
 */
export function periodBounds(unit: CalendarUnit, anchor: string): DateRange {
  const d = parseLocal(anchor);
  if (unit === "day") {
    return { from: anchor, to: anchor };
  }
  if (unit === "week") {
    // getDay(): 0=Sun..6=Sat. Days since Monday = (day + 6) % 7.
    const sinceMonday = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - sinceMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: localDateStr(monday), to: localDateStr(sunday) };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: localDateStr(first), to: localDateStr(last) };
}

/**
 * Move a calendar anchor one period in `dir`: one day, seven days, or one
 * calendar month (clamping the day so Jan 31 -> Feb 28 rather than
 * overflowing into March).
 */
export function stepAnchor(unit: CalendarUnit, anchor: string, dir: -1 | 1): string {
  const d = parseLocal(anchor);
  if (unit === "day") {
    d.setDate(d.getDate() + dir);
  } else if (unit === "week") {
    d.setDate(d.getDate() + 7 * dir);
  } else {
    const target = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), lastDay));
    d.setTime(target.getTime());
  }
  return localDateStr(d);
}

/**
 * The 42 dates (six Monday-first weeks) covering `anchor`'s month — the
 * cells of a fixed-height month grid. Leading/trailing dates belong to the
 * adjacent months.
 */
export function monthGridDates(anchor: string): string[] {
  const d = parseLocal(anchor);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const sinceMonday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - sinceMonday);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return localDateStr(day);
  });
}

/* Locale label tables and formatters are memoized at module scope:
 * every toLocaleDateString call constructs a fresh Intl.DateTimeFormat
 * (locale resolution + ICU setup). Keyed by (locale, options) — the browser
 * locale can't change within a page load, and an app-provided `locale` gets
 * its own entry, so a language switch just fills a new slot. Lazy so
 * importing this module stays side-effect free (and SSR-safe). */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions, locale?: string): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, fmt);
  }
  return fmt;
}

const labelTables = new Map<string, string[]>();

function labelTable(key: string, build: () => string[]): string[] {
  let table = labelTables.get(key);
  if (!table) {
    table = build();
    labelTables.set(key, table);
  }
  return table;
}

/** Monday-first weekday column labels ("Mon", …). `locale` is a BCP 47 tag;
 * omitted = the browser locale. */
export function weekdayLabels(locale?: string): string[] {
  // 2024-01-01 is a Monday.
  return labelTable(`weekdays|${locale ?? ""}`, () => {
    const fmt = formatter({ weekday: "short" }, locale);
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  });
}

/** January-first month labels ("Jan"/"January", …). `locale` omitted = the
 * browser locale. */
export function monthLabels(style: "short" | "long", locale?: string): string[] {
  return labelTable(`months-${style}|${locale ?? ""}`, () => {
    const fmt = formatter({ month: style }, locale);
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
  });
}

/** Turn any selection into concrete inclusive {from, to} bounds. */
export function resolveRange(sel: RangeSelection, earliestDate?: string | null): DateRange {
  switch (sel.mode) {
    case "relative":
      return presetRange(sel.days, earliestDate);
    case "calendar":
      return periodBounds(sel.unit, sel.anchor);
    case "custom":
      return { from: sel.from, to: sel.to };
  }
}

/** "Jun 29" style short label. `locale` omitted = the browser locale. */
export function formatShortDate(date: string, locale?: string): string {
  return formatter({ month: "short", day: "numeric" }, locale).format(parseLocal(date));
}

/**
 * Apply a week trigger label template to a formatted week-start date.
 * A "{date}" placeholder is substituted, so date-first locales can put the
 * date anywhere ("{date}所在周"); a template without one is treated as a
 * prefix ("Week of" → "Week of Jun 29", the pre-template behavior).
 */
export function formatWeekOfLabel(template: string, dateLabel: string): string {
  if (template.includes("{date}")) return template.replace("{date}", dateLabel);
  return `${template} ${dateLabel}`;
}

/** "Jun 29, 2026" style label for a day anchor. `locale` omitted = the
 * browser locale. */
export function formatDayLabel(anchor: string, locale?: string): string {
  return formatter({ year: "numeric", month: "short", day: "numeric" }, locale).format(
    parseLocal(anchor),
  );
}

/** "June 2026" style label for a month anchor. `locale` omitted = the
 * browser locale. */
export function formatMonthLabel(anchor: string, locale?: string): string {
  return formatter({ year: "numeric", month: "long" }, locale).format(parseLocal(anchor));
}
