import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  completeDatePhrase,
  DATE_PHRASE_MAX_LENGTH,
  DATE_SET_MAX_DAYS,
  datePhraseRange,
  parseDatePhrase,
  type DatePhraseOptions,
} from "../src/lib/components/date-phrase.js";
import { daysInRange, formatDateRangeLabel } from "../src/lib/components/date-range.js";

// "Today" is injected: Thursday 2026-11-12. Nothing here reads the clock.
const base: DatePhraseOptions = { today: "2026-11-12", locale: "en-US" };

function parse(text: string, options: DatePhraseOptions = {}) {
  return parseDatePhrase(text, { ...base, ...options });
}

function date(d: string) {
  return { kind: "date", date: d };
}

function range(from: string, to: string) {
  return { kind: "range", from, to };
}

/** A rolling window ending today, which a picker can match to a preset. */
function rolling(from: string, to: string, days: number) {
  return { kind: "range", from, to, rollingDays: days };
}

const none = { kind: "none" };

describe("single dates", () => {
  test("today is a rolling one-day window", () => {
    expect(parse("today")).toEqual({ kind: "date", date: "2026-11-12", rollingDays: 1 });
  });

  test.each([
    ["Yesterday", "2026-11-11"],
    ["  TOMORROW  ", "2026-11-13"],
  ])("%p", (text, expected) => {
    expect(parse(text)).toEqual(date(expected));
  });

  test("weekday names pick that day of the current, previous or next week", () => {
    // Monday-first: the week of 2026-11-12 runs Nov 9 – Nov 15.
    expect(parse("friday")).toEqual(date("2026-11-13"));
    expect(parse("this Friday")).toEqual(date("2026-11-13"));
    expect(parse("last friday")).toEqual(date("2026-11-06"));
    expect(parse("next fri")).toEqual(date("2026-11-20"));
    expect(parse("monday")).toEqual(date("2026-11-09"));
    expect(parse("sunday")).toEqual(date("2026-11-15"));
    expect(parse("tues")).toEqual(date("2026-11-10"));
    expect(parse("thurs")).toEqual(date("2026-11-12"));
  });

  test("weekStart changes which week a weekday belongs to", () => {
    // Sunday-first: the week of 2026-11-12 runs Nov 8 – Nov 14.
    expect(parse("sunday", { weekStart: "sunday" })).toEqual(date("2026-11-08"));
    expect(parse("sunday", { weekStart: "monday" })).toEqual(date("2026-11-15"));
  });

  test.each([
    ["Sep 10", "2026-09-10"],
    ["September 10", "2026-09-10"],
    ["sept 10", "2026-09-10"],
    ["Sept. 10", "2026-09-10"],
    ["10 Sep", "2026-09-10"],
    ["10th September", "2026-09-10"],
    ["the 1st of March", "2026-03-01"],
    ["September 10, 2025", "2025-09-10"],
    ["10 Sep 2027", "2027-09-10"],
    ["Sep 10 '26", "2026-09-10"],
    ["Sep 10 ’25", "2025-09-10"],
    ["10 Sep '27", "2027-09-10"],
    ["Fri Sep 11", "2026-09-11"],
    ["sep    10", "2026-09-10"],
  ])("month names: %p", (text, expected) => {
    expect(parse(text)).toEqual(date(expected));
  });

  test.each([
    ["2026-09-10", "2026-09-10"],
    ["2024/2/29", "2024-02-29"],
  ])("ISO: %p", (text, expected) => {
    expect(parse(text)).toEqual(date(expected));
  });

  test.each([
    ["3 days ago", "2026-11-09"],
    ["a week ago", "2026-11-05"],
    ["two months ago", "2026-09-12"],
    ["1 year ago", "2025-11-12"],
    ["in 3 days", "2026-11-15"],
    ["in 2 weeks", "2026-11-26"],
    ["in a month", "2026-12-12"],
  ])("relative: %p", (text, expected) => {
    expect(parse(text)).toEqual(date(expected));
  });

  test("a month shift clamps to the end of a shorter month", () => {
    expect(parse("1 month ago", { today: "2026-03-31" })).toEqual(date("2026-02-28"));
    expect(parse("in 1 month", { today: "2024-01-31" })).toEqual(date("2024-02-29"));
  });
});

describe("numeric dates follow the locale's day/month order", () => {
  test("en-US is month first", () => {
    expect(parse("10/9", { locale: "en-US" })).toEqual(date("2026-10-09"));
    expect(parse("10-9-2025", { locale: "en-US" })).toEqual(date("2025-10-09"));
    expect(parse("12/25/26", { locale: "en-US" })).toEqual(date("2026-12-25"));
    expect(parse("25/12", { locale: "en-US" })).toEqual(none);
  });

  test("en-GB is day first", () => {
    expect(parse("10/9", { locale: "en-GB" })).toEqual(date("2026-09-10"));
    expect(parse("25/12/2026", { locale: "en-GB" })).toEqual(date("2026-12-25"));
    expect(parse("12/25", { locale: "en-GB" })).toEqual(none);
  });

  test("German dotted dates, with and without the trailing dot", () => {
    expect(parse("10.09.", { locale: "de-DE" })).toEqual(date("2026-09-10"));
    expect(parse("10.9.2026", { locale: "de-DE" })).toEqual(date("2026-09-10"));
  });

  test("year-first locales keep day/month order without a year", () => {
    expect(parse("9/10", { locale: "ja-JP" })).toEqual(date("2026-09-10"));
  });

  test("mixed separators are not a date", () => {
    expect(parse("10/9-2026")).toEqual(none);
  });
});

