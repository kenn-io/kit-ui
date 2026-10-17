import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
  startAppOpenedReporting,
  type BrowserTelemetryEvent,
  type AppOpenedOptions,
} from "../src/lib/utils/app-opened.js";

const ROUTE = "/api/v1/telemetry/events";
const STORAGE_KEY = "kit-ui.app-opened.example.web";
const DAY_ONE = new Date("2026-10-03T12:00:00Z");
const DAY_TWO = new Date("2026-10-04T00:30:00Z");

const g = globalThis as Record<string, unknown>;
let stored: Map<string, string>;
let sent: { route: string; event: BrowserTelemetryEvent; options?: { keepalive?: boolean } }[];
type Reply = Awaited<ReturnType<AppOpenedOptions["post"]>>;
let statuses: (number | "offline" | "held" | Reply)[];
let release: (status: number | Reply) => void;
let stops: (() => void)[];

const post: AppOpenedOptions["post"] = (route, event, options) => {
  sent.push(options ? { route, event, options } : { route, event });
  const next = statuses.shift() ?? 202;
  if (next === "held")
    return new Promise<Reply>(
      (resolve) =>
        (release = (status) => resolve(typeof status === "number" ? { status } : status)),
    );
  return next === "offline"
    ? Promise.reject(new TypeError("Failed to fetch"))
    : Promise.resolve(typeof next === "number" ? { status: next } : next);
};
const start = (storageKey = STORAGE_KEY) => {
  const stop = startAppOpenedReporting({ route: ROUTE, surface: "web", storageKey, post });
  stops.push(stop);
  return stop;
};
const focus = () => window.dispatchEvent(new Event("focus"));
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const blockStorage = () => {
  g.localStorage = {
    getItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  };
};

beforeEach(() => {
  stored = new Map();
  sent = [];
  statuses = [];
  stops = [];
  g.window = globalThis;
  g.localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
  };
  jest.useFakeTimers({ now: DAY_ONE });
});

afterEach(() => {
  for (const stop of stops) stop();
  jest.useRealTimers();
  delete g.localStorage;
  delete g.window;
});

