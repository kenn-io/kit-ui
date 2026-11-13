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
 * since October"), times of day, non-Gregorian calendars and era years
 * (Buddhist-era 2569, Islamic or Persian months), and CJK numeric month
 * forms ("9月"). They are no match, never a wrong range.
 */

import {
  capped,
  daysInRange,
  localDateStr,
  periodBounds,
  todayStr,
  type DateRange,
  type WeekStart,
} from "./date-range.js";

/** Longest text the parser and completer look at. Typed dates are short;
 * the cap keeps a pasted wall of text from stalling every keystroke. */
export const DATE_PHRASE_MAX_LENGTH = 200;

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
  /** Also read sets of separate days ("last 3 Fridays", "weekends since
   * October") as `{ kind: "dates" }`. Off by default: without it those
   * phrases are no match. */
  sets?: boolean | undefined;
  /** Summary labels for weekend and weekday sets. */
  weekendsLabel?: string | undefined;
  weekdaysLabel?: string | undefined;
}

/** What a typed phrase means: one day, an inclusive range, a set of
 * separate days (only with `sets`), or nothing. */
export type DatePhraseResult =
  | {
      kind: "date";
      date: string;
      /** 1 when the text was "today": a rolling one-day window. */
      rollingDays?: number;
    }
  | {
      kind: "range";
      from: string;
      to: string;
      /** Set when the text was a rolling window ending today ("last 30
       * days", "past 2 weeks"): its length in days, today included, so a
       * picker can match it to a relative preset. Absent for anything
       * else, including a window cut short by the bounds. */
      rollingDays?: number;
    }
  | {
      kind: "dates";
      /** Ascending, unique YYYY-MM-DD days. */
      dates: string[];
      /** What the days are, for a summary: "Fridays", "Weekends". */
      label: string;
    }
  | { kind: "none" };

/** Most days a set may hold; a bigger one is no match. */
export const DATE_SET_MAX_DAYS = 366;

const NONE: DatePhraseResult = { kind: "none" };

type Unit = "day" | "week" | "month" | "year";

/** An intermediate parse: a range plus whether it is one day and whether
 * the text named its year (so the other end of a range can inherit it). */
