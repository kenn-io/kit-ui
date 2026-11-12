/*
 * Typed, natural-language date entry for DatePicker and DateRangePicker.
 *
 * parseDatePhrase() turns text such as "tomorrow", "Sep 10 to Oct 20",
 * "last 30 days" or "since March" into a single date or an inclusive
 * from/to range of local-timezone YYYY-MM-DD strings, the same convention
 * as date-range.ts. completeDatePhrase() predicts the rest of the word
 * being typed, for inline ghost text.
 *
 * Hand-written and dependency-free on purpose: apps consume kit-ui as
 * source, so a parsing library would become every app's dependency.
 *
 * Month and weekday names come from Intl for the given locale, and English
 * names are always accepted too. Relative keywords ("today", "last",
 * "since", "ago", ...) are English only for now. Numeric dates ("10/9")
 * take their day/month order from the locale, never a hard-coded US order.
 *
 * Out of scope: sets of non-contiguous days ("last 3 Fridays", "weekends
 * since October") and times of day. They are no match, never a wrong range.
 */

import {
  localDateStr,
  periodBounds,
  todayStr,
  type DateRange,
  type WeekStart,
} from "./date-range.js";

export interface DatePhraseOptions {
  /** "Today" as YYYY-MM-DD; injected so results are deterministic.
   * Defaults to the local current date. */
  today?: string | undefined;
  /** BCP 47 tag for month/weekday names and numeric day/month order.
   * Omitted = the browser locale. */
  locale?: string | undefined;
  /** First weekday for "this week", "last Friday" and the like. */
  weekStart?: WeekStart | undefined;
  /** Latest allowed date (YYYY-MM-DD). A later single date is no match; a
   * range is clamped to it. */
  maxDate?: string | null | undefined;
  /** Earliest allowed date (YYYY-MM-DD). An earlier single date is no
   * match; a range is clamped to it. */
  earliestDate?: string | null | undefined;
}

/** What a typed phrase means: one day, an inclusive range, or nothing. */
export type DatePhraseResult =
  | { kind: "date"; date: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "none" };

const NONE: DatePhraseResult = { kind: "none" };

type Unit = "day" | "week" | "month" | "year";

/** An intermediate parse: a range plus whether it is one day and whether
 * the text named its year (so the other end of a range can inherit it). */
interface Span {
  from: string;
  to: string;
  single: boolean;
  explicitYear: boolean;
}

interface Ctx {
  today: string;
  year: number;
  weekStart: WeekStart;
  words: LocaleWords;
}

/* ---------- date arithmetic on YYYY-MM-DD strings (local time) ---------- */

function parts(iso: string): [number, number, number] {
  return [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))];
}

/** A valid calendar date as YYYY-MM-DD, or null (Feb 30, month 13, ...).
 * setFullYear avoids Date's 0–99 → 1900s mapping. */
function makeDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(2000, 0, 1);
  d.setFullYear(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return localDateStr(d);
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const date = new Date(2000, 0, 1);
  date.setFullYear(y, m, d + n);
  return localDateStr(date);
}

/** Shift by whole months, clamping the day (Mar 31 − 1 month → Feb 28). */
function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const total = y * 12 + m + n;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const last = new Date(2000, 0, 1);
  last.setFullYear(year, month + 1, 0);
  return makeDate(year, month, Math.min(d, last.getDate())) as string;
}

function shift(iso: string, unit: Unit, n: number): string {
  if (unit === "day") return addDays(iso, n);
  if (unit === "week") return addDays(iso, 7 * n);
  if (unit === "month") return addMonths(iso, n);
  return addMonths(iso, 12 * n);
}

function monthSpan(year: number, month: number, explicitYear: boolean): Span {
  const from = makeDate(year, month, 1) as string;
  return { from, to: addDays(addMonths(from, 1), -1), single: false, explicitYear };
}

/** Inclusive number of days from `from` to `to` (both YYYY-MM-DD). */
export function daysInRange(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm, td) - Date.UTC(fy, fm, fd)) / 86_400_000) + 1;
}

/* ---------- locale word tables ---------- */

