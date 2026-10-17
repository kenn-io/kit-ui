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
const VISIT = {
  event: "session_ended",
  properties: { surface: "web", duration_bucket: "under_1m" },
};
const STATE = { version: 1, day: "2026-10-03", quiet: false, screens: [] };
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
      reporter.reportVisit(VISIT, { keepalive: true });
      reporter.reportScreen("A");
      expect(sent).toHaveLength(1);
      release({ status: 202, data: { status } });
      await settle();
      expect(sent).toHaveLength(status === "disabled" ? 1 : 3);
      if (status !== "disabled")
        expect(sent.find(({ event }) => event.event === "session_ended")).toEqual({
          route: ROUTE,
          event: VISIT,
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
    reporter.reportVisit(VISIT);
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
    first.reportVisit(VISIT);
    await settle();
    expect(quiet).toBe(false);
    expect(sent).toHaveLength(3);
  });

  test("enabled visits bypass held screens, and disabled beats a later queued reply", async () => {
    const reporter = start();
    await settle();
    statuses = ["held", { status: 202, data: { status: "disabled" } }];
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent).toHaveLength(3);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    reporter.reportScreen("B");
    reporter.reportVisit(VISIT);
    focus();
    await settle();
    expect(sent).toHaveLength(3);
  });

  test("visit failures share backoff and stop after six failures", async () => {
    const reporter = start();
    await settle();
    statuses = Array(6).fill(503);
    for (const [i, delay] of [1000, 2000, 4000, 8000, 16000, 32000].entries()) {
      reporter.reportVisit(VISIT);
      await settle();
      reporter.reportVisit(VISIT);
      await advance(delay - 1);
      expect(sent).toHaveLength(i + 2);
      await advance(1);
    }
    reporter.reportVisit(VISIT);
    reporter.reportScreen("A");
    focus();
    await settle();
    expect(sent).toHaveLength(7);
  });

  test("visit failures share backoff and a terminal response resets consecutive failures", async () => {
    const reporter = start();
    await settle();
    for (let i = 0; i < 6; i++) {
      statuses = [503];
      reporter.reportVisit(VISIT);
      await settle();
      reporter.reportVisit(VISIT);
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
    reporter.reportVisit(VISIT);
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

  test.each([400, 202])("terminal status %s ends a day's attempt", async (status) => {
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
    reporter.reportVisit(VISIT);
    await settle();
    focus();
    await settle();
    expect(sent.slice(2).map(({ event }) => event.event)).toEqual([
      "session_ended",
      "app_opened",
      "screen_viewed",
    ]);
  });
  test("a legacy app date still makes one receipt check and holds visits", async () => {
    stored.set(STORAGE_KEY, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(1);
    release({ status: 202, data: { status: "disabled" } });
    await settle();
    expect(sent).toHaveLength(1);
  });

  test.each([false, true])(
    "one user-triggered retry chain after 15 minutes caps a dead daemon at twelve: %s",
    async (visitTrigger) => {
      statuses = Array(12).fill(503);
      const reporter = start();
      await settle();
      for (const delay of [1000, 2000, 4000, 8000, 16000]) await advance(delay);
      await advance(15 * 60000 - 1);
      focus();
      await settle();
      expect(sent).toHaveLength(6);
      await advance(1);
      expect(sent).toHaveLength(6);
      if (visitTrigger) reporter.reportVisit(VISIT, { keepalive: true });
      else focus();
      await settle();
      expect(sent).toHaveLength(7);
      for (const delay of [1000, 2000, 4000, 8000, 16000]) await advance(delay);
      await advance(60 * 60000);
      focus();
      reporter.reportVisit(VISIT);
      await settle();
      expect(sent).toHaveLength(12);
      jest.setSystemTime(DAY_TWO);
      focus();
      await settle();
      expect(sent).toHaveLength(13);
    },
  );

  test.each([
    { ...STATE, version: 2 },
    { ...STATE, day: "2026-02-30" },
    { ...STATE, quiet: "false" },
    { ...STATE, screens: [12] },
    "broken JSON",
  ])("refuses unknown or malformed state without overwriting either key: %p", async (value) => {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    stored.set(STORAGE_KEY, "2026-10-02");
    stored.set(`${STORAGE_KEY}.state`, raw);
    const reporter = start();
    let quiet = false;
    reporter.onQuietChange((value) => (quiet = value));
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT);
    focus();
    await settle();
    expect(sent).toHaveLength(0);
    expect(quiet).toBe(true);
    expect([...stored.values()]).toEqual(["2026-10-02", raw]);
  });

  test("500 replies retry app-open and screen before claiming either", async () => {
    statuses = [
      500,
      { status: 202, data: { status: "queued" } },
      500,
      { status: 202, data: { status: "queued" } },
    ];
    const reporter = start();
    reporter.reportScreen("A");
    await settle();
    expect(stored.has(STORAGE_KEY)).toBe(false);
    await advance(1000);
    expect(JSON.parse(stored.get(`${STORAGE_KEY}.state`)!).screens).toEqual([]);
    await advance(1000);
    focus();
    reporter.reportScreen("A");
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "app_opened",
      "screen_viewed",
      "screen_viewed",
    ]);
  });
  test("concurrent visits cannot oversubscribe either six-attempt burst", async () => {
    const reporter = start();
    await settle();
    statuses = Array(12).fill(503);
    for (let i = 0; i < 20; i++) reporter.reportVisit(VISIT);
    await settle();
    expect(sent).toHaveLength(7);
    await advance(15 * 60000);
    for (let i = 0; i < 20; i++) reporter.reportVisit(VISIT);
    await settle();
    expect(sent).toHaveLength(13);
  });

  test("a terminal receipt resets failures while other unresolved posts retain their slots", async () => {
    const reporter = start();
    await settle();
    statuses = Array(6).fill("held");
    for (let i = 0; i < 6; i++) reporter.reportVisit(VISIT);
    release(202);
    await settle();
    statuses = Array(20).fill(503);
    for (let i = 0; i < 20; i++) reporter.reportVisit(VISIT);
    await settle();
    expect(sent).toHaveLength(8);
  });
});