interface Span {
  from: string;
  to: string;
  single: boolean;
  explicitYear: boolean;
  /** A rolling window ending today ("last 30 days", "today"). */
  rolling?: boolean;
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
  /** The locale's long weekday names, Sunday first, for set labels. */
  weekdayLong: string[];
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

/** Letters plus combining marks, so Thai and Devanagari names count as words. */
const WORD = /^[\p{L}\p{M}]+$/u;

function localeWords(locale: string | undefined): LocaleWords {
  const key = locale ?? "";
  const cached = wordCache.get(key);
  if (cached) return cached;
  let words: LocaleWords;
  try {
    words = buildLocaleWords(locale);
  } catch {
    // A malformed tag (Intl throws RangeError) falls back to the default.
    words = locale === undefined ? buildLocaleWords("en") : localeWords(undefined);
  }
  return capped(wordCache, key, words);
}

function buildLocaleWords(locale: string | undefined): LocaleWords {
  const months = new Map<string, number>();
  const weekdays = new Map<string, number>();
  const monthNames: string[] = [];
  const weekdayNames: string[] = [];
  const weekdayLong: string[] = [];
  const add = <T>(map: Map<string, T>, name: string, value: T) => {
    const k = nameKey(name);
    // Only words: a locale whose "month name" is a number ("9月") adds nothing.
    if (WORD.test(k) && !map.has(k)) map.set(k, value);
  };

  for (const loc of [locale, "en"]) {
    for (const style of ["long", "short"] as const) {
      // Always Gregorian month names: a Persian or Islamic default calendar
      // would otherwise map its own months onto Gregorian indexes.
      const standalone = new Intl.DateTimeFormat(loc, { month: style, calendar: "gregory" });
      // Format-context forms differ in some languages (Russian "сентября").
      const inDate = new Intl.DateTimeFormat(loc, {
        month: style,
        day: "numeric",
        calendar: "gregory",
      });
      for (let m = 0; m < 12; m++) {
        const date = new Date(2024, m, 1);
        const name = standalone.format(date);
        add(months, name, m);
        if (style === "long" && WORD.test(nameKey(name))) monthNames.push(name);
        const part = inDate.formatToParts(date).find((p) => p.type === "month")?.value;
        if (part) add(months, part, m);
      }
      const weekday = new Intl.DateTimeFormat(loc, { weekday: style, calendar: "gregory" });
      for (let w = 0; w < 7; w++) {
        // 2024-01-07 is a Sunday.
        const name = weekday.format(new Date(2024, 0, 7 + w));
        add(weekdays, name, w);
        if (style === "long" && WORD.test(nameKey(name))) weekdayNames.push(name);
        if (style === "long" && loc === locale) weekdayLong.push(name);
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
    calendar: "gregory",
    numberingSystem: "latn",
  })
    .formatToParts(new Date(2026, 10, 23))
    .map((p) => p.type)
    .filter((t) => t === "day" || t === "month");

  return {
    months,
    weekdays,
    dayFirst: order[0] === "day",
    monthNames: [...new Set([...monthNames, ...ENGLISH_MONTHS])],
    weekdayNames: [...new Set([...weekdayNames, ...ENGLISH_WEEKDAYS])],
    weekdayLong,
  };
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

/** A positive count: digits (up to 1000 years' worth of days) or a word. */
function count(token: string | undefined): number | null {
  if (token === undefined) return null;
  if (/^\d{1,6}$/.test(token)) {
    const n = Number(token);
    return n > 0 && n <= 366_000 ? n : null;
  }
  return NUMBER_WORDS[token] ?? null;
}

function dayNumber(token: string | undefined): number | null {
  if (token === undefined || !/^\d{1,2}$/.test(token)) return null;
  const n = Number(token);
  return n >= 1 && n <= 31 ? n : null;
}

/** A 4-digit year, or a 2-digit one: bare in numeric dates ("10/9/26"),
 * with an apostrophe after a month name ("Sep 10 '26"), so "Sep 10 15" (a
 * time, most likely) is no match. Two digits slide around today: within 20
 * years ahead, otherwise the past century ("26" → 2026, "99" → 1999). */
function yearNumber(
  token: string | undefined,
  thisYear: number,
  bareTwoDigits: boolean,
): number | null {
  if (token === undefined) return null;
  if (/^\d{4}$/.test(token)) return Number(token);
  const two = bareTwoDigits ? /^(\d{2})$/.exec(token) : /^'(\d{2})$/.exec(token);
  if (!two) return null;
  const yy = Number(two[1]);
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
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, " - ")
      .replace(/[,?!]/g, " ")
      .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, "$1")
      .replace(/\b(\d{1,2})\.(?=\s|$)/g, "$1")
      .split(/\s+/)
      .filter((t) => t !== "" && t !== "the" && t !== "of")
      // Abbreviation periods: "Sept." / "févr." → "sept" / "fevr".
      .map((t) => (/^[\p{L}\p{M}]+\.$/u.test(t) ? t.slice(0, -1) : t))
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
  numeric = false,
): Span | null {
  if (yearToken !== undefined) {
    const year = yearNumber(yearToken, ctx.year, numeric);
    return year === null ? null : single(makeDate(year, month, day), true);
  }
  return single(makeDate(yearHint ?? ctx.year, month, day));
}

/** One date or one period, without range separators. `yearHint` is the
 * year to assume when the text names none (the other end of a range). One
 * leading weekday is allowed when it agrees with the date ("Fri Sep 11");
 * one that contradicts it ("Mon Sep 10" in 2026) is no match. */
function parseSpan(text: string, ctx: Ctx, yearHint?: number): Span | null {
  const space = text.indexOf(" ");
  const head = space > 0 ? text.slice(0, space) : "";
  const { months, weekdays } = ctx.words;
  if (head && weekdays.has(head) && !months.has(head)) {
    const rest = parseCore(text.slice(space + 1), ctx, yearHint);
    if (!rest?.single) return null;
    const [y, m, d] = parts(rest.from);
    const date = new Date(2000, 0, 1);
    date.setFullYear(y, m, d);
    return date.getDay() === weekdays.get(head) ? rest : null;
  }
  return parseCore(text, ctx, yearHint);
}

/** parseSpan without the leading weekday. */
function parseCore(text: string, ctx: Ctx, yearHint?: number): Span | null {
  const toks = text.split(" ");
  const [a, b, c] = toks;
  const n = toks.length;
  const { months, weekdays } = ctx.words;

  if (n === 1) {
    if (a === "today" || a === "now") return { ...single(ctx.today)!, rolling: true };
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
    if (m[4] !== undefined) return monthDay(month - 1, day, m[4], ctx, undefined, true);
    return monthDay(month - 1, day, undefined, ctx, yearHint);
  }

  // A bare year: the whole year.
  if (n === 1 && /^\d{4}$/.test(a!)) {
    return range(`${a}-01-01`, `${a}-12-31`);
  }

  // Month names: "September", "Sep 2026", "Sep 10", "10 Sep", "Sep 10 2026".
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
      return { ...range(addDays(shift(ctx.today, unit, -amount), 1), ctx.today), rolling: true };
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

/** Join "<left> to <right>" into one range. */
function joinPair(leftText: string, rightText: string, ctx: Ctx): Span | null {
  let left = parseSpan(leftText, ctx);
  if (!left || rightText === "") return null;
  if (!left.explicitYear) {
    // Only the right end names a year ("Sep 10 - Oct 20 2025", "Jan to Mar
    // 2025"): the left end takes it, or the year before when that would put
    // it after the right end ("Dec 20 - Jan 5 2027").
    const right = parseSpan(rightText, ctx);
    if (right?.explicitYear) {
      const year = Number(right.from.slice(0, 4));
      let hinted = parseSpan(leftText, ctx, year);
      if (hinted && hinted.from > right.to) hinted = parseSpan(leftText, ctx, year - 1);
      if (hinted) left = hinted;
    }
  }
  return joinRange(left, rightText, ctx);
}

function joinRange(left: Span, rightText: string, ctx: Ctx): Span | null {
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
      const joined = joinPair(l, r, ctx);
      if (joined) return joined;
    }
  }
  // An unspaced hyphen: "Sep 10-20", "Sep 10-Oct 20". Only with a word in
  // the text, so an invalid numeric date ("2026-13-01") never splits into
  // a year and a different date.
  if (!/\p{L}/u.test(body)) return null;
  for (const [l, r] of splits(body, "-")) {
    const joined = joinPair(l, r, ctx);
    if (joined) return joined;
  }
  return null;
}

