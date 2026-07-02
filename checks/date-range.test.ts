import { describe, expect, test } from "bun:test";
import {
  formatDayLabel,
  formatMonthLabel,
  formatShortDate,
  formatWeekOfLabel,
  weekdayLabels,
} from "../src/lib/components/date-range.js";

describe("formatWeekOfLabel", () => {
  test("substitutes a {date} placeholder", () => {
    expect(formatWeekOfLabel("Week of {date}", "Jun 29")).toBe("Week of Jun 29");
  });

  test("date-first locales place the date anywhere", () => {
    expect(formatWeekOfLabel("{date}所在周", "6月29日")).toBe("6月29日所在周");
  });

  test("a template without {date} stays a prefix (legacy behavior)", () => {
    expect(formatWeekOfLabel("Week of", "Jun 29")).toBe("Week of Jun 29");
  });
});

// The Calendar/RangePicker `locale` prop threads a BCP 47 tag into these so
// date labels can follow an app language setting instead of the browser
// locale.
describe("date label locale", () => {
  test("formatShortDate", () => {
    expect(formatShortDate("2026-06-29", "en-US")).toBe("Jun 29");
    expect(formatShortDate("2026-06-29", "zh-CN")).toBe("6月29日");
  });

  test("formatDayLabel", () => {
    expect(formatDayLabel("2026-06-29", "en-US")).toBe("Jun 29, 2026");
    expect(formatDayLabel("2026-06-29", "zh-CN")).toBe("2026年6月29日");
  });

  test("formatMonthLabel", () => {
    expect(formatMonthLabel("2026-06-29", "en-US")).toBe("June 2026");
    expect(formatMonthLabel("2026-06-29", "zh-CN")).toBe("2026年6月");
  });

  test("weekdayLabels stay Monday-first in every locale", () => {
    expect(weekdayLabels("en-US")[0]).toBe("Mon");
    expect(weekdayLabels("zh-CN")[0]).toBe("周一");
    expect(weekdayLabels("en-US")).toHaveLength(7);
  });
});
