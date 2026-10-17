import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
  startAppOpenedReporting,
  type BrowserTelemetryEvent,
  type BrowserTelemetryOptions,
  type AppOpenedEvent,
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

const post: BrowserTelemetryOptions["post"] = (route, event, options) => {
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
const advance = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  await settle();
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
  test("legacy typed callback sends app-open once across focus and reload", async () => {
    const options: AppOpenedOptions = {
      route: ROUTE,
      surface: "web",
      storageKey: STORAGE_KEY,
      post: async (route: string, event: AppOpenedEvent) => post(route, event),
    };
    const stop: () => void = startAppOpenedReporting(options);
    stops.push(stop);
    await settle();
    focus();
    stop();
    start();
    await settle();
    expect(sent).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
    ]);
  });

  test("screens A/B/A dedupe across reload and report the active screen next day", async () => {
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
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "screen_viewed",
      "screen_viewed",
    ]);
    expect(sent[1]?.event.properties).toEqual({ surface: "web", screen: "A" });
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(3).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
  });

  test.each(["queued", "skipped", "disabled"])(
    "first receipt %s releases or drops held visits",
    async (status) => {
      statuses = ["held"];
      const reporter = start();
      const visit = { event: "session_ended", properties: { duration_seconds: 12 } };
      reporter.reportVisit(visit, { keepalive: true });
      reporter.reportScreen("A");
      expect(sent).toHaveLength(1);
      release({ status: 202, data: { status } });
      await settle();
      expect(sent).toHaveLength(status === "disabled" ? 1 : 3);
      if (status !== "disabled")
        expect(sent.find(({ event }) => event.event === "session_ended")).toEqual({
          route: ROUTE,
          event: visit,
          options: { keepalive: true },
        });
    },
  );

  test("disabled persists across reload, stops a tracker, and resumes on next-day focus", async () => {
    statuses = [new Response(JSON.stringify({ status: "disabled" }), { status: 202 })];
    const reporter = start();
    let ticks = 0;
    let timer: ReturnType<typeof setInterval>;
    reporter.onQuietChange((quiet) => {
      clearInterval(timer);
      if (!quiet) timer = setInterval(() => ticks++, 100);
    });
    await settle();
    reporter.reportScreen("A");
    reporter.reportVisit({ event: "session_ended", properties: {} });
    const reloaded = start();
    reloaded.reportScreen("A");
    focus();
    jest.advanceTimersByTime(1000);
    expect(sent).toHaveLength(1);
    expect(ticks).toBe(0);
    reloaded();
    statuses = [{ status: 202, data: { status: "skipped" } }];
    jest.setSystemTime(DAY_TWO);
    focus();
    focus();
    await settle();
    jest.advanceTimersByTime(100);
    expect(ticks).toBe(1);
    expect(sent).toHaveLength(3);
    reporter();
    jest.advanceTimersByTime(1000);
    expect(ticks).toBe(1);
  });

  test("another tab's next-day enabled check resumes a quiet tab without a duplicate", async () => {
    statuses = [{ status: 202, data: { status: "disabled" } }];
    const first = start();
    await settle();
    let quiet = false;
    first.onQuietChange((value) => (quiet = value));
    jest.setSystemTime(DAY_TWO);
    statuses = [{ status: 202, data: { status: "queued" } }];
    const second = start();
    await settle();
    second();
    focus();
    await settle();
    first.reportVisit({ event: "session_ended", properties: {} });
    await settle();
    expect(quiet).toBe(false);
    expect(sent).toHaveLength(3);
  });

  test("enabled visits bypass held screens, and disabled beats a later queued reply", async () => {
    const reporter = start();
    await settle();
    statuses = ["held", { status: 202, data: { status: "disabled" } }];
    reporter.reportScreen("A");
    reporter.reportVisit({ event: "session_ended", properties: {} }, { keepalive: true });
    await settle();
    expect(sent).toHaveLength(3);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    reporter.reportScreen("B");
    reporter.reportVisit({ event: "session_ended", properties: {} });
    focus();
    await settle();
    expect(sent).toHaveLength(3);
  });

  test.each([false, true])(
    "six consecutive failures cap daily and visit reports: %s",
    async (visitsOnly) => {
      statuses = visitsOnly ? [] : Array(6).fill(503);
      const reporter = start();
      await settle();
      if (visitsOnly) statuses = Array(6).fill(503);
      for (const [i, delay] of [1000, 2000, 4000, 8000, 16000, 32000].entries()) {
        if (visitsOnly) reporter.reportVisit({ event: "session_ended", properties: {} });
        await settle();
        const count = i + (visitsOnly ? 2 : 1);
        reporter.reportVisit({ event: "session_ended", properties: {} });
        await advance(delay - 1);
        expect(sent).toHaveLength(count);
        await advance(1);
      }
      const count = visitsOnly ? 7 : 6;
      reporter.reportVisit({ event: "session_ended", properties: {} });
      reporter.reportScreen("A");
      focus();
      await advance(60000);
      expect(sent).toHaveLength(count);
      jest.setSystemTime(DAY_TWO);
      focus();
      await settle();
      expect(sent).toHaveLength(count + 2);
    },
  );

  test("visit failures share backoff and a terminal response resets consecutive failures", async () => {
    const reporter = start();
    await settle();
    for (let i = 0; i < 6; i++) {
      statuses = [503];
      reporter.reportVisit({ event: "session_ended", properties: {} });
      await settle();
      reporter.reportVisit({ event: "session_ended", properties: {} });
      await advance(1000);
      reporter.reportScreen(String(i));
      await settle();
    }
    expect(sent).toHaveLength(13);
  });

  test.each([false, true])(
    "failed writes and blocked storage keep page claims: %s",
    async (blocked) => {
      stored.set(STORAGE_KEY, "2026-10-02");
      if (blocked) blockStorage();
      else
        g.localStorage = {
          getItem: (key: string) => stored.get(key) ?? null,
          setItem: () => {
            throw new DOMException("full", "QuotaExceededError");
          },
        };
      const reporter = start();
      await settle();
      reporter.reportScreen("A");
      await settle();
      focus();
      reporter.reportScreen("A");
      await settle();
      expect(sent).toHaveLength(2);
    },
  );

  test("another tab's screen claim cancels a screen retry", async () => {
    const reporter = start();
    await settle();
    statuses = [503];
    reporter.reportScreen("A");
    await settle();
    const other = start();
    other.reportScreen("A");
    await settle();
    other();
    await advance(1000);
    expect(sent).toHaveLength(3);
  });

  test("a late old-day reply preserves another tab's current claims, and cleanup cancels retries", async () => {
    statuses = ["held"];
    const reporter = start();
    const yesterday = release;
    jest.setSystemTime(DAY_TWO);
    const other = start();
    await settle();
    other();
    yesterday({ status: 202, data: { status: "disabled" } });
    await settle();
    focus();
    reporter.reportVisit({ event: "session_ended", properties: {} });
    await settle();
    statuses = [503];
    reporter.reportScreen("A");
    await settle();
    reporter();
    await advance(60000);
    focus();
    await settle();
    expect(sent).toHaveLength(4);
  });

  test.each([400, 500, 202])("terminal status %s ends a day's attempt", async (status) => {
    statuses = [status];
    start();
    await settle();
    jest.advanceTimersByTime(60000);
    start();
    await settle();
    expect(sent).toHaveLength(1);
  });
  test("a visit makes a new day's first check and preserves its active screen", async () => {
    const reporter = start();
    reporter.reportScreen("A");
    await settle();
    jest.setSystemTime(DAY_TWO);
    reporter.reportVisit({ event: "session_ended", properties: {} });
    await settle();
    focus();
    await settle();
    expect(sent.slice(2).map(({ event }) => event.event)).toEqual([
      "session_ended",
      "app_opened",
      "screen_viewed",
    ]);
  });
});