describe("two-digit years slide around today", () => {
  test.each([
    ["Sep 10 '26", "2026-09-10"],
    ["Sep 10 '46", "2046-09-10"],
    ["Sep 10 '47", "1947-09-10"],
    ["Sep 10 '99", "1999-09-10"],
    ["9/10/05", "2005-09-10"],
  ])("%p", (text, expected) => {
    expect(parse(text)).toEqual(date(expected));
  });
});

describe("leap days", () => {
  test("Feb 29 exists only in leap years", () => {
    expect(parse("Feb 29")).toEqual(none); // 2026
    expect(parse("Feb 29 2028")).toEqual(date("2028-02-29"));
    expect(parse("Feb 29", { today: "2028-06-01" })).toEqual(date("2028-02-29"));
    expect(parse("2/29/2100")).toEqual(none); // not a leap year
    expect(parse("2000-02-29")).toEqual(date("2000-02-29"));
  });

  test("impossible dates are no match", () => {
    expect(parse("Sep 31")).toEqual(none);
    expect(parse("2026-13-01")).toEqual(none);
    expect(parse("2026-00-10")).toEqual(none);
    expect(parse("Sep 0")).toEqual(none);
  });
});

describe("ranges", () => {
  test.each([
    ["Sep 10 to Oct 20", "2026-09-10", "2026-10-20"],
    ["September 10 to October 20", "2026-09-10", "2026-10-20"],
    ["sep 10 - oct 20", "2026-09-10", "2026-10-20"],
    ["Sep 10 – Oct 20", "2026-09-10", "2026-10-20"],
    ["Sep 10—Oct 20", "2026-09-10", "2026-10-20"],
    ["Sep 10-Oct 20", "2026-09-10", "2026-10-20"],
    ["Sep 10 until Oct 20", "2026-09-10", "2026-10-20"],
    ["Sep 10 through Oct 20", "2026-09-10", "2026-10-20"],
    ["from Sep 10 to Oct 20", "2026-09-10", "2026-10-20"],
    ["between Sep 1 and Sep 5", "2026-09-01", "2026-09-05"],
    ["Sep 10-20", "2026-09-10", "2026-09-20"],
    ["Sep 10 to 20", "2026-09-10", "2026-09-20"],
    ["2026-09-10 to 2026-10-20", "2026-09-10", "2026-10-20"],
    ["9/10 - 10/20", "2026-09-10", "2026-10-20"],
    ["yesterday to tomorrow", "2026-11-11", "2026-11-13"],
    ["September to October", "2026-09-01", "2026-10-31"],
    ["last monday to friday", "2026-11-02", "2026-11-13"],
  ])("%p", (text, from, to) => {
    expect(parse(text)).toEqual(range(from, to));
  });

  test("a range typed backwards is swapped", () => {
    expect(parse("Oct 20 to Sep 10")).toEqual(range("2026-09-10", "2026-10-20"));
    expect(parse("2026-10-20 - 2026-09-10")).toEqual(range("2026-09-10", "2026-10-20"));
    expect(parse("Sep 20 to 10")).toEqual(range("2026-09-10", "2026-09-20"));
  });

  test("an end with no year crosses into the next year when that is the shorter range", () => {
    expect(parse("Dec 20 to Jan 5")).toEqual(range("2026-12-20", "2027-01-05"));
    expect(parse("Dec 20 2025 to Jan 5")).toEqual(range("2025-12-20", "2026-01-05"));
    expect(parse("Dec 20 to Jan 5 2026")).toEqual(range("2025-12-20", "2026-01-05"));
  });

  test("when only the end names a year, the start takes it", () => {
    const june = { today: "2026-06-15" };
    expect(parse("sep 10 - oct 20 2025", june)).toEqual(range("2025-09-10", "2025-10-20"));
    expect(parse("jan to mar 2025", june)).toEqual(range("2025-01-01", "2025-03-31"));
    expect(parse("Sep 10 to 2025-10-20", june)).toEqual(range("2025-09-10", "2025-10-20"));
    // ... or the year before, when that keeps the start before the end.
    expect(parse("dec 20 - jan 5 2027", { today: "2027-03-01" })).toEqual(
      range("2026-12-20", "2027-01-05"),
    );
  });

  test("the start's year carries to an end without one", () => {
    expect(parse("Sep 10 2025 to Oct 20")).toEqual(range("2025-09-10", "2025-10-20"));
  });

  test("since: from then through today", () => {
    expect(parse("since October")).toEqual(range("2026-10-01", "2026-11-12"));
    expect(parse("since Sep 10")).toEqual(range("2026-09-10", "2026-11-12"));
    expect(parse("since last week")).toEqual(range("2026-11-02", "2026-11-12"));
    expect(parse("since 2025")).toEqual(range("2025-01-01", "2026-11-12"));
  });

  test("since a month that hasn't started yet this year means last year's", () => {
    expect(parse("since October", { today: "2027-02-03" })).toEqual(
      range("2026-10-01", "2027-02-03"),
    );
    // An explicit future year stays empty.
    expect(parse("since Oct 2027")).toEqual(none);
  });

  test("calendar periods", () => {
    expect(parse("this week")).toEqual(range("2026-11-09", "2026-11-15"));
    expect(parse("last week")).toEqual(range("2026-11-02", "2026-11-08"));
    expect(parse("next week")).toEqual(range("2026-11-16", "2026-11-22"));
    expect(parse("this week", { weekStart: "sunday" })).toEqual(range("2026-11-08", "2026-11-14"));
    expect(parse("this month")).toEqual(range("2026-11-01", "2026-11-30"));
    expect(parse("last month")).toEqual(range("2026-10-01", "2026-10-31"));
    expect(parse("next month")).toEqual(range("2026-12-01", "2026-12-31"));
    expect(parse("this year")).toEqual(range("2026-01-01", "2026-12-31"));
    expect(parse("last year")).toEqual(range("2025-01-01", "2025-12-31"));
  });

  test("rolling windows end today, inclusive, like the relative presets", () => {
    expect(parse("last 30 days")).toEqual(rolling("2026-10-14", "2026-11-12", 30));
    expect(parse("past 7 days")).toEqual(rolling("2026-11-06", "2026-11-12", 7));
    expect(parse("last 2 weeks")).toEqual(rolling("2026-10-30", "2026-11-12", 14));
    expect(parse("last 3 months")).toEqual(rolling("2026-08-13", "2026-11-12", 92));
    expect(parse("past week")).toEqual(rolling("2026-11-06", "2026-11-12", 7));
    expect(parse("last 1 year")).toEqual(rolling("2025-11-13", "2026-11-12", 365));
    // Not rolling windows ending today: no rollingDays.
    expect(parse("next 10 days")).toEqual(range("2026-11-12", "2026-11-21"));
    expect(parse("this week")).toEqual(range("2026-11-09", "2026-11-15"));
    expect(parse("since November")).toEqual(range("2026-11-01", "2026-11-12"));
    expect(parse("last 30 days to today")).toEqual(range("2026-10-14", "2026-11-12"));
    // Cut short by a bound, a window no longer has its full length.
    expect(parse("last 30 days", { earliestDate: "2026-11-01" })).toEqual(
      range("2026-11-01", "2026-11-12"),
    );
    expect(parse("last 30 days", { maxDate: "2026-11-10" })).toEqual(
      range("2026-10-14", "2026-11-10"),
    );
  });

  test("a bare month or month and year is the whole month", () => {
    expect(parse("September")).toEqual(range("2026-09-01", "2026-09-30"));
    expect(parse("feb")).toEqual(range("2026-02-01", "2026-02-28"));
    expect(parse("Feb 2028")).toEqual(range("2028-02-01", "2028-02-29"));
    expect(parse("2025")).toEqual(range("2025-01-01", "2025-12-31"));
  });
});