describe("startAppOpenedReporting", () => {
  test("load sends one app_opened with the surface to the route", async () => {
    start();
    await settle();
    expect(sent).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
    ]);
  });

  test("a focus the same day sends nothing", async () => {
    start();
    await settle();
    focus();
    focus();
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("a focus on the next UTC day sends one more", async () => {
    start();
    await settle();
    jest.setSystemTime(DAY_TWO);
    focus();
    focus();
    await settle();
    expect(sent).toHaveLength(2);
  });

  test("a reload the same day sends nothing", async () => {
    const stop = start();
    await settle();
    stop();
    start();
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("products sharing an origin record their days independently", async () => {
    start("kit-ui.app-opened.first.web");
    await settle();
    start("kit-ui.app-opened.second.web");
    await settle();
    start("kit-ui.app-opened.first.web");
    start("kit-ui.app-opened.second.web");
    await settle();
    expect(sent).toHaveLength(2);
    expect([...stored.entries()]).toEqual([
      ["kit-ui.app-opened.first.web", "2026-10-03"],
      ["kit-ui.app-opened.second.web", "2026-10-03"],
    ]);
  });

  test("blocked storage sends at most one per page load", async () => {
    blockStorage();
    start();
    await settle();
    focus();
    focus();
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("waits for the backend to answer, then keeps the day", async () => {
    statuses = ["offline", 503];
    start();
    await settle();
    focus();
    expect(sent).toHaveLength(1);
    expect(stored.size).toBe(0);
    jest.advanceTimersByTime(1000);
    await settle();
    jest.advanceTimersByTime(2000);
    await settle();
    expect(sent).toHaveLength(3);
    expect([...stored.values()]).toEqual(["2026-10-03"]);
    jest.advanceTimersByTime(5000);
    await settle();
    expect(sent).toHaveLength(3);
  });

  test("six failures exhaust the day across focus and screen changes", async () => {
    statuses = Array(6).fill(503);
    const reporter = start();
    await settle();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      jest.advanceTimersByTime(delay - 1);
      await settle();
      const count = sent.length;
      jest.advanceTimersByTime(1);
      await settle();
      expect(sent).toHaveLength(count + 1);
    }
    reporter.reportScreen("settings");
    focus();
    jest.advanceTimersByTime(60000);
    await settle();
    expect(sent).toHaveLength(6);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(6).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
  });

  test("a new day's focus cancels yesterday's timer and resets backoff", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-03T23:59:58.500Z") });
    statuses = [503, 503, "held"];
    const stop = start();
    await settle();
    jest.advanceTimersByTime(1000);
    await settle();
    jest.advanceTimersByTime(1000);
    focus();
    await settle();
    jest.advanceTimersByTime(2000);
    await settle();
    expect(sent).toHaveLength(3);
    release(503);
    await settle();
    jest.advanceTimersByTime(1000);
    await settle();
    expect(sent).toHaveLength(4);
    expect([...stored.values()]).toEqual(["2026-10-04"]);
    stop();
    jest.advanceTimersByTime(60000);
    await settle();
    expect(sent).toHaveLength(4);
  });

  test("yesterday's in-flight failure cannot start another retry chain", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-03T23:59:59.500Z") });
    statuses = ["held", "held", 503];
    const stop = start();
    const releaseYesterday = release;
    jest.advanceTimersByTime(1000);
    focus();
    releaseYesterday(503);
    await settle();
    jest.advanceTimersByTime(1000);
    await settle();
    expect(sent).toHaveLength(2);
    release(503);
    await settle();
    jest.advanceTimersByTime(1000);
    await settle();
    expect(sent).toHaveLength(3);
    stop();
    jest.advanceTimersByTime(60000);
    await settle();
    expect(sent).toHaveLength(3);
  });

  test("a retry that lands after UTC midnight counts for the new day", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-03T23:59:59.500Z") });
    statuses = [503];
    start();
    await settle();
    jest.advanceTimersByTime(1000);
    await settle();
    focus();
    await settle();
    expect(sent).toHaveLength(2);
    expect([...stored.values()]).toEqual(["2026-10-04"]);
  });

  test("a retry stops once another tab records the day", async () => {
    statuses = ["offline"];
    start();
    await settle();
    stored.set(STORAGE_KEY, "2026-10-03");
    jest.advanceTimersByTime(5000);
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("a late answer keeps a later day another tab recorded", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-03T23:59:59.500Z") });
    statuses = ["held"];
    start();
    await settle();
    stored.set(STORAGE_KEY, "2026-10-04");
    release(202);
    await settle();
    expect([...stored.values()]).toEqual(["2026-10-04"]);
  });

  test.each([202, 400, 401, 500])("an HTTP %i ends the day's attempt", async (status) => {
    statuses = [status];
    start();
    await settle();
    jest.advanceTimersByTime(60000);
    await settle();
    start();
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("cleanup during an in-flight post prevents retries", async () => {
    statuses = ["held"];
    const stop = start();
    stop();
    release(503);
    await settle();
    jest.advanceTimersByTime(60000);
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("cleanup stops retries and focus reports", async () => {
    statuses = ["offline"];
    const stop = start();
    await settle();
    stop();
    jest.advanceTimersByTime(5000);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent).toHaveLength(1);
  });
  test("screen claims survive A/B/A, focus, reload, and reset at UTC midnight", async () => {
    const reporter = start();
    reporter.reportScreen("A");
    reporter.reportScreen("B");
    reporter.reportScreen("A");
    await settle();
    focus();
    reporter();
    const reloaded = start();
    reloaded.reportScreen("A");
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "B" } },
    ]);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(3).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
  });

  test("disabled latches across reload and one next-day focus resumes trackers", async () => {
    statuses = [new Response(JSON.stringify({ status: "disabled" }), { status: 202 })];
    const reporter = start();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    reporter.reportScreen("A");
    await settle();
    reporter.reportVisit({ event: "session_ended", properties: { duration: 20 } });
    focus();
    reporter();
    const reloaded = start();
    reloaded.onQuietChange((value) => quiet.push(value));
    reloaded.reportScreen("B");
    await settle();
    expect(sent).toHaveLength(1);
    statuses = [{ status: 202, data: { status: "queued" } }];
    jest.setSystemTime(DAY_TWO);
    // Quiet calls remain inert until load/focus rechecks the date.
    reloaded.reportVisit({ event: "session_ended", properties: {} });
    expect(sent).toHaveLength(1);
    focus();
    focus();
    await settle();
    expect(sent.slice(1).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
    expect(quiet).toEqual([false, true, true, false]);
  });

  test("visits post immediately with keepalive while a daily report is held", async () => {
    statuses = ["held", { status: 202, data: { status: "disabled" } }];
    const reporter = start();
    const visit = {
      event: "session_ended" as const,
      properties: { duration_seconds: 12, screen: "A" },
    };
    reporter.reportVisit(visit, { keepalive: true });
    await settle();
    expect(sent[1]).toEqual({ route: ROUTE, event: visit, options: { keepalive: true } });
    release({ status: 202, data: { status: "queued" } });
    await settle();
    reporter.reportScreen("B");
    reporter.reportVisit(visit);
    focus();
    await settle();
    expect(sent).toHaveLength(2);
  });

  test("blocked storage still dedupes screens and latches disabled", async () => {
    blockStorage();
    const reporter = start();
    await settle();
    reporter.reportScreen("A");
    await settle();
    reporter.reportScreen("A");
    statuses = [{ status: 202, data: { status: "disabled" } }];
    reporter.reportScreen("B");
    await settle();
    reporter.reportScreen("C");
    focus();
    await settle();
    expect(sent).toHaveLength(3);
  });

  test("screen first checks once when app-open was already claimed", async () => {
    stored.set(STORAGE_KEY, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    reporter.reportScreen("A");
    reporter.reportScreen("B");
    expect(sent).toHaveLength(1);
    release({ status: 202, data: { status: "disabled" } });
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("cleanup signals quiet and ignores queued screens and visit replies", async () => {
    statuses = ["held"];
    const reporter = start();
    const changes: boolean[] = [];
    reporter.onQuietChange((value) => changes.push(value));
    reporter.reportScreen("A");
    reporter();
    release({ status: 202, data: { status: "queued" } });
    reporter.reportVisit({ event: "session_ended", properties: {} });
    await settle();
    expect(sent).toHaveLength(1);
    expect(changes).toEqual([false, true]);
  });

  test("quiet methods avoid storage reads, and unsubscribe stops notifications", async () => {
    statuses = [{ status: 202, data: { status: "disabled" } }];
    const reporter = start();
    const changes: boolean[] = [];
    const unsubscribe = reporter.onQuietChange((value) => changes.push(value));
    unsubscribe();
    await settle();
    let reads = 0;
    g.localStorage = {
      getItem: () => {
        reads++;
        return null;
      },
    };
    reporter.reportScreen("B");
    reporter.reportVisit({ event: "session_ended", properties: {} });
    focus();
    expect(reads).toBe(0);
    expect(sent).toHaveLength(1);
    expect(changes).toEqual([false]);
  });

  test.each([
    { status: 202, data: { status: "unknown" } },
    { status: 200, data: { status: "disabled" } },
    new Response("invalid json", { status: 202 }),
  ])("unrecognized receipts retain terminal HTTP behavior: %p", async (reply) => {
    statuses = [reply];
    const reporter = start();
    reporter.reportScreen("A");
    await settle();
    expect(sent).toHaveLength(2);
    jest.advanceTimersByTime(60000);
    await settle();
    expect(sent).toHaveLength(2);
  });

  test("a screen claim in another tab cancels a pending screen retry", async () => {
    const reporter = start();
    await settle();
    statuses = [503];
    reporter.reportScreen("A");
    await settle();
    stored.set(`${STORAGE_KEY}.screens`, JSON.stringify({ day: "2026-10-03", screens: ["A"] }));
    jest.advanceTimersByTime(1000);
    await settle();
    expect(sent).toHaveLength(2);
  });

  test("a stale disabled receipt cannot quiet a new day's enabled gate", async () => {
    statuses = ["held"];
    const reporter = start();
    const yesterday = release;
    jest.setSystemTime(DAY_TWO);
    statuses = [{ status: 202, data: { status: "skipped" } }];
    focus();
    await settle();
    yesterday({ status: 202, data: { status: "disabled" } });
    await settle();
    reporter.reportVisit({ event: "session_ended", properties: {} });
    await settle();
    expect(sent).toHaveLength(3);
  });

  test("reload gets a fresh budget after six failed attempts", async () => {
    statuses = Array(6).fill("offline");
    const reporter = start();
    await settle();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      jest.advanceTimersByTime(delay);
      await settle();
    }
    reporter();
    start();
    await settle();
    expect(sent).toHaveLength(7);
    expect(stored.get(STORAGE_KEY)).toBe("2026-10-03");
  });
  test("a failed storage write keeps today's claim over yesterday's stored date", async () => {
    stored.set(STORAGE_KEY, "2026-10-02");
    g.localStorage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    const reporter = start();
    await settle();
    reporter();
    expect(sent).toHaveLength(1);
  });
});