interface LocaleWords {
  /** Normalized month name/abbreviation → month index (0–11). */
  months: Map<string, number>;
  /** Normalized weekday name/abbreviation → getDay() index (0 = Sunday). */
  weekdays: Map<string, number>;
  /** Order of day and month in the locale's numeric dates. */
  dayFirst: boolean;
  /** Display names offered for completion, locale first then English. */
  monthNames: string[];
  weekdayNames: string[];
}

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const ENGLISH_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const ENGLISH_EXTRA_MONTHS: Record<string, number> = { sept: 8 };
const ENGLISH_EXTRA_WEEKDAYS: Record<string, number> = {
  tues: 2,
  weds: 3,
  thur: 4,
  thurs: 4,
};

/** Lowercase, strip diacritics, so "Févr." and "fevr" meet. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** A name as it appears in typed text: folded, without a trailing period. */
function nameKey(s: string): string {
  return fold(s).trim().replace(/\.$/, "");
}

const wordCache = new Map<string, LocaleWords>();

function localeWords(locale: string | undefined): LocaleWords {
  const key = locale ?? "";
  const cached = wordCache.get(key);
  if (cached) return cached;

  const months = new Map<string, number>();
  const weekdays = new Map<string, number>();
  const monthNames: string[] = [];
  const weekdayNames: string[] = [];
  const add = <T>(map: Map<string, T>, name: string, value: T) => {
    const k = nameKey(name);
    // Only words: a locale whose "month name" is a number ("9月") adds nothing.
    if (/^\p{L}+$/u.test(k) && !map.has(k)) map.set(k, value);
  };

  for (const loc of [locale, "en"]) {
    for (const style of ["long", "short"] as const) {
      const standalone = new Intl.DateTimeFormat(loc, { month: style });
      // Format-context forms differ in some languages (Russian "сентября").
      const inDate = new Intl.DateTimeFormat(loc, { month: style, day: "numeric" });
      for (let m = 0; m < 12; m++) {
        const date = new Date(2024, m, 1);
        const name = standalone.format(date);
        add(months, name, m);
        if (style === "long" && /^\p{L}+$/u.test(nameKey(name))) monthNames.push(name);
        const part = inDate.formatToParts(date).find((p) => p.type === "month")?.value;
        if (part) add(months, part, m);
      }
      const weekday = new Intl.DateTimeFormat(loc, { weekday: style });
      for (let w = 0; w < 7; w++) {
        // 2024-01-07 is a Sunday.
        const name = weekday.format(new Date(2024, 0, 7 + w));
        add(weekdays, name, w);
        if (style === "long" && /^\p{L}+$/u.test(nameKey(name))) weekdayNames.push(name);
      }
    }
  }
  ENGLISH_MONTHS.forEach((name, m) => add(months, name, m));
  ENGLISH_WEEKDAYS.forEach((name, w) => add(weekdays, name, w));
  for (const [name, m] of Object.entries(ENGLISH_EXTRA_MONTHS)) add(months, name, m);
  for (const [name, w] of Object.entries(ENGLISH_EXTRA_WEEKDAYS)) add(weekdays, name, w);

  const order = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
    .formatToParts(new Date(2026, 10, 23))
    .map((p) => p.type)
    .filter((t) => t === "day" || t === "month");

  const words: LocaleWords = {
    months,
    weekdays,
    dayFirst: order[0] === "day",
    monthNames: [...new Set([...monthNames, ...ENGLISH_MONTHS])],
    weekdayNames: [...new Set([...weekdayNames, ...ENGLISH_WEEKDAYS])],
  };
  // Same bounded-cache policy as date-range.ts's formatters.
  if (wordCache.size >= 64) wordCache.delete(wordCache.keys().next().value as string);
  wordCache.set(key, words);
  return words;
}

/* ---------- tokens ---------- */