describe("year rollover", () => {
  test("relative words cross the year boundary", () => {
    expect(parse("tomorrow", { today: "2026-12-31" })).toEqual(date("2027-01-01"));
    expect(parse("yesterday", { today: "2027-01-01" })).toEqual(date("2026-12-31"));
    expect(parse("next month", { today: "2026-12-15" })).toEqual(range("2027-01-01", "2027-01-31"));
    expect(parse("last month", { today: "2027-01-15" })).toEqual(range("2026-12-01", "2026-12-31"));
    expect(parse("last week", { today: "2027-01-02" })).toEqual(range("2026-12-21", "2026-12-27"));
    expect(parse("last 7 days", { today: "2027-01-03" })).toEqual(
      rolling("2026-12-28", "2027-01-03", 7),
    );
  });

  test("a missing year is the current year, even near the boundary", () => {
    expect(parse("Dec 31", { today: "2027-01-01" })).toEqual(date("2027-12-31"));
  });
});

describe("locale names", () => {
  test("German month and weekday names, alongside English", () => {
    const de = { locale: "de-DE" };
    expect(parse("12. Oktober", de)).toEqual(date("2026-10-12"));
    expect(parse("3 Mär 2027", de)).toEqual(date("2027-03-03"));
    expect(parse("März", de)).toEqual(range("2026-03-01", "2026-03-31"));
    expect(parse("October 12", de)).toEqual(date("2026-10-12"));
    expect(parse("Freitag", de)).toEqual(date("2026-11-13"));
  });

  test("French names match with or without accents and abbreviation dots", () => {
    const fr = { locale: "fr-FR" };
    expect(parse("3 févr.", fr)).toEqual(date("2026-02-03"));
    expect(parse("3 fevrier", fr)).toEqual(date("2026-02-03"));
    expect(parse("10 septembre au 20 octobre", fr)).toEqual(none); // keywords stay English
    expect(parse("10 septembre to 20 octobre", fr)).toEqual(range("2026-09-10", "2026-10-20"));
  });

  test("Russian genitive month forms", () => {
    expect(parse("10 сентября", { locale: "ru-RU" })).toEqual(date("2026-09-10"));
    expect(parse("сентябрь", { locale: "ru-RU" })).toEqual(range("2026-09-01", "2026-09-30"));
  });
});

