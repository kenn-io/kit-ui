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
export type WeekStart = "monday" | "sunday";
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
/* `| undefined` on the optional labels keeps wrapper consumers with
 * exactOptionalPropertyTypes happy: they forward possibly-undefined values
 * explicitly, and omission/undefined both mean "use Calendar's default". */
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

export const DEFAULT_RANGE_PRESETS: RangePreset[] = [
  { label: "7d", longLabel: "Last 7 days", days: 7 },
  { label: "30d", longLabel: "Last 30 days", days: 30 },
  { label: "90d", longLabel: "Last 90 days", days: 90 },
  { label: "1y", longLabel: "Last year", days: 365 },
  { label: "All", longLabel: "All time", days: 0 },
];

/** Parse and format civil dates without local timezone transitions. */
function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function dateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
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
 * Day is a single date; week starts on Monday unless weekStart is sunday; month is the
 * calendar month.
 */
export function periodBounds(
  unit: CalendarUnit,
  anchor: string,
  weekStart: WeekStart = "monday",
): DateRange {
  const d = parseDate(anchor);
  if (unit === "day") {
    return { from: anchor, to: anchor };
  }
  if (unit === "week") {
    // getUTCDay(): 0=Sun..6=Sat.
    const offset = (d.getUTCDay() + (weekStart === "sunday" ? 0 : 6)) % 7;
    const first = new Date(d);
    first.setUTCDate(d.getUTCDate() - offset);
    const last = new Date(first);
    last.setUTCDate(first.getUTCDate() + 6);
    return { from: dateStr(first), to: dateStr(last) };
  }
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return { from: `${anchor.slice(0, 7)}-01`, to: dateStr(d) };
}

/**
 * Move a calendar anchor one period in `dir`: one day, seven days, or one
 * calendar month (clamping the day so Jan 31 -> Feb 28 rather than
 * overflowing into March).
 */
export function stepAnchor(unit: CalendarUnit, anchor: string, dir: -1 | 1): string {
  const d = parseDate(anchor);
  if (unit === "day") {
    d.setUTCDate(d.getUTCDate() + dir);
  } else if (unit === "week") {
    d.setUTCDate(d.getUTCDate() + 7 * dir);
  } else {
    return shiftMonths(anchor, dir);
  }
  return dateStr(d);
}

/** Move `anchor` by `months` calendar months, clamping the day to the
 * target month's length (Jan 31 + 1 → Feb 28; Feb 29 + 12 → Feb 28). */
export function shiftMonths(anchor: string, months: number): string {
  const d = parseDate(anchor);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months + 1, 0);
  d.setUTCDate(Math.min(day, d.getUTCDate()));
  return dateStr(d);
}

/**
 * The date a day-grid key moves focus to from `from`, following the
 * WAI-ARIA APG date picker grid: arrows move a day or a week, Home/End go
 * to the ends of the week (by `weekStart`), PageUp/PageDown move a month
 * and with Shift a year. Returns null for any other key. `rtl` swaps the
 * horizontal arrows.
 */
export function dayGridKeyTarget(
  key: string,
  from: string,
  options: { shiftKey?: boolean; weekStart?: WeekStart; rtl?: boolean } = {},
): string | null {
  const { shiftKey = false, weekStart = "monday", rtl = false } = options;
  const back = rtl ? 1 : -1;
  switch (key) {
    case "ArrowLeft":
      return addDays(from, back);
    case "ArrowRight":
      return addDays(from, -back);
    case "ArrowUp":
      return addDays(from, -7);
    case "ArrowDown":
      return addDays(from, 7);
    case "Home":
      return periodBounds("week", from, weekStart).from;
    case "End":
      return periodBounds("week", from, weekStart).to;
    case "PageUp":
      return shiftMonths(from, shiftKey ? -12 : -1);
    case "PageDown":
      return shiftMonths(from, shiftKey ? 12 : 1);
    default:
      return null;
  }
}

function addDays(anchor: string, days: number): string {
  const d = parseDate(anchor);
  d.setUTCDate(d.getUTCDate() + days);
  return dateStr(d);
}

/**
 * The 42 dates (six weeks, Monday-first by default) covering `anchor`'s month — the
 * cells of a fixed-height month grid. Leading/trailing dates belong to the
 * adjacent months.
 */