const UNITS: Record<string, Unit> = {
  day: "day",
  days: "day",
  week: "week",
  weeks: "week",
  wk: "week",
  wks: "week",
  month: "month",
  months: "month",
  mo: "month",
  mos: "month",
  year: "year",
  years: "year",
  yr: "year",
  yrs: "year",
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function count(token: string | undefined): number | null {
  if (token === undefined) return null;
  if (/^\d{1,4}$/.test(token)) {
    const n = Number(token);
    return n > 0 ? n : null;
  }
  return NUMBER_WORDS[token] ?? null;
}

function dayNumber(token: string | undefined): number | null {
  if (token === undefined || !/^\d{1,2}$/.test(token)) return null;
  const n = Number(token);
  return n >= 1 && n <= 31 ? n : null;
}

/** A 2- or 4-digit year. Two digits slide around today: within 20 years
 * ahead, otherwise the past century ("26" → 2026, "99" → 1999). */
function yearNumber(token: string | undefined, thisYear: number): number | null {
  if (token === undefined) return null;
  if (/^\d{4}$/.test(token)) return Number(token);
  if (!/^\d{2}$/.test(token)) return null;
  const yy = Number(token);
  let year = thisYear - (thisYear % 100) + yy;
  if (year > thisYear + 20) year -= 100;
  else if (year < thisYear - 79) year += 100;
  return year;
}

/** Normalize typed text: fold case/diacritics, drop commas, ordinals and
 * filler words, and space out dash separators. */
function normalizePhrase(text: string): string {
  return (
    fold(text)
      .replace(/[–—]/g, " - ")
      .replace(/[,?!]/g, " ")
      .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, "$1")
      .replace(/\b(\d{1,2})\.(?=\s|$)/g, "$1")
      .split(/\s+/)
      .filter((t) => t !== "" && t !== "the" && t !== "of")
      // Abbreviation periods: "Sept." / "févr." → "sept" / "fevr".
      .map((t) => (/^\p{L}+\.$/u.test(t) ? t.slice(0, -1) : t))
      .join(" ")
  );
}

/* ---------- span grammar ---------- */

function single(date: string | null, explicitYear = false): Span | null {
  return date ? { from: date, to: date, single: true, explicitYear } : null;
}

function range(from: string, to: string): Span {
  return { from, to, single: false, explicitYear: true };
}

function weekdayIn(weekOf: string, weekday: number, ctx: Ctx): string {
  const start = periodBounds("week", weekOf, ctx.weekStart).from;
  const startDow = ctx.weekStart === "sunday" ? 0 : 1;
  return addDays(start, (weekday - startDow + 7) % 7);
}

function monthDay(
  month: number,
  day: number,
  yearToken: string | undefined,
  ctx: Ctx,
  yearHint?: number,
): Span | null {
  if (yearToken !== undefined) {
    const year = yearNumber(yearToken, ctx.year);
    return year === null ? null : single(makeDate(year, month, day), true);
  }
  return single(makeDate(yearHint ?? ctx.year, month, day));
}

/** One date or one period, without range separators. `yearHint` is the
 * year to assume when the text names none (the other end of a range). */