describe("bounds", () => {
  test("a single date outside the bounds is no match", () => {
    expect(parse("tomorrow", { maxDate: "2026-11-12" })).toEqual(none);
    expect(parse("today", { maxDate: "2026-11-12" })).toEqual({
      kind: "date",
      date: "2026-11-12",
      rollingDays: 1,
    });
    expect(parse("Jan 1", { earliestDate: "2026-02-01" })).toEqual(none);
  });

  test("a range is clamped to the bounds", () => {
    expect(parse("this week", { maxDate: "2026-11-12" })).toEqual(
      range("2026-11-09", "2026-11-12"),
    );
    expect(parse("this year", { earliestDate: "2026-03-15", maxDate: "2026-11-12" })).toEqual(
      range("2026-03-15", "2026-11-12"),
    );
    // earliestDate may carry a time part, as allFromDate() allows.
    expect(parse("last 30 days", { earliestDate: "2026-11-01T08:00:00Z" })).toEqual(
      range("2026-11-01", "2026-11-12"),
    );
  });

  test("a range with nothing left inside the bounds is no match", () => {
    expect(parse("next month", { maxDate: "2026-11-12" })).toEqual(none);
    expect(parse("last year", { earliestDate: "2026-01-01" })).toEqual(none);
  });
});

describe("no match", () => {
  test.each([
    // Sets of days, deliberately out of scope: never a wrong range.
    "last 3 Fridays",
    "Fridays",
    "weekends",
    "this weekend",
    "weekends since October",
    "Fridays in October",
    "every Monday",
    "Mondays to Fridays",
    // Times of day.
    "tomorrow at 5pm",
    // Incomplete phrases.
    "Sep 10 to",
    "since",
    "last",
    "last 3",
    "in 3",
    "3 days",
    "between Sep 1",
    // Garbage.
    "",
    "   ",
    "asdf",
    "42",
    "0 days ago",
    "Sep 10 to banana",
    "!!!",
  ])("%p", (text) => {
    expect(parse(text)).toEqual(none);
  });
});

test("today defaults to the local current date", () => {
  const result = parseDatePhrase("today");
  expect(result.kind).toBe("date");
});

describe("datePhraseRange", () => {
  test("a date is a one-day range; none is null", () => {
    expect(datePhraseRange({ kind: "date", date: "2026-09-10" })).toEqual({
      from: "2026-09-10",
      to: "2026-09-10",
    });
    expect(datePhraseRange({ kind: "range", from: "2026-09-10", to: "2026-10-20" })).toEqual({
      from: "2026-09-10",
      to: "2026-10-20",
    });
    expect(datePhraseRange({ kind: "none" })).toBeNull();
  });
});

describe("daysInRange", () => {
  test("counts both ends", () => {
    expect(daysInRange("2026-09-10", "2026-10-20")).toBe(41);
    expect(daysInRange("2026-09-10", "2026-09-10")).toBe(1);
    expect(daysInRange("2028-02-01", "2028-03-01")).toBe(30);
    // Across a DST change (US: 2026-11-01) still whole days.
    expect(daysInRange("2026-10-31", "2026-11-02")).toBe(3);
  });
});

describe("formatDateRangeLabel", () => {
  test("uses the locale's own range format", () => {
    expect(formatDateRangeLabel("2026-09-10", "2026-10-20", "en-US")).toBe("Sep 10 – Oct 20, 2026");
    expect(formatDateRangeLabel("2026-09-10", "2026-09-10", "en-US")).toBe("Sep 10, 2026");
    expect(formatDateRangeLabel("2026-12-20", "2027-01-05", "en-US")).toBe(
      "Dec 20, 2026 – Jan 5, 2027",
    );
    // Years before 100 aren't read as the 1900s.
    expect(formatDateRangeLabel("1001-01-01", "1001-01-01", "en-US")).toBe("Jan 1, 1001");
    // Day first; the exact month abbreviation varies across ICU versions.
    expect(formatDateRangeLabel("2026-09-10", "2026-10-20", "en-GB")).toMatch(
      /^10 Sept? – 20 Oct 2026$/,
    );
  });
});