export function monthGridDates(anchor: string, weekStart: WeekStart = "monday"): string[] {
  const first = parseDate(`${anchor.slice(0, 7)}-01`);
  const offset = (first.getUTCDay() + (weekStart === "sunday" ? 0 : 6)) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return dateStr(day);
  });
}

/* Locale label tables and formatters are memoized at module scope:
 * every toLocaleDateString call constructs a fresh Intl.DateTimeFormat
 * (locale resolution + ICU setup). Keyed by (locale, options) — the browser
 * locale can't change within a page load, and an app-provided `locale` gets
 * its own entry, so a language switch just fills a new slot. Lazy so
 * importing this module stays side-effect free (and SSR-safe).
 *
 * Like date strings, `locale` is trusted input: Intl throws a RangeError on
 * malformed BCP 47 tags, so validate app-provided values (e.g. persisted
 * settings) before passing them down.
 *
 * Both caches are size-capped (FIFO eviction) so a server that renders with
 * many distinct request-derived locales can't grow them without bound. The
 * cap is far above what one app's locale set reaches, so eviction never
 * happens client-side. */
const CACHE_MAX = 64;

function capped<V>(cache: Map<string, V>, key: string, value: V): V {
  if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, value);
  return value;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions, locale?: string): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  return formatters.get(key) ?? capped(formatters, key, new Intl.DateTimeFormat(locale, options));
}

const labelTables = new Map<string, string[]>();

function labelTable(key: string, build: () => string[]): string[] {
  return labelTables.get(key) ?? capped(labelTables, key, build());
}

/** Configurable first weekday, Monday by default. Weekday column labels ("Mon", …, or
 * "M", … with `style` "narrow"). `locale` is a BCP 47 tag; omitted = the browser locale. */
export function weekdayLabels(
  locale?: string,
  weekStart: WeekStart = "monday",
  style: "short" | "narrow" = "short",
): string[] {
  // 2024-01-01 is a Monday. Sliced so callers can't mutate the shared cache.
  return labelTable(`weekdays-${style}|${locale ?? ""}|${weekStart}`, () => {
    const fmt = formatter({ weekday: style }, locale);
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, (weekStart === "sunday" ? 7 : 1) + i)),
    );
  }).slice();
}

/** January-first month labels ("Jan"/"January", …). `locale` omitted = the
 * browser locale. */
export function monthLabels(style: "short" | "long", locale?: string): string[] {
  // Sliced so callers can't mutate the shared cache.
  return labelTable(`months-${style}|${locale ?? ""}`, () => {
    const fmt = formatter({ month: style }, locale);
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
  }).slice();
}

/** Turn any selection into concrete inclusive {from, to} bounds. */
export function resolveRange(
  sel: RangeSelection,
  earliestDate?: string | null,
  weekStart: WeekStart = "monday",
): DateRange {
  switch (sel.mode) {
    case "relative":
      return presetRange(sel.days, earliestDate);
    case "calendar":
      return periodBounds(sel.unit, sel.anchor, weekStart);
    case "custom":
      return { from: sel.from, to: sel.to };
  }
}

/** "Jun 29" style short label. `locale` omitted = the browser locale. */
export function formatShortDate(date: string, locale?: string): string {
  return formatter({ month: "short", day: "numeric", timeZone: "UTC" }, locale).format(
    parseDate(date),
  );
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
  return formatter(
    { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
    locale,
  ).format(parseDate(anchor));
}

/** "Monday, June 29, 2026" style label for a calendar day cell: the full
 * date with its weekday, since the grid's weekday headers are visual
 * only. `locale` omitted = the browser locale. */
export function formatDayCellLabel(anchor: string, locale?: string): string {
  return formatter(
    { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
    locale,
  ).format(parseDate(anchor));
}

/** "June 2026" style label for a month anchor. `locale` omitted = the
 * browser locale. */
export function formatMonthLabel(anchor: string, locale?: string): string {
  return formatter({ year: "numeric", month: "long", timeZone: "UTC" }, locale).format(
    parseDate(anchor),
  );
}

/** Shade step for a day's activity count, from 0 (none) to 4 (busiest),
 * relative to `max`, the busiest count in view: each step covers a quarter
 * of `max`, and any count above zero gets at least step 1. */
export function activityStep(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(count > 0) || !(max > 0)) return 0;
  return Math.min(4, Math.ceil((count / max) * 4)) as 1 | 2 | 3 | 4;
}
