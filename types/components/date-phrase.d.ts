import { type DateRange, type WeekStart } from "./date-range.js";
/** Longest text the parser and completer look at. Typed dates are short;
 * the cap keeps a pasted wall of text from stalling every keystroke. */
export declare const DATE_PHRASE_MAX_LENGTH = 200;
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
export type DatePhraseResult = {
    kind: "date";
    date: string;
} | {
    kind: "range";
    from: string;
    to: string;
} | {
    kind: "none";
};
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
export declare function parseDatePhrase(text: string, options?: DatePhraseOptions): DatePhraseResult;
/** A parse result as a {from, to} range (a single date is a one-day
 * range), or null for no match. */
export declare function datePhraseRange(result: DatePhraseResult): DateRange | null;
/**
 * The rest of the word being typed, for inline ghost text: "Se" →
 * "ptember", "s" → "ince", "last 3 w" → "eeks". Returns "" when there is
 * nothing to suggest (empty text, a trailing space, a number, or a word
 * that is already complete).
 */
export declare function completeDatePhrase(text: string, options?: {
    locale?: string | undefined;
}): string;