describe("completeDatePhrase", () => {
  const complete = (text: string, locale = "en-US") => completeDatePhrase(text, { locale });

  test.each([
    ["Se", "ptember"],
    ["Fr", "iday"],
    ["s", "ince"],
    ["t", "oday"],
    ["tom", "orrow"],
    ["y", "esterday"],
    ["Sep 10 to O", "ctober"],
    ["last 3 w", "eeks"],
    ["last 1 w", "eek"],
    ["a w", "eek"],
    ["3 days a", "go"],
    ["last f", "riday"],
    ["this m", "onth"],
    ["past y", "ear"],
    ["Sep 10 t", "o"],
    ["SE", "PTEMBER"],
    ["10 Se", "ptember"],
  ])("%p → %p", (text, suffix) => {
    expect(complete(text)).toBe(suffix);
  });

  test.each(["", "Sep ", "Sep 1", "may", "today", "xyz", "Sep 10 to Oct 2"])(
    "%p has no suggestion",
    (text) => {
      expect(complete(text)).toBe("");
    },
  );

  test("offers the locale's own names", () => {
    expect(complete("Okt", "de-DE")).toBe("ober");
    expect(complete("Fre", "de-DE")).toBe("itag");
    expect(complete("Sep", "de-DE")).toBe("tember");
  });
});