function parseSpan(text: string, ctx: Ctx, yearHint?: number): Span | null {
  const toks = text.split(" ");
  const [a, b, c] = toks;
  const n = toks.length;
  const { months, weekdays } = ctx.words;

  if (n === 1) {
    if (a === "today" || a === "now") return single(ctx.today);
    if (a === "yesterday") return single(addDays(ctx.today, -1));
    if (a === "tomorrow") return single(addDays(ctx.today, 1));
  }

  // ISO-style year first: 2026-09-10, 2026/9/10.
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (m) return single(makeDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])), true);

  // Numeric day and month in the locale's order, optional trailing year.
  m = /^(\d{1,2})([-/.])(\d{1,2})(?:\2(\d{2}|\d{4}))?$/.exec(text);
  if (m) {
    const [first, second] = [Number(m[1]), Number(m[3])];
    const [day, month] = ctx.words.dayFirst ? [first, second] : [second, first];
    if (m[4] !== undefined) return monthDay(month - 1, day, m[4], ctx);
    return monthDay(month - 1, day, undefined, ctx, yearHint);
  }

  // A bare year: the whole year.
  if (n === 1 && /^\d{4}$/.test(a!)) {
    return range(`${a}-01-01`, `${a}-12-31`);
  }

  // Month names: "September", "Sep 2026", "Sep 10", "10 Sep", "Sep 10 2026".
  // A leading weekday is allowed and ignored ("Fri Sep 10").
  if (n >= 2 && weekdays.has(a!) && !months.has(a!)) {
    const rest = parseSpan(toks.slice(1).join(" "), ctx, yearHint);
    if (rest?.single) return rest;
  }
  if (months.has(a!)) {
    const month = months.get(a!)!;
    if (n === 1) return monthSpan(yearHint ?? ctx.year, month, false);
    if (n === 2 && /^\d{4}$/.test(b!)) return monthSpan(Number(b), month, true);
    const day = dayNumber(b);
    if (day !== null && n === 2) return monthDay(month, day, undefined, ctx, yearHint);
    if (day !== null && n === 3) return monthDay(month, day, c, ctx);
    return null;
  }
  if (n >= 2 && n <= 3 && dayNumber(a) !== null && months.has(b!)) {
    return monthDay(months.get(b!)!, dayNumber(a)!, c, ctx, yearHint);
  }

  // "3 days ago", "a week ago".
  if (n === 3 && c === "ago" && UNITS[b!] && count(a) !== null) {
    return single(shift(ctx.today, UNITS[b!]!, -count(a)!));
  }
  // "in 3 days", "in a week".
  if (n === 3 && a === "in" && UNITS[c!] && count(b) !== null) {
    return single(shift(ctx.today, UNITS[c!]!, count(b)!));
  }

  // Weekdays: "Friday", "this Friday", "last Friday", "next Friday" — the
  // Friday of the current, previous or next week (weekStart decides).
  if (n === 1 && weekdays.has(a!)) return single(weekdayIn(ctx.today, weekdays.get(a!)!, ctx));
  if (n === 2 && /^(this|last|next)$/.test(a!) && weekdays.has(b!)) {
    const offset = a === "last" ? -7 : a === "next" ? 7 : 0;
    return single(weekdayIn(addDays(ctx.today, offset), weekdays.get(b!)!, ctx));
  }

  // Calendar periods: "this week", "last month", "next year".
  if (n === 2 && /^(this|last|next)$/.test(a!) && /^(week|month|year)$/.test(b!)) {
    const dir = a === "last" ? -1 : a === "next" ? 1 : 0;
    const anchor = shift(ctx.today, b as Unit, dir);
    if (b === "year") {
      const y = anchor.slice(0, 4);
      return range(`${y}-01-01`, `${y}-12-31`);
    }
    const bounds = periodBounds(b as "week" | "month", anchor, ctx.weekStart);
    return range(bounds.from, bounds.to);
  }

  // Rolling windows ending today: "last 30 days", "past 2 weeks", and
  // "past week" for one unit. Inclusive of today, like presetRange().
  if (/^(last|past)$/.test(a!)) {
    const amount = n === 3 ? count(b) : n === 2 && a === "past" ? 1 : null;
    const unit = n === 3 ? UNITS[c!] : UNITS[b!];
    if (amount !== null && unit && (n === 3 || a === "past")) {
      return range(addDays(shift(ctx.today, unit, -amount), 1), ctx.today);
    }
  }
  // Rolling windows starting today: "next 10 days".
  if (n === 3 && a === "next" && count(b) !== null && UNITS[c!]) {
    return range(ctx.today, addDays(shift(ctx.today, UNITS[c!]!, count(b)!), -1));
  }

  return null;
}

const SEPARATORS = [" to ", " until ", " till ", " through ", " thru ", " - "];

/** Split `text` at every occurrence of `sep`, as [left, right] pairs. */
function splits(text: string, sep: string): [string, string][] {
  const out: [string, string][] = [];
  let i = text.indexOf(sep);
  while (i > 0) {
    out.push([text.slice(0, i).trim(), text.slice(i + sep.length).trim()]);
    i = text.indexOf(sep, i + 1);
  }
  return out;
}

