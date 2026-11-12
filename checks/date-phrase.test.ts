import { describe, expect, test } from "bun:test";
import {
  completeDatePhrase,
  datePhraseRange,
  daysInRange,
  formatDateRangeLabel,
  parseDatePhrase,
  type DatePhraseOptions,
} from "../src/lib/components/date-phrase.js";

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
    ["Sep 10 26", "2026-09-10"],
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
    ["Sep 10 26", "2026-09-10"],
    ["Sep 10 46", "2046-09-10"],
    ["Sep 10 47", "1947-09-10"],
    ["Sep 10 99", "1999-09-10"],
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
    // An explicit year is taken literally, so this one swaps instead.
    expect(parse("Dec 20 to Jan 5 2026")).toEqual(range("2026-01-05", "2026-12-20"));
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
