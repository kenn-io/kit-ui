import { describe, expect, test } from "bun:test";
import {
  completeDatePhrase,
  DATE_PHRASE_MAX_LENGTH,
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

const none = { kind: "none" };

describe("single dates", () => {
  test.each([
    ["today", "2026-11-12"],
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
    expect(parse("last 30 days")).toEqual(range("2026-10-14", "2026-11-12"));
    expect(parse("past 7 days")).toEqual(range("2026-11-06", "2026-11-12"));
    expect(parse("last 2 weeks")).toEqual(range("2026-10-30", "2026-11-12"));
    expect(parse("last 3 months")).toEqual(range("2026-08-13", "2026-11-12"));
    expect(parse("past week")).toEqual(range("2026-11-06", "2026-11-12"));
    expect(parse("last 1 year")).toEqual(range("2025-11-13", "2026-11-12"));
    expect(parse("next 10 days")).toEqual(range("2026-11-12", "2026-11-21"));
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
      range("2026-12-28", "2027-01-03"),
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
    expect(parse("today", { maxDate: "2026-11-12" })).toEqual(date("2026-11-12"));
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
