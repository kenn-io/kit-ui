import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
  startAppOpenedReporting,
  type BrowserTelemetryEvent,
  type BrowserTelemetryOptions,
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
    [401, "quiet"],
    [{ status: 202, data: { status: "unknown" } }, "quiet"],
    [new Response("broken", { status: 202 }), "quiet"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 200 }), "quiet"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 201 }), "quiet"],
    [{ status: 202, data: { status: "disabled" } }, "disabled"],
    [200, "enabled"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 202 }), "enabled"],
  ] as const)(
    "first replies persist only disabled quiet and accept status-only success: %p",
    async (reply, outcome) => {
      statuses = [reply];
      const reporter = start();
      await settle();
      if (outcome !== "enabled") {
        reporter.reportVisit(VISIT);
        reporter.reportVisit(VISIT, { keepalive: true });
        reporter.reportScreen("A");
      }
      focus();
      await advance(60000);
      expect(sent).toHaveLength(1);
      expect([...stored.entries()]).toEqual(
        outcome === "disabled"
          ? [[`${PREFIX}quiet`, "2026-10-03"]]
          : outcome === "enabled"
            ? [
                [`${PREFIX}check`, "2026-10-03"],
                [STORAGE_KEY, "2026-10-03"],
              ]
            : [[STORAGE_KEY, "2026-10-03"]],
      );
      reporter();
      start();
      await settle();
      expect(sent).toHaveLength(1);
    },
  );
  test.each(["app", "screen", "visit check"])(
    "an already-consumed 202 Response is terminal unreadable for %s",
    async (kind) => {
      if (kind !== "app") stored.set(STORAGE_KEY, "2026-10-03");
      const response = new Response(JSON.stringify({ status: "queued" }), { status: 202 });
      await response.text();
      statuses = [response];
      const reporter = start();
      if (kind === "screen") reporter.reportScreen("A");
      if (kind === "visit check") reporter.reportVisit(VISIT);
      await settle();
      await advance(60000);
      expect(sent).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(0);
      expect(stored.has(`${PREFIX}check`)).toBe(false);
      expect(stored.has(`${PREFIX}quiet`)).toBe(false);
    },
  );
  test.each(["app", "screen", "visit check", "one-shot visit"])(
    "an interrupted 202 body preserves the transport policy for %s",
    async (kind) => {
      if (kind !== "app") stored.set(STORAGE_KEY, "2026-10-03");
      if (kind === "one-shot visit") stored.set(`${PREFIX}check`, "2026-10-03");
      statuses = [
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError("terminated"));
            },
          }),
          { status: 202 },
        ),
      ];
      const reporter = start();
      if (kind === "screen") reporter.reportScreen("A");
      if (kind.includes("visit")) reporter.reportVisit(VISIT, { keepalive: true });
      await settle();
      expect(sent).toHaveLength(1);
      expect(stored.has(`${PREFIX}screen.A`)).toBe(false);
      if (kind === "app") expect(stored.has(STORAGE_KEY)).toBe(false);
      expect(stored.has(`${PREFIX}quiet`)).toBe(false);
      expect(stored.has(`${PREFIX}check`)).toBe(kind === "one-shot visit");
      await advance(999);
      expect(sent).toHaveLength(1);
      await advance(1);
      if (kind === "one-shot visit") {
        expect(sent).toHaveLength(1);
        expect(jest.getTimerCount()).toBe(0);
      } else {
        expect(sent).toHaveLength(2);
        expect(sent[1]).toEqual(
          kind === "app"
            ? { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } }
            : kind === "screen"
              ? {
                  route: ROUTE,
                  event: { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
                }
              : { route: ROUTE, event: VISIT, options: { keepalive: true } },
        );
        expect(stored.get(`${PREFIX}check`)).toBe("2026-10-03");
      }
    },
  );

  test("a terminal app-open rejection ends its attempt after another event enabled the gate", async () => {
    stored.set(`${PREFIX}check`, "2026-10-03");
    statuses = [400, "held"];
    start();
    await settle();
    expect(sent).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
    ]);
    focus();
    await advance(60000);
    expect(sent).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("a legacy app-open claim obtains a skipped receipt before starting visit timers", async () => {
    stored.set(STORAGE_KEY, "2026-10-03");
    statuses = [{ status: 202, data: { status: "skipped" } }];
    const reporter = start();
    const quiet: boolean[] = [];
    let timer: ReturnType<typeof setInterval>;
    reporter.onQuietChange((value) => {
      quiet.push(value);
      clearInterval(timer);
      if (!value) timer = setInterval(() => reporter.reportVisit(VISIT), 100);
    });
    await settle();
    expect(sent).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
    ]);
    expect(quiet).toEqual([true, false]);
    await advance(100);
    expect(sent).toHaveLength(2);
    expect(sent.at(-1)?.event).toEqual(VISIT);
    reporter();
    expect(jest.getTimerCount()).toBe(0);
  });

  test("a rejected screen preserves the enabled gate and is not posted again", async () => {
    statuses = [202, 400];
    const reporter = start();
    await settle();
    reporter.reportScreen("A");
    await settle();
    reporter.reportVisit(VISIT, { keepalive: true });
    reporter.reportScreen("B");
    await settle();
    reporter.reportScreen("A");
    focus();
    await settle();
    expect(stored.get(`${PREFIX}screen.A`)).toBe("2026-10-03");
    expect(sent.map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
      VISIT,
      { event: "screen_viewed", properties: { surface: "web", screen: "B" } },
    ]);
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
      const count = sent.length;
      await advance(60000);
      expect(sent).toHaveLength(count);
    },
  );

  test.each([202, 503, 400])(
    "an ordinary visit queued during screen backoff waits for its deadline (reply: %s)",
    async (reply) => {
      const reporter = start();
      await settle();
      statuses = [503, "held", 503, 202];
      reporter.reportScreen("A");
      await settle();
      await advance(500);
      reporter.reportVisit(VISIT);
      await settle();
      await advance(499);
      expect(sent).toHaveLength(2);
      await advance(1);
      expect(sent).toHaveLength(4);
      expect(sent[2]).toEqual({ route: ROUTE, event: VISIT });
      release(reply);
      await settle();
      await advance(1999);
      expect(sent).toHaveLength(4);
      await advance(1);
      expect(sent).toHaveLength(5);
      expect(sent.at(-1)?.event).toEqual({
        event: "screen_viewed",
        properties: { surface: "web", screen: "A" },
      });
    },
  );

  test("an enabled keepalive visit reaches post during screen backoff before cleanup", async () => {
    const reporter = start();
    await settle();
    statuses = [503];
    reporter.reportScreen("A");
    await settle();
    reporter.reportVisit(VISIT, { keepalive: true });
    const beforeCleanup = sent.slice();
    reporter();
    expect(beforeCleanup).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
      {
        route: ROUTE,
        event: { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
      },
      { route: ROUTE, event: VISIT, options: { keepalive: true } },
    ]);
    await advance(60000);
    expect(sent).toEqual(beforeCleanup);
  });

  test("a queued visit success after the retry fires preserves the pending screen failure budget", async () => {
    let resolveVisit!: typeof release;
    const reporter = startAppOpenedReporting({
      route: ROUTE,
      surface: "web",
      storageKey: STORAGE_KEY,
      post: (route, event, options) => {
        const response = post(route, event, options);
        if (event.event === "session_ended") resolveVisit = release;
        return response;
      },
    });
    stops.push(reporter);
    await settle();
    statuses = [503, "held", "held"];
    reporter.reportScreen("A");
    await settle();
    reporter.reportVisit(VISIT);
    await advance(1000);
    expect(sent.slice(2).map(({ event }) => event.event)).toEqual([
      "session_ended",
      "screen_viewed",
    ]);
    resolveVisit({ status: 202, data: { status: "queued" } });
    await settle();
    statuses = Array(4).fill(503);
    release(503);
    await settle();
    for (const [index, delay] of [2000, 4000, 8000, 16000].entries()) {
      await advance(delay - 1);
      expect(sent).toHaveLength(index + 4);
      await advance(1);
      expect(sent).toHaveLength(index + 5);
    }
    reporter.reportVisit(VISIT, { keepalive: true });
    reporter.reportScreen("B");
    focus();
    await advance(60000);
    expect(sent).toHaveLength(8);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([202, 400, 503])(
    "a late one-shot visit reply %s retains an existing screen deadline",
    async (reply) => {
      const reporter = start();
      await settle();
      statuses = ["held", 503, 503, 202];
      reporter.reportVisit(VISIT);
      reporter.reportScreen("A");
      await settle();
      await advance(500);
      release(reply);
      await settle();
      expect(jest.getTimerCount()).toBe(1);
      await advance(499);
      expect(sent).toHaveLength(3);
      await advance(1);
      expect(sent).toHaveLength(4);
      await advance(reply === 503 ? 3999 : 1999);
      expect(sent).toHaveLength(4);
      await advance(1);
      expect(sent).toHaveLength(5);
    },
  );

  test("app-open dedupes across same-day focus, reload, and product keys", async () => {
    statuses = [202];
    const options = {
      route: ROUTE,
      surface: "web",
      storageKey: STORAGE_KEY,
      post,
    };
    const stop = startAppOpenedReporting(options);
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

  test("encoded screens dedupe across reload", async () => {
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
  });

  test.each([
    ["queued", "new"],
    ["queued", "screen"],
    ["cleanup", "new"],
  ] as const)(
    "first receipt uses the initial %s/%s check and cleanup discards waiting visits",
    async (outcome, mode) => {
      stored.set(`${PREFIX}quiet`, "2026-10-02");
      if (mode !== "new") stored.set(STORAGE_KEY, "2026-10-03");
      statuses = ["held"];
      const reporter = start();
      if (mode === "screen") reporter.reportScreen("A");
      reporter.reportVisit(VISIT);
      if (mode === "new") reporter.reportScreen("A");
      await settle();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.event.event).toBe(mode === "screen" ? "screen_viewed" : "app_opened");
      if (outcome === "cleanup") reporter();
      release({ status: 202, data: { status: "queued" } });
      await settle();
      expect(sent).toHaveLength(outcome === "cleanup" ? 1 : mode === "new" ? 3 : 2);
      if (outcome === "cleanup") {
        reporter.reportVisit(VISIT);
        expect(sent).toHaveLength(1);
      }
    },
  );

  test("a held first receipt retains only the earliest six visits and their options", async () => {
    statuses = ["held"];
    const reporter = start();
    for (let index = 0; index < 3; index++)
      reporter.reportVisit(
        { event: "action", properties: { index } },
        index % 2 === 0 ? { keepalive: true } : undefined,
      );
    await settle();
    for (let index = 3; index < 20; index++)
      reporter.reportVisit(
        { event: "action", properties: { index } },
        index % 2 === 0 ? { keepalive: true } : undefined,
      );
    expect(sent).toHaveLength(1);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    await advance(60000);
    expect(sent).toHaveLength(7);
    expect(
      sent
        .slice(1)
        .map(({ event, options }) => [event.event, event.properties, options?.keepalive]),
    ).toEqual([
      ["action", { index: 0 }, true],
      ["action", { index: 1 }, undefined],
      ["action", { index: 2 }, true],
      ["action", { index: 3 }, undefined],
      ["action", { index: 4 }, true],
      ["action", { index: 5 }, undefined],
    ]);
    reporter.reportVisit(VISIT, { keepalive: true });
    expect(sent.at(-1)).toEqual({ route: ROUTE, event: VISIT, options: { keepalive: true } });
  });

  test("quiet notifications pause a visit tracker and honor unsubscribe and cleanup", async () => {
    statuses = ["held"];
    const reporter = start();
    let ticks = 0;
    let timer: ReturnType<typeof setInterval>;
    const changes: boolean[] = [],
      detached: boolean[] = [];
    const unsubscribe = reporter.onQuietChange((quiet) => {
      changes.push(quiet);
      clearInterval(timer);
      if (!quiet) timer = setInterval(() => ticks++, 100);
    });
    reporter.onQuietChange((quiet) => detached.push(quiet))();
    await advance(100);
    expect(ticks).toBe(0);
    release({ status: 202, data: { status: "skipped" } });
    await settle();
    await advance(100);
    expect(ticks).toBe(1);
    reporter();
    unsubscribe();
    focus();
    await advance(1000);
    expect(changes).toEqual([true, false, true]);
    expect(detached).toEqual([true]);
    expect(ticks).toBe(1);
    expect(sent).toHaveLength(1);
  });

  test.each([false, true])(
    "failed writes and blocked storage keep page claims: %s",
    async (blocked) => {
      if (blocked) blockStorage();
      else {
        stored.set(STORAGE_KEY, "2026-10-02");
        g.localStorage = {
          getItem: (key: string) => stored.get(key) ?? null,
          setItem: () => {
            throw new DOMException("full", "QuotaExceededError");
          },
        };
      }
      const reporter = start();
      await settle();
      reporter.reportScreen("A");
      await settle();
      focus();
      reporter.reportScreen("A");
      await settle();
      expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
    },
  );

  test("screen retries honor shared claims, midnight rollover, and cleanup cancellation", async () => {
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
    jest.setSystemTime(DAY_TWO);
    await advance(2000);
    expect(stored.get(STORAGE_KEY)).toBe("2026-10-04");
    focus();
    focus();
    await settle();
    expect(sent.slice(4).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
    statuses = [503];
    reporter.reportScreen("C");
    await settle();
    expect(jest.getTimerCount()).toBe(1);
    reporter();
    expect(jest.getTimerCount()).toBe(0);
  });

  test("transport and 5xx failures back off through 16 seconds before claiming app-open or screen", async () => {
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
  test("a late app-open receipt preserves a newer stored day", async () => {
    statuses = ["held"];
    start();
    await settle();
    stored.set(STORAGE_KEY, "2026-10-04");
    release(202);
    await settle();
    expect(stored.get(STORAGE_KEY)).toBe("2026-10-04");
  });

  test.each([
    [false, "disabled"],
    [false, "failed"],
    [true, "failed"],
  ] as const)(
    "late screen replies recover rollover and honor cleanup: stopped=%s, reply=%s",
    async (stopped, reply) => {
      const reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      statuses = ["held"];
      reporter.reportScreen("A");
      await settle();
      const previousDay = release;
      if (stopped) reporter();
      jest.setSystemTime(DAY_TWO);
      statuses = ["held"];
      previousDay(reply === "disabled" ? { status: 202, data: { status: "disabled" } } : 503);
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      if (stopped) {
        await advance(60000);
        expect(sent).toHaveLength(2);
        return;
      }
      expect(sent.slice(2).map(({ event }) => event.event)).toEqual(["app_opened"]);
      expect(quiet).toEqual([false, true]);
      release({ status: 202, data: { status: "queued" } });
      await settle();
      expect(quiet).toEqual([false, true, false]);
      expect(sent.at(-1)?.event).toEqual({
        event: "screen_viewed",
        properties: { surface: "web", screen: "A" },
      });
      expect(stored.get(`${PREFIX}screen.A`)).toBe("2026-10-04");
      expect(stored.get(STORAGE_KEY)).toBe("2026-10-04");
    },
  );

  test("six daily failures stop retries until the next UTC day", async () => {
    statuses = Array(6).fill(503);
    const reporter = start();
    const changes: boolean[] = [];
    reporter.onQuietChange((quiet) => changes.push(quiet));
    await settle();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) await advance(delay);
    expect(sent).toHaveLength(6);
    expect(jest.getTimerCount()).toBe(0);
    await advance(60 * 60000);
    focus();
    reporter.reportVisit(VISIT);
    reporter.reportVisit(VISIT, { keepalive: true });
    expect(sent).toHaveLength(6);
    reporter.reportScreen("A");
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(6).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
    expect(changes).toEqual([true, false]);
  });

  test.each(["screen", "visit"])(
    "a disabled page waits for focus after rollover despite a %s report",
    async (kind) => {
      statuses = [{ status: 202, data: { status: "disabled" } }];
      const reporter = start();
      await settle();
      jest.setSystemTime(DAY_TWO);
      if (kind === "screen") reporter.reportScreen("A");
      else reporter.reportVisit(VISIT, { keepalive: true });
      await settle();
      expect(sent).toHaveLength(1);
      focus();
      await settle();
      expect(sent.slice(1).filter(({ event }) => event.event === "app_opened")).toHaveLength(1);
    },
  );

  test.each(["screen", "visit"])(
    "a rejected first screen lets the next %s establish an enabled receipt",
    async (kind) => {
      stored.set(STORAGE_KEY, "2026-10-03");
      statuses = ["held"];
      const reporter = start();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      reporter.reportScreen("A");
      await settle();
      if (kind === "visit") reporter.reportVisit(VISIT, { keepalive: true });
      else reporter.reportScreen("B");
      statuses = ["held"];
      release(400);
      await settle();
      expect(sent).toEqual([
        {
          route: ROUTE,
          event: { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
        },
        kind === "visit"
          ? { route: ROUTE, event: VISIT, options: { keepalive: true } }
          : {
              route: ROUTE,
              event: { event: "screen_viewed", properties: { surface: "web", screen: "B" } },
            },
      ]);
      expect(quiet).toEqual([true]);
      release({ status: 202, data: { status: "queued" } });
      await settle();
      expect(quiet).toEqual([true, false]);
      expect(sent).toHaveLength(2);
    },
  );

  test("future valid claims remain claimed after clock rollback and reload", async () => {
    jest.setSystemTime(DAY_TWO);
    const reporter = start();
    reporter.reportScreen("A");
    await settle();
    reporter();
    jest.setSystemTime(DAY_ONE);
    const reloaded = start();
    reloaded.reportScreen("A");
    await settle();
    focus();
    await settle();
    expect(sent).toHaveLength(2);
    expect(stored.get(STORAGE_KEY)).toBe("2026-10-04");
    expect(stored.get(`${PREFIX}screen.A`)).toBe("2026-10-04");
  });

  test.each([503, "offline"] as const)(
    "enabled visits stop and signal quiet after six %s failures",
    async (failure) => {
      const reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      statuses = Array(6).fill(failure);
      reporter.reportVisit(VISIT);
      await settle();
      for (let i = 0; i < 6; i++) {
        reporter.reportVisit({ event: "action", properties: { count: i } });
        await settle();
        expect(sent).toHaveLength(i + 2);
        if (i === 5) break;
        const delay = [1000, 2000, 4000, 8000, 16000][i];
        await advance(delay - 1);
        expect(sent).toHaveLength(i + 2);
        await advance(1);
        expect(sent.at(-1)).toEqual({
          route: ROUTE,
          event: { event: "action", properties: { count: i } },
        });
      }
      reporter.reportVisit(VISIT, { keepalive: true });
      reporter.reportScreen("A");
      focus();
      await advance(60000);
      expect(sent).toHaveLength(7);
      expect(jest.getTimerCount()).toBe(0);
      expect(quiet).toEqual([false, true]);
      jest.setSystemTime(DAY_TWO);
      focus();
      await settle();
      expect(sent.slice(7).map(({ event }) => event.event)).toEqual([
        "app_opened",
        "screen_viewed",
      ]);
      expect(quiet).toEqual([false, true, false]);
    },
  );

  test("unsettled enabled visits leave timers untouched", async () => {
    const reporter = start();
    await settle();
    statuses = Array(6).fill("held");
    for (let i = 0; i < 6; i++) {
      reporter.reportVisit(VISIT);
      await settle();
      expect(jest.getTimerCount()).toBe(0);
    }
    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent).toHaveLength(8);
    expect(sent.at(-1)).toEqual({ route: ROUTE, event: VISIT, options: { keepalive: true } });
  });

  test("a late visit failure exhausts the shared cap and cancels existing backoff", async () => {
    const reporter = start();
    await settle();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    statuses = ["held", ...Array(5).fill(503)];
    reporter.reportVisit(VISIT);
    reporter.reportScreen("A");
    await settle();
    for (const delay of [1000, 2000, 4000, 8000]) await advance(delay);
    expect(sent).toHaveLength(7);
    expect(jest.getTimerCount()).toBe(1);
    release(503);
    await settle();
    expect(jest.getTimerCount()).toBe(0);
    expect(quiet).toEqual([false, true]);
    reporter.reportVisit(VISIT);
    focus();
    await advance(60000);
    expect(sent).toHaveLength(7);
  });

  test.each([false, true])(
    "the earliest pending visit checks a legacy app date without an extra app-open (claimed screen: %s)",
    async (screen) => {
      stored.set(STORAGE_KEY, "2026-10-03");
      if (screen) stored.set(`${PREFIX}screen.A`, "2026-10-03");
      statuses = ["held"];
      const reporter = start();
      if (screen) reporter.reportScreen("A");
      reporter.reportVisit(VISIT, { keepalive: true });
      reporter.reportVisit({ event: "action", properties: { count: 2 } });
      await settle();
      expect(sent).toEqual([{ route: ROUTE, event: VISIT, options: { keepalive: true } }]);
      release({ status: 202, data: { status: "queued" } });
      await settle();
      expect(sent).toEqual([
        { route: ROUTE, event: VISIT, options: { keepalive: true } },
        { route: ROUTE, event: { event: "action", properties: { count: 2 } } },
      ]);
    },
  );

  test("a visit receipt check retries its original payload and options until accepted once", async () => {
    stored.set(STORAGE_KEY, "2026-10-03");
    statuses = [503, "offline", "held"];
    const reporter = start();
    reporter.reportVisit(VISIT, { keepalive: true });
    reporter.reportVisit({ event: "action", properties: { count: 2 } });
    await settle();
    await advance(999);
    expect(sent).toHaveLength(1);
    await advance(1);
    await advance(1999);
    expect(sent).toHaveLength(2);
    await advance(1);
    expect(sent).toEqual([
      { route: ROUTE, event: VISIT, options: { keepalive: true } },
      { route: ROUTE, event: VISIT, options: { keepalive: true } },
      { route: ROUTE, event: VISIT, options: { keepalive: true } },
    ]);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    focus();
    await settle();
    expect(sent).toHaveLength(4);
    expect(sent.at(-1)?.event).toEqual({ event: "action", properties: { count: 2 } });
  });

  test("a late accepted visit leaves an exhausted screen reporter quiet until rollover", async () => {
    const reporter = start();
    await settle();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    statuses = ["held", ...Array(6).fill(503)];
    reporter.reportVisit(VISIT);
    reporter.reportScreen("A");
    await settle();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) await advance(delay);
    expect(sent).toHaveLength(8);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    focus();
    reporter.reportVisit(VISIT);
    await advance(60000);
    expect(sent).toHaveLength(8);
    expect(quiet).toEqual([false, true]);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(8).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
    expect(quiet).toEqual([false, true, false]);
  });

  test.each([503, 400])(
    "a visit check receiving %s after another tab enables reporting retains its outcome",
    async (status) => {
      stored.set(STORAGE_KEY, "2026-10-03");
      statuses = ["held"];
      const reporter = start();
      reporter.reportVisit(VISIT, { keepalive: true });
      reporter.reportVisit({ event: "action", properties: { count: 2 } });
      const checking = release;
      const other = start();
      other.reportScreen("B");
      await settle();
      other();
      checking(status);
      await settle();
      focus();
      await settle();
      expect(sent.map(({ event }) => event.event)).toEqual(
        status === 503
          ? ["session_ended", "screen_viewed"]
          : ["session_ended", "screen_viewed", "action"],
      );
      if (status === 503) {
        await advance(999);
        expect(sent).toHaveLength(2);
        await advance(1);
        expect(sent[2]).toEqual({ route: ROUTE, event: VISIT, options: { keepalive: true } });
      }
    },
  );
});