/* ---------- sets of separate days ---------- */

const WEEKENDS = [0, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

interface DayKind {
  days: number[];
  label: string;
}

/** "fridays", "fris", "weekends", "weekdays", or with `every`/`all` before
 * it a singular "friday"/"weekend". */
function dayKind(
  token: string,
  plural: boolean,
  ctx: Ctx,
  opts: DatePhraseOptions,
): DayKind | null {
  if (token === "weekends" || (!plural && token === "weekend")) {
    return { days: WEEKENDS, label: opts.weekendsLabel ?? "Weekends" };
  }
  if (token === "weekdays" || (!plural && token === "weekday")) {
    return { days: WEEKDAYS, label: opts.weekdaysLabel ?? "Weekdays" };
  }
  const { weekdays } = ctx.words;
  const stem = token.endsWith("s") ? token.slice(0, -1) : null;
  const day =
    stem && weekdays.has(stem) ? weekdays.get(stem)! : !plural ? weekdays.get(token) : undefined;
  if (day === undefined) return null;
  const name = ctx.words.weekdayLong[day] ?? ENGLISH_WEEKDAYS[day]!;
  const label = name.charAt(0).toLocaleUpperCase() + name.slice(1);
  // English names pluralize with "s"; other languages keep the plain name.
  return { days: [day], label: name === ENGLISH_WEEKDAYS[day] ? `${label}s` : label };
}

function dayOfWeek(iso: string): number {
  const [y, m, d] = parts(iso);
  const date = new Date(2000, 0, 1);
  date.setFullYear(y, m, d);
  return date.getDay();
}

/** The days of `kind` from `from` to `to`, or null past the size cap. */
function daysBetween(from: string, to: string, kind: DayKind): string[] | null {
  const out: string[] = [];
  let date = from;
  let dow = dayOfWeek(from);
  while (date <= to) {
    if (kind.days.includes(dow)) {
      if (out.length === DATE_SET_MAX_DAYS) return null;
      out.push(date);
    }
    date = addDays(date, 1);
    dow = (dow + 1) % 7;
  }
  return out;
}

/** A set phrase: "[every|all] <kind> <range>" or "last|past|next N <kind>".
 * Null when `text` isn't one. */
function parseSet(
  text: string,
  ctx: Ctx,
  opts: DatePhraseOptions,
): { dates: string[]; label: string } | null {
  let toks = text.split(" ");
  const every = toks[0] === "every" || toks[0] === "all";
  if (every) toks = toks.slice(1);

  // "last 3 Fridays", "next 2 weekends": the N nearest, counted from today.
  const dir = toks[0] === "last" || toks[0] === "past" ? -1 : toks[0] === "next" ? 1 : 0;
  if (dir !== 0 && toks.length === 3 && !every) {
    const n = count(toks[1]);
    const kind = dayKind(toks[2]!, true, ctx, opts);
    if (n === null || !kind || n > DATE_SET_MAX_DAYS) return null;
    // Weekends count as Saturday–Sunday pairs; any other kind counts days.
    const weekends = kind.days === WEEKENDS;
    const out: string[] = [];
    const groups = new Set<string>();
    let date = dir < 0 ? ctx.today : addDays(ctx.today, 1);
    let dow = dayOfWeek(date);
    for (let step = 0; step < 7 * DATE_SET_MAX_DAYS; step++) {
      if (kind.days.includes(dow)) {
        const group = weekends ? (dow === 6 ? date : addDays(date, -1)) : date;
        if (!groups.has(group)) {
          if (groups.size === n) break;
          groups.add(group);
        }
        out.push(date);
      }
      date = addDays(date, dir);
      dow = (dow + dir + 7) % 7;
    }
    return { dates: out.sort(), label: kind.label };
  }

  // "Fridays in October", "weekends since October", "weekdays this month",
  // "Mondays from Sep 1 to Oct 31".
  if (toks.length < 2) return null;
  const kind = dayKind(toks[0]!, !every, ctx, opts);
  if (!kind) return null;
  let rest = toks.slice(1).join(" ");
  if (rest.startsWith("in ") || rest.startsWith("during "))
    rest = rest.slice(rest.indexOf(" ") + 1);
  const span = parseExpr(rest, ctx);
  if (!span || !inYears(span.from, ctx) || !inYears(span.to, ctx)) return null;
  const dates = daysBetween(span.from, span.to, kind);
  return dates ? { dates, label: kind.label } : null;
}

/** A well-formed YYYY-MM-DD from year 1000 to 100 years past today. Huge
 * counts ("9999 years ago") and era years (Buddhist 2569) land outside. */
function inYears(date: string, ctx: Ctx): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const year = Number(date.slice(0, 4));
  return year >= 1000 && year <= ctx.year + 100;
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
 *   10 Sep, Sep 10 2026, Sep 10 '26, 10th September, Fri Sep 11 (the
 *   weekday must agree); 2026-09-10; 10/9, 10/9/26 in the
 *   locale's day/month order (`-` and `.` work as separators too);
 *   3 days ago, in 2 weeks.
 * - ranges: X to/until/through/- Y (also "from X to Y", "between X and
 *   Y", "Sep 10-20"); since X (through today); this/last/next
 *   week/month/year; last/past N days/weeks/months/years (ending today);
 *   next N days (starting today); September, Sep 2026; 2026.
 *
 * A missing year is the current year (the other end's year inside a range;
 * last year for "since <month>" that would otherwise start after today).
 * When only the end names a year, the start takes it ("Jan to Mar 2025").
 * Two-digit years slide around today. A range typed backwards is swapped.
 * Years before 1000 or more than 100 past today's are no match.
 * A single date outside maxDate/earliestDate is no match; a range is
 * clamped to them, and is no match when nothing is left.
 */
export function parseDatePhrase(text: string, options: DatePhraseOptions = {}): DatePhraseResult {
  if (text.length > DATE_PHRASE_MAX_LENGTH) return NONE;
  const normalized = normalizePhrase(text);
  if (normalized === "") return NONE;
  const today = options.today ?? todayStr();
  const ctx: Ctx = {
    today,
    year: Number(today.slice(0, 4)),
    weekStart: options.weekStart ?? "monday",
    words: localeWords(options.locale),
  };
  const lo = bound(options.earliestDate);
  const hi = bound(options.maxDate);

  const set = options.sets ? parseSet(normalized, ctx, options) : null;
  if (set) {
    const dates = set.dates.filter((d) => inYears(d, ctx) && !(lo && d < lo) && !(hi && d > hi));
    return dates.length ? { kind: "dates", dates, label: set.label } : NONE;
  }

  const span = parseExpr(normalized, ctx);
  if (!span || !inYears(span.from, ctx) || !inYears(span.to, ctx)) return NONE;

  if (span.single) {
    if ((lo && span.from < lo) || (hi && span.from > hi)) return NONE;
    return span.rolling
      ? { kind: "date", date: span.from, rollingDays: 1 }
      : { kind: "date", date: span.from };
  }
  const from = lo && span.from < lo ? lo : span.from;
  const to = hi && span.to > hi ? hi : span.to;
  if (from > to) return NONE;
  // A window the bounds cut short no longer ends today with its full length.
  if (span.rolling && from === span.from && to === span.to) {
    return { kind: "range", from, to, rollingDays: daysInRange(from, to) };
  }
  return { kind: "range", from, to };
}

/** A parse result as a {from, to} range (a single date is a one-day
 * range, a set spans its first to last day), or null for no match. */
export function datePhraseRange(result: DatePhraseResult): DateRange | null {
  if (result.kind === "date") return { from: result.date, to: result.date };
  if (result.kind === "range") return { from: result.from, to: result.to };
  if (result.kind === "dates") return { from: result.dates[0]!, to: result.dates.at(-1)! };
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
const SET_WORDS = ["weekends", "weekdays"];

/**
 * The rest of the word being typed, for inline ghost text: "Se" →
 * "ptember", "s" → "ince", "last 3 w" → "eeks". Returns "" when there is
 * nothing to suggest (empty text, a trailing space, a number, or a word
 * that is already complete).
 */
export function completeDatePhrase(
  text: string,
  options: { locale?: string | undefined; sets?: boolean | undefined } = {},
): string {
  if (text.length > DATE_PHRASE_MAX_LENGTH) return "";
  const match = /(?:^|\s)([\p{L}\p{M}]+)$/u.exec(text);
  if (!match) return "";
  const typed = match[1]!;
  const before = text
    .slice(0, text.length - typed.length)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const prev = before.length ? fold(before[before.length - 1]!) : null;
  const words = localeWords(options.locale);
  // Set words only when the caller reads sets, so nothing suggested is
  // a phrase that can't parse.
  const plurals = options.sets ? [...ENGLISH_WEEKDAYS.map((name) => `${name}s`), ...SET_WORDS] : [];

  let candidates: string[];
  if (prev !== null && count(prev) !== null && before.length >= 1) {
    // After a number: units ("3 days"), set days ("last 3 Fridays"), a
    // range word ("Sep 10 to") or a month ("10 September").
    const units = count(prev) === 1 ? ["day", "week", "month", "year"] : PLURAL_UNITS;
    candidates = [...units, ...plurals, ...TRAILING_KEYWORDS, ...words.monthNames];
  } else if (prev !== null && UNITS[prev]) {
    candidates = ["ago", ...TRAILING_KEYWORDS];
  } else if (prev === "last" || prev === "this" || prev === "next" || prev === "past") {
    candidates = [...PERIODS, ...words.weekdayNames];
  } else if (options.sets && (prev === "every" || prev === "all")) {
    candidates = [...words.weekdayNames, "weekend", "weekday", ...plurals];
  } else if (options.sets && plurals.some((w) => w.toLowerCase() === prev)) {
    // After the days of a set: what bounds them.
    candidates = ["since", "in", "from", "this", "last", "next", "between"];
  } else if (prev === null) {
    candidates = [
      ...LEADING_KEYWORDS,
      ...words.monthNames,
      ...words.weekdayNames,
      ...plurals,
      ...(options.sets ? ["every"] : []),
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
