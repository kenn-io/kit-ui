import { describe, expect, jest, test } from "bun:test";
import { createRefreshScheduler, formatRefreshAge } from "../src/lib/utils/refresh.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = 1_750_000_000_000;

test("refresh scheduler forwards immediate reasons and resets automatic ticks", () => {
  jest.useFakeTimers();
  const reasons: string[] = [];
  const scheduler = createRefreshScheduler((reason) => reasons.push(reason), 1000);
  try {
    scheduler.scheduleNext();
    expect(reasons).toEqual([]);
    jest.advanceTimersByTime(100);
    scheduler.refreshNow("manual");
    expect(reasons).toEqual(["manual"]);
    jest.advanceTimersByTime(900);
    expect(reasons).toEqual(["manual"]);
    jest.advanceTimersByTime(100);
    expect(reasons).toEqual(["manual", "auto"]);
    scheduler.refreshNow("auto");
    expect(reasons).toEqual(["manual", "auto", "auto"]);
  } finally {
    scheduler.stop();
    jest.useRealTimers();
  }
});

// formatRefreshAge is RefreshControl's default `formatAge`; consumers swap in
// their own formatter to localize, so the default English strings are the
// contract under test.
describe("formatRefreshAge", () => {
  test("null (never updated) renders a dash", () => {
    expect(formatRefreshAge(null, NOW)).toBe("—");
  });

  test("under a minute is 'just now'", () => {
    expect(formatRefreshAge(NOW, NOW)).toBe("Updated just now");
    expect(formatRefreshAge(NOW - MINUTE + 1, NOW)).toBe("Updated just now");
  });

  test("minutes until an hour", () => {
    expect(formatRefreshAge(NOW - MINUTE, NOW)).toBe("Updated 1m ago");
    expect(formatRefreshAge(NOW - 59 * MINUTE, NOW)).toBe("Updated 59m ago");
  });

  test("hours until a day", () => {
    expect(formatRefreshAge(NOW - HOUR, NOW)).toBe("Updated 1h ago");
    expect(formatRefreshAge(NOW - 23 * HOUR, NOW)).toBe("Updated 23h ago");
  });

  test("days beyond that", () => {
    expect(formatRefreshAge(NOW - DAY, NOW)).toBe("Updated 1d ago");
    expect(formatRefreshAge(NOW - 10 * DAY, NOW)).toBe("Updated 10d ago");
  });

  test("a now earlier than lastUpdatedAt still reads 'just now'", () => {
    // RefreshControl clamps its clock so formatAge never sees a negative
    // age, but the default formatter tolerates one anyway (defense in depth
    // for direct callers with skewed clocks).
    expect(formatRefreshAge(NOW + 30 * MINUTE, NOW)).toBe("Updated just now");
  });
});
