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
const PREFIX = `${STORAGE_KEY}.browser.v1.`;
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
  test.each([false, true])(
    "another tab's disabled receipt cancels backoff (reply: %s)",
    async (reply) => {
      const reporter = start();
      await settle();
      statuses = ["held", 503];
      reporter.reportVisit(VISIT);
      reporter.reportScreen("A");
      await settle();
      expect(jest.getTimerCount()).toBe(1);
      statuses = [{ status: 202, data: { status: "disabled" } }];
      const other = start();
      other.reportVisit(VISIT);
      await settle();
      other();
      if (reply) release(202);
      else focus();
      await settle();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  test("a successful held visit resets failures without advancing a screen retry", async () => {
    const reporter = start();
    await settle();
    statuses = ["held", 503, 503, 202];
    reporter.reportVisit(VISIT);
    reporter.reportScreen("A");
    await settle();
    await advance(500);
    release(202);
    await settle();
    await advance(499);
    expect(sent).toHaveLength(3);
    await advance(1);
    expect(sent).toHaveLength(4);
    await advance(999);
    expect(sent).toHaveLength(4);
    await advance(1);
    expect(sent).toHaveLength(5);
  });

  test.each([202, 400])("typed callbacks claim terminal %s", async (status) => {
    statuses = [status];
    for (const key of [STORAGE_KEY, `${PREFIX}quiet`, `${PREFIX}check`]) stored.set(key, "invalid");
    const options: AppOpenedOptions = {
      route: ROUTE,
      surface: "web",
      storageKey: STORAGE_KEY,
      post: async (route: string, event: AppOpenedEvent) => post(route, event),
    };
    const stop: () => void = startAppOpenedReporting(options);
    stops.push(stop);
    await settle();
    await advance(60000);
    focus();
    stop();
    start();
    await settle();
    expect(sent).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
    ]);
    start("example.other.web");
    await settle();
    start("example.other.web");
    await settle();
    expect(sent).toHaveLength(2);
    expect(stored.get(STORAGE_KEY)).toBe("2026-10-03");
    expect(stored.get("example.other.web")).toBe("2026-10-03");
  });

  test("screens dedupe across reload; a next-day visit checks before app-open and the active screen", async () => {
    stored.set(`${PREFIX}screen.A%2FB`, "invalid");
    const reporter = start();
    reporter.reportScreen("A/B");
    reporter.reportScreen("B");
    reporter.reportScreen("A/B");
    await settle();
    focus();
    reporter();
    const reloaded = start();
    reloaded.reportScreen("A/B");
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "screen_viewed",
      "screen_viewed",
    ]);
    expect(sent[1]?.event.properties).toEqual({ surface: "web", screen: "A/B" });
    expect(stored.get(`${PREFIX}screen.A%2FB`)).toBe("2026-10-03");
    jest.setSystemTime(DAY_TWO);
    reloaded.reportVisit(VISIT);
    await settle();
    focus();
    await settle();
    expect(sent.slice(3).map(({ event }) => event.event)).toEqual([
      "session_ended",
      "app_opened",
      "screen_viewed",
    ]);
  });

  test.each([
    ["queued", false],
    ["skipped", false],
    ["disabled", false],
    ["disabled", true],
  ] as const)(
    "first receipt %s releases or drops held visits (legacy date: %s)",
    async (status, legacyDate) => {
      stored.set(`${PREFIX}quiet`, "2026-10-02");
      if (legacyDate) stored.set(STORAGE_KEY, "2026-10-03");
      statuses = ["held"];
      const reporter = start();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      for (let i = 0; i < 8; i++) reporter.reportVisit(VISIT, { keepalive: true });
      reporter.reportScreen("A");
      expect(quiet).toEqual([true]);
      expect(sent).toHaveLength(1);
      release({ status: 202, data: { status } });
      await settle();
      expect(quiet).toEqual(status === "disabled" ? [true] : [true, false]);
      expect(sent).toHaveLength(status === "disabled" ? 1 : 10);
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

  test("visit failures share backoff and a terminal response resets consecutive failures", async () => {
    const reporter = start();
    await settle();
    for (let i = 0; i < 6; i++) {
      statuses = [503];
      reporter.reportVisit(VISIT);
      await settle();
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
    jest.setSystemTime(new Date("2026-10-03T23:59:59.500Z"));
    statuses = [503];
    reporter.reportScreen("B");
    await settle();
    await advance(2000);
    expect(sent.slice(4).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
  });

  test("late prior-day disabled is ignored, and cleanup cancels screen retries", async () => {
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

  test("500 replies retry app-open and screen before claiming either", async () => {
    statuses = [
      500,
      502,
      503,
      504,
      "offline",
      { status: 202, data: { status: "queued" } },
      500,
      { status: 202, data: { status: "queued" } },
    ];
    const reporter = start();
    reporter.reportScreen("A");
    await settle();
    expect(stored.has(STORAGE_KEY)).toBe(false);
    for (const [i, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
      await advance(delay - 1);
      expect(sent).toHaveLength(i + 1);
      await advance(1);
    }
    expect(stored.get(`${PREFIX}screen.A`)).toBeUndefined();
    await advance(1000);
    focus();
    reporter.reportScreen("A");
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "app_opened",
      "app_opened",
      "app_opened",
      "app_opened",
      "app_opened",
      "screen_viewed",
      "screen_viewed",
    ]);
  });
  test("concurrent visits stop at six failures until the next UTC day", async () => {
    const reporter = start();
    await settle();
    statuses = Array(6).fill(503);
    for (let i = 0; i < 20; i++) reporter.reportVisit(VISIT);
    await settle();
    expect(sent).toHaveLength(7);
    await advance(60 * 60000);
    focus();
    reporter.reportScreen("A");
    expect(sent).toHaveLength(7);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(7).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
  });

  test("a terminal receipt frees only its own unresolved request slot", async () => {
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

  test("rollover frees old reservations and late replies preserve current reservations", async () => {
    const reporter = start();
    await settle();
    statuses = Array(6).fill("held");
    for (let i = 0; i < 6; i++) reporter.reportVisit(VISIT);
    const oldReply = release;
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent).toHaveLength(8);
    statuses = Array(6).fill("held");
    for (let i = 0; i < 6; i++) reporter.reportVisit(VISIT);
    oldReply(202);
    await settle();
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(14);
  });
});