function joinRange(left: Span, rightText: string, ctx: Ctx): Span | null {
  if (rightText === "") return null;
  const hint = left.explicitYear ? Number(left.to.slice(0, 4)) : undefined;
  let right = parseSpan(rightText, ctx, hint);
  // "Sep 10 to 20": a bare day continues the left end's month.
  const day = right ? null : dayNumber(rightText);
  if (day !== null) {
    const [y, mo] = parts(left.to);
    right = single(makeDate(y, mo, day));
  }
  if (!right) return null;
  // An end with no year of its own that falls before the start either
  // crosses into the next year ("Dec 20 to Jan 5") or was typed backwards
  // ("Oct 20 to Sep 10"). Take whichever reading is the shorter range.
  if (right.from < left.from && !right.explicitYear && day === null) {
    const rolled = parseSpan(rightText, ctx, Number(left.to.slice(0, 4)) + 1);
    if (rolled && daysInRange(left.from, rolled.to) < daysInRange(right.from, left.to)) {
      return { from: left.from, to: rolled.to, single: false, explicitYear: true };
    }
  }
  // Typed backwards ("Oct 20 to Sep 10") swaps the ends.
  const from = left.from < right.from ? left.from : right.from;
  const to = left.to > right.to ? left.to : right.to;
  return { from, to, single: false, explicitYear: true };
}

function parseExpr(text: string, ctx: Ctx): Span | null {
  const whole = parseSpan(text, ctx);
  if (whole) return whole;

  // "since March", "since Sep 10": from then through today. A start with no
  // year that would land after today means last year's ("since October"
  // typed in February).
  const since = /^since (.+)$/.exec(text);
  if (since) {
    let start = parseSpan(since[1]!, ctx);
    if (start && !start.explicitYear && start.from > ctx.today) {
      start = parseSpan(since[1]!, ctx, ctx.year - 1);
    }
    return start ? { from: start.from, to: ctx.today, single: false, explicitYear: true } : null;
  }

  // "from X to Y", "between X and Y", "X - Y", "X through Y", ...
  let body = text;
  const seps = [...SEPARATORS];
  if (body.startsWith("from ")) body = body.slice(5);
  else if (body.startsWith("between ")) {
    body = body.slice(8);
    seps.unshift(" and ");
  }
  for (const sep of seps) {
    for (const [l, r] of splits(body, sep)) {
      const left = parseSpan(l, ctx);
      const joined = left && joinRange(left, r, ctx);
      if (joined) return joined;
    }
  }
  // An unspaced hyphen: "Sep 10-20", "Sep 10-Oct 20". Only with a word in
  // the text, so an invalid numeric date ("2026-13-01") never splits into
  // a year and a different date.
  if (!/\p{L}/u.test(body)) return null;
  for (const [l, r] of splits(body, "-")) {
    const left = parseSpan(l, ctx);
    const joined = left && joinRange(left, r, ctx);
    if (joined) return joined;
  }
  return null;
}

function bound(date: string | null | undefined): string | null {
  return date && date.length >= 10 ? date.slice(0, 10) : null;
}

/**
 * Parse typed text into a single date, an inclusive range, or no match.
 * Dates are local-timezone YYYY-MM-DD strings.
 *
 * Accepted (case-insensitive, extra spaces and month/weekday abbreviations
 * fine, English names always accepted alongside the locale's):
 * - single dates: today, yesterday, tomorrow; Friday, this/last/next
 *   Friday (that weekday in the current/previous/next week); Sep 10,
 *   10 Sep, Sep 10 2026, 10th September; 2026-09-10; 10/9, 10/9/26 in the
 *   locale's day/month order (`-` and `.` work as separators too);
 *   3 days ago, in 2 weeks.
 * - ranges: X to/until/through/- Y (also "from X to Y", "between X and
 *   Y", "Sep 10-20"); since X (through today); this/last/next
 *   week/month/year; last/past N days/weeks/months/years (ending today);
 *   next N days (starting today); September, Sep 2026; 2026.
 *
 * A missing year is the current year (the other end's year inside a range;
 * last year for "since <month>" that would otherwise start after today).
 * Two-digit years slide around today. A range typed backwards is swapped.
 * A single date outside maxDate/earliestDate is no match; a range is
 * clamped to them, and is no match when nothing is left.
 */
