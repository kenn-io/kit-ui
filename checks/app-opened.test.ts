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
  test.each([
    401,
    { status: 202, data: { status: "unknown" } },
    new Response("broken", { status: 202 }),
  ])("a non-receipt response stays quiet without delivery claims: %p", async (reply) => {
    statuses = [reply];
    const reporter = start();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    await settle();
    reporter.reportVisit(VISIT);
    reporter.reportScreen("A");
    focus();
    await advance(60000);
    expect(sent).toHaveLength(1);
    expect(quiet).toEqual([true]);
    expect(stored.has(STORAGE_KEY)).toBe(false);
    expect(stored.has(`${PREFIX}check`)).toBe(false);
  });
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
    statuses = ["held", 503, 202, 503, 202];
    reporter.reportVisit(VISIT);
    reporter.reportScreen("A");
    await settle();
    await advance(500);
    reporter.reportVisit(VISIT, { keepalive: true });
    expect(sent).toHaveLength(4);
    release(202);
    await settle();
    await advance(499);
    expect(sent).toHaveLength(4);
    await advance(1);
    expect(sent).toHaveLength(5);
    await advance(999);
    expect(sent).toHaveLength(5);
    await advance(1);
    expect(sent).toHaveLength(6);
  });

  test("a typed status-only callback claims app-open across focus, reload, and product keys", async () => {
    statuses = [202];
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
    stored.delete(`${PREFIX}check`);
    start();
    await settle();
    focus();
    await settle();
    expect(sent).toHaveLength(3);
    expect(sent.at(-1)?.event.event).toBe("app_opened");
  });

  test("screens dedupe across reload; a next-day visit triggers a check and is dropped", async () => {
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
    expect(sent.slice(3).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
  });

  test.each([
    ["queued", false],
    ["disabled", false],
    ["queued", true],
    ["disabled", true],
  ] as const)(
    "first receipt %s gates visits and checks a claimed app date with its screen: %s",
    async (status, legacyDate) => {
      stored.set(`${PREFIX}quiet`, "2026-10-02");
      if (legacyDate) stored.set(STORAGE_KEY, "2026-10-03");
      statuses = ["held"];
      const reporter = start();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      reporter.reportVisit(VISIT);
      reporter.reportScreen("A");
      expect(quiet).toEqual([true]);
      await settle();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.event.event).toBe(legacyDate ? "screen_viewed" : "app_opened");
      statuses = status === "queued" && !legacyDate ? ["held"] : [];
      release({ status: 202, data: { status } });
      await settle();
      expect(quiet).toEqual(status === "disabled" ? [true] : [true, false]);
      expect(sent).toHaveLength(status === "disabled" || legacyDate ? 1 : 2);
      reporter.reportVisit(VISIT, { keepalive: true });
      if (status !== "disabled")
        expect(sent.at(-1)).toEqual({ route: ROUTE, event: VISIT, options: { keepalive: true } });
    },
  );

  test("quiet persists across reload; shared checks, rollover, unsubscribe, and cleanup control a tracker", async () => {
    statuses = [new Response(JSON.stringify({ status: "disabled" }), { status: 202 })];
    const reporter = start();
    let ticks = 0;
    let timer: ReturnType<typeof setInterval>;
    const changes: boolean[] = [],
      detached: boolean[] = [];
    reporter.onQuietChange((quiet) => {
      changes.push(quiet);
      clearInterval(timer);
      if (!quiet) timer = setInterval(() => ticks++, 100);
    });
    reporter.onQuietChange((quiet) => detached.push(quiet))();
    await settle();
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT);
    const reloaded = start();
    reloaded.reportScreen("A");
    focus();
    await advance(1000);
    expect(sent).toHaveLength(1);
    expect(ticks).toBe(0);
    reloaded();
    jest.setSystemTime(DAY_TWO);
    statuses = [{ status: 202, data: { status: "skipped" } }];
    const other = start();
    await settle();
    other();
    focus();
    await settle();
    await advance(100);
    expect(ticks).toBe(1);
    expect(sent).toHaveLength(3);
    jest.setSystemTime(new Date("2026-10-05T00:30:00Z"));
    statuses = ["held"];
    focus();
    await settle();
    await advance(100);
    expect(changes).toEqual([true, false, true]);
    expect(ticks).toBe(1);
    release(202);
    await settle();
    reporter();
    focus();
    await advance(1000);
    expect(changes).toEqual([true, false, true, false, true]);
    expect(detached).toEqual([true]);
    expect(ticks).toBe(1);
    expect(sent).toHaveLength(5);
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
    await settle();
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
    const changes: boolean[] = [];
    reporter.onQuietChange((quiet) => changes.push(quiet));
    await settle();
    statuses = Array(6).fill(503);
    for (let i = 0; i < 20; i++) reporter.reportVisit(VISIT);
    await settle();
    expect(sent).toHaveLength(7);
    expect(changes).toEqual([true, false, true]);
    await advance(60 * 60000);
    statuses = [{ status: 202, data: { status: "disabled" } }];
    const other = start();
    other.reportVisit(VISIT);
    await settle();
    other();
    const reads = jest.spyOn(localStorage, "getItem");
    focus();
    expect(reads).toHaveBeenCalledWith(`${PREFIX}quiet`);
    reads.mockRestore();
    reporter.reportScreen("A");
    expect(sent).toHaveLength(8);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(8).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
  });

  test("rollover frees old reservations and late replies preserve current reservations", async () => {
    const reporter = start();
    await settle();
    const changes: boolean[] = [];
    reporter.onQuietChange((quiet) => changes.push(quiet));
    statuses = Array(6).fill("held");
    for (let i = 0; i < 5; i++) reporter.reportVisit(VISIT);
    const boundaryReply = release;
    reporter.reportVisit(VISIT);
    const oldReply = release;
    jest.setSystemTime(DAY_TWO);
    boundaryReply(202);
    await settle();
    expect(changes).toEqual([false, true]);
    focus();
    await settle();
    expect(sent).toHaveLength(8);
    statuses = Array(6).fill("held");
    for (let i = 0; i < 6; i++) reporter.reportVisit(VISIT);
    oldReply(202);
    await settle();
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(14);
    release(202);
    await settle();
    statuses = Array(20).fill(503);
    for (let i = 0; i < 20; i++) reporter.reportVisit(VISIT);
    await settle();
    expect(sent).toHaveLength(15);
  });
});