describe("review regressions", () => {
  const june = { today: "2026-06-15" };

  test("two-digit years after a month name need an apostrophe; a bare one is a time", () => {
    expect(parse("sep 10 15", june)).toEqual(none);
    expect(parse("10 sep 15", june)).toEqual(none);
    expect(parse("Sep 10 '15", june)).toEqual(date("2015-09-10"));
    // Numeric dates keep bare two-digit years.
    expect(parse("9/10/15", june)).toEqual(date("2015-09-10"));
  });

  test("a leading weekday must agree with the date", () => {
    expect(parse("mon sep 10", june)).toEqual(none); // a Thursday in 2026
    expect(parse("thu sep 10", june)).toEqual(date("2026-09-10"));
    expect(parse("Fri Sep 11", june)).toEqual(date("2026-09-11"));
    expect(parse("sat yesterday", june)).toEqual(none); // Jun 14 is a Sunday
    expect(parse("thu 3 days ago", june)).toEqual(none); // Jun 12 is a Friday
    expect(parse("fri 3 days ago", { today: "2026-11-12" })).toEqual(none); // Nov 9 is a Monday
    expect(parse("sun mon", june)).toEqual(none);
    expect(parse("fri fri fri sep 10", june)).toEqual(none);
    expect(parse("fri fri sep 11", june)).toEqual(none);
  });

  test("dates stay well-formed: years from 1000 to 100 past today", () => {
    expect(parse("0001-01-01", june)).toEqual(none);
    expect(parse("0999-12-31", june)).toEqual(none);
    expect(parse("1000-01-01", june)).toEqual(date("1000-01-01"));
    expect(parse("9999 years ago", june)).toEqual(none);
    expect(parse("in 9999 years", june)).toEqual(none);
    expect(parse("last 9999 years", june)).toEqual(none);
    expect(parse("since 0001", june)).toEqual(none);
    expect(parse("in 100 years", june)).toEqual(date("2126-06-15"));
    expect(parse("in 101 years", june)).toEqual(none);
    expect(parse("999999999 days ago", june)).toEqual(none);
    for (const text of ["300 years ago", "last 500 years", "in 2 years", "since 1066"]) {
      const result = datePhraseRange(parse(text, june));
      if (result) {
        expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  test("Gregorian month names whatever the locale's default calendar", () => {
    // Persian "دی" is a Solar Hijri month, not a Gregorian one.
    expect(parse("دی 5", { ...june, locale: "fa" })).toEqual(none);
    expect(parse("5 ژانویه", { ...june, locale: "fa" })).toEqual(date("2026-01-05"));
    expect(parse("September 10", { ...june, locale: "ar-SA" })).toEqual(date("2026-09-10"));
    expect(parse("10 سبتمبر", { ...june, locale: "ar-SA" })).toEqual(date("2026-09-10"));
    expect(parse("10 سبتمبر", { ...june, locale: "ar-SA-u-ca-islamic" })).toEqual(
      date("2026-09-10"),
    );
  });

  test("Buddhist-era years are not read as Gregorian", () => {
    expect(parse("10/9/2569", { ...june, locale: "th-TH" })).toEqual(none);
    expect(parse("10/9/2026", { ...june, locale: "th-TH" })).toEqual(date("2026-09-10"));
  });

  test("names with combining marks match and complete", () => {
    expect(parse("กันยายน 10", { ...june, locale: "th-TH" })).toEqual(date("2026-09-10"));
    expect(parse("10 सितंबर", { ...june, locale: "hi-IN" })).toEqual(date("2026-09-10"));
    expect(completeDatePhrase("กันย", { locale: "th-TH" })).toBe("ายน");
  });

  test("long input is no match without work", () => {
    const long = "fri ".repeat(8000);
    expect(parse(long, june)).toEqual(none);
    expect(completeDatePhrase(long + "fr")).toBe("");
    expect(parse("x".repeat(DATE_PHRASE_MAX_LENGTH + 1), june)).toEqual(none);
    const started = performance.now();
    parse("fri ".repeat(50), june);
    expect(performance.now() - started).toBeLessThan(500);
  });

  test("empty text and malformed locales never throw", () => {
    expect(parseDatePhrase("", { locale: "not a locale!" })).toEqual(none);
    expect(parse("tomorrow", { ...june, locale: "not a locale!" })).toEqual(date("2026-06-16"));
    expect(completeDatePhrase("Se", { locale: "not a locale!" })).toBe("ptember");
  });
});

describe("sets of separate days", () => {
  // Today: Wednesday 2026-11-18.
  const on: DatePhraseOptions = { today: "2026-11-18", locale: "en-US", sets: true };
  const set = (text: string, options: DatePhraseOptions = {}) =>
    parseDatePhrase(text, { ...on, ...options });
  const dates = (label: string, ...days: string[]) => ({ kind: "dates", dates: days, label });

  test("last 3 Fridays and weekends since October", () => {
    expect(set("Last 3 Fridays")).toEqual(
      dates("Fridays", "2026-10-30", "2026-11-06", "2026-11-13"),
    );
    const weekends = set("Weekends since October");
    expect(weekends).toEqual(
      dates(
        "Weekends",
        "2026-10-03",
        "2026-10-04",
        "2026-10-10",
        "2026-10-11",
        "2026-10-17",
        "2026-10-18",
        "2026-10-24",
        "2026-10-25",
        "2026-10-31",
        "2026-11-01",
        "2026-11-07",
        "2026-11-08",
        "2026-11-14",
        "2026-11-15",
      ),
    );
  });

  test("off by default: set phrases stay no match", () => {
    const off = { today: "2026-11-18", locale: "en-US" };
    for (const text of ["Last 3 Fridays", "Weekends since October", "every Friday in October"]) {
      expect(parseDatePhrase(text, off)).toEqual(none);
      expect(parseDatePhrase(text, { ...off, sets: false })).toEqual(none);
    }
    // Ordinary phrases read the same with sets on.
    expect(set("last friday")).toEqual(date("2026-11-13"));
    expect(set("last 3 days")).toEqual(rolling("2026-11-16", "2026-11-18", 3));
    expect(set("since October")).toEqual(range("2026-10-01", "2026-11-18"));
  });

  test("last/past N counts back from today, today included; next N counts from tomorrow", () => {
    expect(set("past 2 wednesdays")).toEqual(dates("Wednesdays", "2026-11-11", "2026-11-18"));
    expect(set("next 2 wednesdays")).toEqual(dates("Wednesdays", "2026-11-25", "2026-12-02"));
    expect(set("next 2 fris")).toEqual(dates("Fridays", "2026-11-20", "2026-11-27"));
    expect(set("last two mondays")).toEqual(dates("Mondays", "2026-11-09", "2026-11-16"));
    // Weekends count as Saturday–Sunday pairs.
    expect(set("last 2 weekends")).toEqual(
      dates("Weekends", "2026-11-07", "2026-11-08", "2026-11-14", "2026-11-15"),
    );
    expect(set("next weekends")).toEqual(none);
    expect(set("next 1 weekends")).toEqual(dates("Weekends", "2026-11-21", "2026-11-22"));
    expect(set("last 3 weekdays")).toEqual(
      dates("Weekdays", "2026-11-16", "2026-11-17", "2026-11-18"),
    );
  });

  test("a kind bounded by any range the parser reads", () => {
    expect(set("fridays in october")).toEqual(
      dates("Fridays", "2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"),
    );
    expect(set("every friday in october")).toEqual(set("fridays in october"));
    expect(set("all fridays during october")).toEqual(set("fridays in october"));
    expect(set("weekends in feb 2028")).toEqual(
      dates(
        "Weekends",
        "2028-02-05",
        "2028-02-06",
        "2028-02-12",
        "2028-02-13",
        "2028-02-19",
        "2028-02-20",
        "2028-02-26",
        "2028-02-27",
      ),
    );
    expect(set("mondays from sep 1 to sep 30")).toEqual(
      dates("Mondays", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"),
    );
    expect(set("mondays between sep 1 and sep 14")).toEqual(
      dates("Mondays", "2026-09-07", "2026-09-14"),
    );
    expect(set("sundays last month")).toEqual(
      dates("Sundays", "2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"),
    );
    expect((set("weekdays this month") as { dates: string[] }).dates).toHaveLength(21);
    expect((set("weekends next year") as { dates: string[] }).dates).toHaveLength(104);
    expect(set("all weekdays since monday")).toEqual(
      dates("Weekdays", "2026-11-16", "2026-11-17", "2026-11-18"),
    );
  });

  test("month and year rollover", () => {
    expect(set("last 3 fridays", { today: "2027-01-12" })).toEqual(
      dates("Fridays", "2026-12-25", "2027-01-01", "2027-01-08"),
    );
    expect(set("next 2 sundays", { today: "2026-12-30" })).toEqual(
      dates("Sundays", "2027-01-03", "2027-01-10"),
    );
    expect(set("weekends since december", { today: "2027-01-04" })).toEqual(
      dates(
        "Weekends",
        "2026-12-05",
        "2026-12-06",
        "2026-12-12",
        "2026-12-13",
        "2026-12-19",
        "2026-12-20",
        "2026-12-26",
        "2026-12-27",
        "2027-01-02",
        "2027-01-03",
      ),
    );
  });

  test("weekends and weekdays don't depend on weekStart", () => {
    expect(set("weekends in october", { weekStart: "sunday" })).toEqual(
      set("weekends in october", { weekStart: "monday" }),
    );
    expect(set("last 2 weekends", { weekStart: "sunday" })).toEqual(set("last 2 weekends"));
  });

  test("clamped to the bounds; nothing left is no match", () => {
    expect(
      set("fridays in october", { earliestDate: "2026-10-10", maxDate: "2026-10-24" }),
    ).toEqual(dates("Fridays", "2026-10-16", "2026-10-23"));
    expect(set("last 3 fridays", { maxDate: "2026-11-01" })).toEqual(
      dates("Fridays", "2026-10-30"),
    );
    expect(set("fridays next month", { maxDate: "2026-11-18" })).toEqual(none);
  });

  test("caps: N and the set size", () => {
    expect(set(`last ${DATE_SET_MAX_DAYS} fridays`).kind).toBe("dates");
    expect(set(`last ${DATE_SET_MAX_DAYS + 1} fridays`)).toEqual(none);
    expect(set("weekdays since 2020")).toEqual(none); // over 366 days
    expect(set("fridays since 2020")).toEqual(
      expect.objectContaining({ kind: "dates", label: "Fridays" }),
    );
    expect(set("last 999999 fridays")).toEqual(none);
    expect(set("fridays since 0001")).toEqual(none);
    expect(set("fridays in 9999")).toEqual(none);
  });

  test("labels, abbreviations and locale weekday names", () => {
    expect(set("last 2 thurs")).toEqual(dates("Thursdays", "2026-11-05", "2026-11-12"));
    expect(set("weekends in october", { weekendsLabel: "Fins de semaine" })).toEqual(
      expect.objectContaining({ label: "Fins de semaine" }),
    );
    expect(set("last 2 weekdays", { weekdaysLabel: "Workdays" })).toEqual(
      dates("Workdays", "2026-11-17", "2026-11-18"),
    );
    // Other languages: the English plural, or every + the locale's
    // singular name, labelled with the locale's singular name.
    expect(set("last 2 fridays", { locale: "de-DE" })).toEqual(
      dates("Freitag", "2026-11-06", "2026-11-13"),
    );
    expect(set("every freitag in october", { locale: "de-DE" })).toEqual(
      expect.objectContaining({ label: "Freitag" }),
    );
    expect(set("jeden freitag in october", { locale: "de-DE" })).toEqual(none);
    // A locale name never takes the plural "s".
    expect(set("last 2 freitags", { locale: "de-DE" })).toEqual(none);
    // The label's first letter is cased for the locale.
    expect(set("every cuma in october", { locale: "tr-TR" })).toEqual(
      expect.objectContaining({ label: "Cuma" }),
    );
  });

  test("not a set: no match rather than a guess", () => {
    for (const text of [
      "fridays",
      "every weekend",
      "every",
      "last 3",
      "weekends since",
      "fridays in banana",
      "friday last week", // a singular weekday needs every/all to be a set
      "last 0 fridays",
      "every last 3 fridays",
      "weekends weekends since october",
      "fri ".repeat(60),
    ]) {
      expect(set(text)).toEqual(none);
    }
  });

  test("completion offers set words only with sets", () => {
    expect(completeDatePhrase("last 3 Fr", { sets: true })).toBe("idays");
    expect(completeDatePhrase("last 3 Fr")).toBe("");
    expect(completeDatePhrase("Weekends s", { sets: true })).toBe("ince");
    expect(completeDatePhrase("weeke", { sets: true })).toBe("nds");
    expect(completeDatePhrase("weeke")).toBe("");
    expect(completeDatePhrase("ever", { sets: true })).toBe("y");
    expect(completeDatePhrase("ever")).toBe("");
    expect(completeDatePhrase("every f", { sets: true })).toBe("riday");
  });
});

describe("sets review regressions", () => {
  const on: DatePhraseOptions = { today: "2026-11-18", locale: "en-US", sets: true };
  const set = (text: string, options: DatePhraseOptions = {}) =>
    parseDatePhrase(text, { ...on, ...options });

  test("locale names that end in s stay what they mean without sets", () => {
    expect(set("mars 2026", { locale: "fr-FR" })).toEqual(range("2026-03-01", "2026-03-31"));
    for (const locale of ["de-DE", "de-AT"]) {
      for (const text of ["last 2 mos", "past 2 mos", "next 2 mos"]) {
        expect(set(text, { locale })).toEqual(
          parseDatePhrase(text, { today: "2026-11-18", locale }),
        );
        expect(set(text, { locale }).kind).toBe("range");
      }
    }
  });

  test("turning sets on never changes a phrase that parses without it", () => {
    // Every string literal in this file, in several locales and on dates
    // around a weekend and a year end.
    const source = readFileSync(new URL(import.meta.url).pathname, "utf8");
    const phrases = [...new Set([...source.matchAll(/"([^"\\\n]{1,60})"/g)].map((m) => m[1]!))];
    expect(phrases.length).toBeGreaterThan(200);
    let checked = 0;
    for (const locale of ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "ru-RU", "th-TH"]) {
      for (const today of ["2026-11-18", "2026-11-14", "2026-12-31"]) {
        for (const text of phrases) {
          const off = parseDatePhrase(text, { today, locale });
          if (off.kind === "none") continue;
          checked++;
          expect({
            text,
            locale,
            today,
            result: parseDatePhrase(text, { today, locale, sets: true }),
          }).toEqual({
            text,
            locale,
            today,
            result: off,
          });
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  test("the set cap holds for weekends", () => {
    expect((set("last 183 weekends") as { dates: string[] }).dates).toHaveLength(366);
    expect(set("last 184 weekends")).toEqual(none);
    expect(set("last 366 weekends")).toEqual(none);
    expect((set("next 183 weekends") as { dates: string[] }).dates).toHaveLength(366);
    expect(set("next 184 weekends")).toEqual(none);
  });

  test("next N weekends counts whole weekends; last N takes the most recent days", () => {
    const fri = { today: "2026-11-13" };
    const sat = { today: "2026-11-14" };
    const sun = { today: "2026-11-15" };
    const mon = { today: "2026-11-16" };
    const wk = (...days: string[]) => ({ kind: "dates", dates: days, label: "Weekends" });
    expect(set("next 1 weekends", fri)).toEqual(wk("2026-11-14", "2026-11-15"));
    expect(set("next 1 weekends", sat)).toEqual(wk("2026-11-21", "2026-11-22"));
    expect(set("next 1 weekends", sun)).toEqual(wk("2026-11-21", "2026-11-22"));
    expect(set("next 1 weekends", mon)).toEqual(wk("2026-11-21", "2026-11-22"));
    expect(set("last 1 weekends", fri)).toEqual(wk("2026-11-07", "2026-11-08"));
    expect(set("last 1 weekends", sat)).toEqual(wk("2026-11-14"));
    expect(set("last 1 weekends", sun)).toEqual(wk("2026-11-14", "2026-11-15"));
    expect(set("last 1 weekends", mon)).toEqual(wk("2026-11-14", "2026-11-15"));
  });

  test("this, next and last weekend are two-day sets", () => {
    const wk = (...days: string[]) => ({ kind: "dates", dates: days, label: "Weekends" });
    expect(set("this weekend")).toEqual(wk("2026-11-21", "2026-11-22"));
    expect(set("next weekend")).toEqual(wk("2026-11-28", "2026-11-29"));
    expect(set("last weekend")).toEqual(wk("2026-11-14", "2026-11-15"));
    // On a Sunday, this weekend is the one that started yesterday.
    expect(set("this weekend", { today: "2026-11-15" })).toEqual(wk("2026-11-14", "2026-11-15"));
    expect(set("this weekend", { today: "2026-11-14" })).toEqual(wk("2026-11-14", "2026-11-15"));
    expect(set("this weekend", { maxDate: "2026-11-21" })).toEqual(wk("2026-11-21"));
    expect(set("this weekend", { weekendsLabel: "Wochenende" })).toEqual(
      expect.objectContaining({ label: "Wochenende" }),
    );
    // Without sets, and without a window, no match.
    expect(parse("this weekend")).toEqual(none);
    for (const text of ["weekends", "weekdays", "fridays", "weekend"]) {
      expect(set(text)).toEqual(none);
    }
  });

  test("last friday and last 1 fridays mean different days, as documented", () => {
    // Friday of the previous week, versus the most recent Friday on or
    // before today.
    expect(set("last friday", { today: "2026-11-20" })).toEqual(date("2026-11-13"));
    expect(set("last 1 fridays", { today: "2026-11-20" })).toEqual({
      kind: "dates",
      dates: ["2026-11-20"],
      label: "Fridays",
    });
  });

  test("set words complete only where a set can follow", () => {
    const on = { sets: true, locale: "en-US" };
    expect(completeDatePhrase("10 S", on)).toBe("eptember");
    expect(completeDatePhrase("10 F", on)).toBe("ebruary");
    expect(completeDatePhrase("10 T", on)).toBe("o");
    expect(completeDatePhrase("Sep 10 S", on)).toBe(
      completeDatePhrase("Sep 10 S", { locale: "en-US" }),
    );
    expect(completeDatePhrase("last 3 F", on)).toBe("ridays");
    expect(completeDatePhrase("next 2 W", on)).toBe("eeks");
  });

  test("with sets on, completing a prefix of an ordinary phrase is unchanged", () => {
    const source = readFileSync(new URL(import.meta.url).pathname, "utf8");
    const phrases = [...new Set([...source.matchAll(/"([^"\\\n]{1,60})"/g)].map((m) => m[1]!))];
    let checked = 0;
    for (const text of phrases) {
      if (parseDatePhrase(text, { today: "2026-11-18", locale: "en-US" }).kind === "none") continue;
      for (let i = 1; i <= text.length; i++) {
        const prefix = text.slice(0, i);
        checked++;
        expect({
          prefix,
          ghost: completeDatePhrase(prefix, { locale: "en-US", sets: true }),
        }).toEqual({
          prefix,
          ghost: completeDatePhrase(prefix, { locale: "en-US" }),
        });
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