export function parseDatePhrase(text: string, options: DatePhraseOptions = {}): DatePhraseResult {
  const today = options.today ?? todayStr();
  const ctx: Ctx = {
    today,
    year: Number(today.slice(0, 4)),
    weekStart: options.weekStart ?? "monday",
    words: localeWords(options.locale),
  };
  const normalized = normalizePhrase(text);
  if (normalized === "") return NONE;
  const span = parseExpr(normalized, ctx);
  if (!span) return NONE;

  const lo = bound(options.earliestDate);
  const hi = bound(options.maxDate);
  if (span.single) {
    if ((lo && span.from < lo) || (hi && span.from > hi)) return NONE;
    return { kind: "date", date: span.from };
  }
  const from = lo && span.from < lo ? lo : span.from;
  const to = hi && span.to > hi ? hi : span.to;
  if (from > to) return NONE;
  return { kind: "range", from, to };
}

/** A parse result as a {from, to} range (a single date is a one-day
 * range), or null for no match. */
export function datePhraseRange(result: DatePhraseResult): DateRange | null {
  if (result.kind === "date") return { from: result.date, to: result.date };
  if (result.kind === "range") return { from: result.from, to: result.to };
  return null;
}

/* ---------- completion ---------- */

const LEADING_KEYWORDS = [
  "today",
  "yesterday",
  "tomorrow",
  "last",
  "this",
  "next",
  "since",
  "past",
  "in",
];
// Offered after month and weekday names, so "Fr" predicts Friday.
const LATE_KEYWORDS = ["from", "between"];
const PERIODS = ["week", "month", "year"];
const PLURAL_UNITS = ["days", "weeks", "months", "years"];
const TRAILING_KEYWORDS = ["to", "through", "until", "ago", "and"];

/**
 * The rest of the word being typed, for inline ghost text: "Se" →
 * "ptember", "s" → "ince", "last 3 w" → "eeks". Returns "" when there is
 * nothing to suggest (empty text, a trailing space, a number, or a word
 * that is already complete).
 */
export function completeDatePhrase(
  text: string,
  options: { locale?: string | undefined } = {},
): string {
  const match = /(?:^|\s)(\p{L}+)$/u.exec(text);
  if (!match) return "";
  const typed = match[1]!;
  const before = text
    .slice(0, text.length - typed.length)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const prev = before.length ? fold(before[before.length - 1]!) : null;
  const words = localeWords(options.locale);

  let candidates: string[];
  if (prev !== null && count(prev) !== null && before.length >= 1) {
    // After a number: units ("3 days"), a range word ("Sep 10 to") or a
    // month ("10 September").
    const units = count(prev) === 1 ? ["day", "week", "month", "year"] : PLURAL_UNITS;
    candidates = [...units, ...TRAILING_KEYWORDS, ...words.monthNames];
  } else if (prev !== null && UNITS[prev]) {
    candidates = ["ago", ...TRAILING_KEYWORDS];
  } else if (prev === "last" || prev === "this" || prev === "next" || prev === "past") {
    candidates = [...PERIODS, ...words.weekdayNames];
  } else if (prev === null) {
    candidates = [
      ...LEADING_KEYWORDS,
      ...words.monthNames,
      ...words.weekdayNames,
      ...LATE_KEYWORDS,
    ];
  } else {
    candidates = [
      ...TRAILING_KEYWORDS,
      ...words.monthNames,
      ...words.weekdayNames,
      ...LEADING_KEYWORDS,
    ];
  }

  const lower = typed.toLowerCase();
  for (const word of candidates) {
    if (word.length > typed.length && word.toLowerCase().startsWith(lower)) {
      const rest = word.slice(typed.length);
      // Typing in capitals keeps the suggestion in capitals.
      return typed.length > 1 && typed === typed.toUpperCase() ? rest.toUpperCase() : rest;
    }
  }
  return "";
}

/* ---------- display ---------- */

const rangeFormatters = new Map<string, Intl.DateTimeFormat>();

/** "Sep 10 – Oct 20, 2026" (or "Sep 10, 2026" for one day) in the
 * locale's own range format. `locale` omitted = the browser locale. */
export function formatDateRangeLabel(from: string, to: string, locale?: string): string {
  const key = locale ?? "";
  let fmt = rangeFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
    if (rangeFormatters.size >= 64)
      rangeFormatters.delete(rangeFormatters.keys().next().value as string);
    rangeFormatters.set(key, fmt);
  }
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  const a = new Date(fy, fm, fd);
  if (from === to) return fmt.format(a);
  return fmt.formatRange(a, new Date(ty, tm, td));
}
