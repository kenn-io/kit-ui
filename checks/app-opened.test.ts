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
let elapsed: number;
let advancingFrom: number | undefined;

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
  advancingFrom = Date.now();
  jest.advanceTimersByTime(ms);
  elapsed += ms;
  advancingFrom = undefined;
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
  elapsed = 0;
  jest
    .spyOn(performance, "now")
    .mockImplementation(
      () => elapsed + (advancingFrom === undefined ? 0 : Date.now() - advancingFrom),
    );
});

afterEach(() => {
  for (const stop of stops) stop();
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete g.localStorage;
  delete g.window;
});

describe("startAppOpenedReporting", () => {
  test("keepalive visits during permission backoff are dropped", async () => {
    statuses = [400];
    const previous = start();
    await settle();
    previous();
    const reporter = start();
    statuses = [503, 202];
    reporter.reportVisit(VISIT);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
    expect(jest.getTimerCount()).toBe(0);

    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent).toHaveLength(2);
    await advance(999);
    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent).toHaveLength(2);
    await advance(1);
    expect(sent).toHaveLength(2);
    expect(jest.getTimerCount()).toBe(0);

    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent.slice(2)).toEqual([{ route: ROUTE, event: VISIT, options: { keepalive: true } }]);
  });

  test("a failed ordinary visit defers a new screen until the shared deadline", async () => {
    const reporter = start();
    await settle();
    statuses = [503];
    reporter.reportVisit(VISIT);
    await settle();
    reporter.reportScreen("settings");
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
    await advance(999);
    expect(sent).toHaveLength(2);
    reporter.reportVisit(VISIT);
    await advance(1);
    expect(sent.slice(2).map(({ event }) => event)).toEqual([
      { event: "screen_viewed", properties: { surface: "web", screen: "settings" } },
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(["recovered", "observed"])(
    "%s storage after a failed write keeps the page's claims",
    async (failure) => {
      g.localStorage = {
        getItem: (key: string) => {
          return stored.get(key) ?? null;
        },
        setItem: () => {
          throw new Error("full");
        },
      };
      const reporter = start();
      reporter.reportScreen("A");
      await settle();
      g.localStorage = {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
      };
      if (failure === "observed") {
        const other = start();
        other.reportScreen("A");
        await settle();
        other();
      }
      reporter.reportScreen("A");
      expect(sent).toHaveLength(failure === "observed" ? 4 : 2);
      jest.setSystemTime(DAY_TWO);
      reporter.reportScreen("A");
      await settle();
      jest.setSystemTime(DAY_ONE);
      reporter.reportScreen("A");
      await settle();
      expect(sent).toHaveLength(failure === "observed" ? 6 : 4);
      expect(stored.get(`${PREFIX}open`)).toBe(failure === "observed" ? "2026-10-03" : undefined);
    },
  );

  test.each(["working", "read", "write", "both"])(
    "claims and permission retain 35 dates and dedupe rollback with %s storage",
    async (failure) => {
      if (failure === "both") blockStorage();
      else if (failure === "read")
        g.localStorage = {
          getItem: () => {
            throw new Error("blocked read");
          },
          setItem: (key: string, value: string) => void stored.set(key, value),
        };
      else if (failure === "write") {
        stored.set(`${PREFIX}open`, "2026-10-03");
        g.localStorage = {
          getItem: (key: string) => stored.get(key) ?? null,
          setItem: () => {
            throw new DOMException("full", "QuotaExceededError");
          },
        };
      }
      const reporter = start();
      reporter.reportScreen("A");
      await settle();
      expect(sent[0]?.event.event).toBe(failure === "write" ? "screen_viewed" : "app_opened");
      for (let date = 4; date <= 38; date++) {
        jest.setSystemTime(new Date(Date.UTC(2026, 9, date, 12)));
        focus();
        await settle();
        if (date === 37) {
          const count = sent.length;
          jest.setSystemTime(DAY_ONE);
          focus();
          reporter.reportScreen("A");
          await settle();
          expect(sent).toHaveLength(count);
        }
      }
      if (failure === "working" || failure === "read") {
        for (const key of [`${PREFIX}open`, `${PREFIX}screen.A`, `${PREFIX}check`]) {
          const dates = stored.get(key)!.split(",");
          expect(dates).toHaveLength(35);
          expect([dates[0], dates.at(-1)]).toEqual(["2026-10-04", "2026-11-07"]);
        }
      }
      const count = sent.length;
      jest.setSystemTime(DAY_ONE);
      focus();
      await settle();
      expect(sent.slice(count).map(({ event }) => event.event)).toEqual([
        "app_opened",
        "screen_viewed",
      ]);
    },
  );

  test("a rejected visit check after rollover leaves later reports able to check permission", async () => {
    const reporter = start();
    await settle();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    jest.setSystemTime(DAY_TWO);
    statuses = [400, "held"];
    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT);
    await settle();
    expect(sent.slice(1).map(({ event }) => event)).toEqual([
      VISIT,
      { event: "app_opened", properties: { surface: "web" } },
    ]);
    expect(quiet).toEqual([false, true]);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    reporter.reportVisit(VISIT);
    await settle();
    expect(sent.slice(3).map(({ event }) => event)).toEqual([
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
      VISIT,
    ]);
    expect(quiet).toEqual([false, true, false]);
  });

  test.each([
    [401, "unknown"],
    [{ status: 202, data: { status: "unknown" } }, "unknown"],
    [new Response("broken", { status: 202 }), "unknown"],
    ["consumed", "unknown"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 200 }), "unknown"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 201 }), "unknown"],
    [{ status: 202, data: { status: "disabled" } }, "disabled"],
    [200, "enabled"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 202 }), "enabled"],
  ] as const)(
    "first replies persist only disabled quiet and accept status-only success: %p",
    async (reply, outcome) => {
      if (reply === "consumed") {
        const consumed = new Response(JSON.stringify({ status: "queued" }), { status: 202 });
        await consumed.text();
        statuses = [consumed];
      } else statuses = [reply];
      const reporter = start();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      await settle();
      focus();
      await advance(60000);
      expect(sent).toHaveLength(1);
      expect(Object.fromEntries(stored)).toEqual(
        outcome === "disabled"
          ? { [`${PREFIX}quiet`]: "2026-10-03" }
          : outcome === "enabled"
            ? {
                [`${PREFIX}check`]: "2026-10-03",
                [`${PREFIX}open`]: "2026-10-03",
              }
            : { [`${PREFIX}open`]: "2026-10-03" },
      );
      expect(quiet).toEqual(outcome === "enabled" ? [true, false] : [true]);
      reporter();
      const reloaded = start();
      if (reply === "consumed") {
        const reloadedQuiet: boolean[] = [];
        reloaded.onQuietChange((value) => reloadedQuiet.push(value));
        await advance(60000);
        expect(reloadedQuiet).toEqual([true]);
      }
      await settle();
      expect(sent).toHaveLength(1);
    },
  );
  test.each(["screen", "visit check"])(
    "an interrupted 202 body is a terminal unreadable receipt for %s",
    async (kind) => {
      stored.set(`${PREFIX}open`, "2026-10-03");
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError("terminated"));
          },
        }),
        { status: 202 },
      );
      statuses = [response];
      const reporter = start();
      if (kind === "screen") reporter.reportScreen("A");
      if (kind.includes("visit")) reporter.reportVisit(VISIT);
      await settle();
      await advance(60000);
      expect(sent).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(0);
      if (kind === "screen") expect(stored.get(`${PREFIX}screen.A`)).toBe("2026-10-03");
      expect(stored.has(`${PREFIX}check`)).toBe(false);
      expect(stored.has(`${PREFIX}quiet`)).toBe(false);
    },
  );

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

  test.each(["focus", "late 202"])(
    "another tab's disabled receipt cancels backoff when observed by %s",
    async (observation) => {
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
      if (observation === "late 202") release(202);
      else focus();
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      const count = sent.length;
      await advance(60000);
      expect(sent).toHaveLength(count);
    },
  );

  test("screen backoff drops ordinary visits", async () => {
    const reporter = start();
    await settle();
    statuses = [503, 503, 503, 202];
    reporter.reportScreen("A");
    await settle();
    await advance(500);
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(2);
    await advance(500);
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "screen_viewed",
      "screen_viewed",
    ]);
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(3);
    await advance(2000);
    await advance(4000);
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "screen_viewed",
      "screen_viewed",
      "screen_viewed",
      "screen_viewed",
    ]);
  });

  test.each([
    [400, 500],
    [503, 500],
    [202, 1000],
  ] as const)(
    "a late one-shot visit reply %i at %ims preserves the pending screen deadline and failure budget",
    async (reply, at) => {
      const reporter = start();
      await settle();
      statuses = ["held", 503, at === 500 ? 503 : "held", 202];
      reporter.reportVisit(VISIT);
      const visitReply = release;
      reporter.reportScreen("A");
      await settle();
      await advance(at);
      visitReply(reply);
      await settle();
      if (at === 500) {
        expect(jest.getTimerCount()).toBe(1);
        await advance(499);
        expect(sent).toHaveLength(3);
        await advance(1);
      } else release(503);
      await settle();
      expect(sent).toHaveLength(4);
      await advance(reply === 503 ? 3999 : 1999);
      expect(sent).toHaveLength(4);
      await advance(1);
      expect(sent).toHaveLength(5);
    },
  );

  test.each([{ status: 202, data: { status: "queued" } }, { status: 400 }] as const)(
    "empty-key app-open dedupes across focus and reload independently of other products: %p",
    async (reply) => {
      statuses = [reply, "held"];
      const reporter = start("");
      await settle();
      expect(sent).toEqual([
        { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
      ]);
      await advance(60000);
      focus();
      reporter();
      start("");
      await settle();
      expect(sent).toHaveLength(1);
      statuses = [202];
      start("example.other.web");
      await settle();
      start("example.other.web");
      await settle();
      expect(sent).toHaveLength(2);
    },
  );

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

  test.each(["enabled", "cleanup", "rejected"])(
    "visits during an in-flight check are dropped: %s",
    async (outcome) => {
      statuses = ["held"];
      const reporter = start();
      reporter.reportVisit(VISIT, { keepalive: true });
      reporter.reportVisit(VISIT);
      reporter.reportScreen("A");
      expect(sent.map(({ event }) => event.event)).toEqual(["app_opened"]);
      if (outcome === "cleanup") reporter();
      release(outcome === "rejected" ? 400 : { status: 202, data: { status: "queued" } });
      await advance(60000);
      expect(sent.map(({ event }) => event.event)).toEqual(
        outcome === "cleanup" ? ["app_opened"] : ["app_opened", "screen_viewed"],
      );
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  test("a rejected screen lets the next screen check permission", async () => {
    stored.set(`${PREFIX}open`, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    reporter.reportScreen("A");
    reporter.reportScreen("B");
    release(400);
    await settle();
    expect(sent.map(({ event }) => event.properties.screen)).toEqual(["A", "B"]);
    expect(quiet).toEqual([true, false]);
  });

  test.each([
    ["subscribe", [false]],
    ["unsubscribe", [true]],
    ["rollover", [true, true]],
  ] as const)("enabled notifications honor reentrant %s callbacks", async (action, expected) => {
    statuses = ["held"];
    const reporter = start();
    const changes: boolean[] = [];
    let unsubscribe = () => {};
    reporter.onQuietChange((quiet) => {
      if (quiet) return;
      if (action === "subscribe") reporter.onQuietChange((value) => changes.push(value));
      else if (action === "unsubscribe") unsubscribe();
      else {
        jest.setSystemTime(DAY_TWO);
        statuses = ["held", "held"];
        focus();
      }
    });
    if (action !== "subscribe")
      unsubscribe = reporter.onQuietChange((value) => changes.push(value));
    release(202);
    await settle();
    expect(changes).toEqual(expected);
    if (action === "rollover") {
      expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
      focus();
      await settle();
      expect(sent).toHaveLength(2);
    }
  });

  test("quiet notifications pause a visit tracker and honor unsubscribe and cleanup", async () => {
    statuses = ["held"];
    const reporter = start();
    let timer: ReturnType<typeof setInterval>;
    const changes: boolean[] = [],
      detached: boolean[] = [];
    reporter.onQuietChange((quiet) => {
      changes.push(quiet);
      clearInterval(timer);
      if (!quiet) timer = setInterval(() => reporter.reportVisit(VISIT), 100);
    });
    reporter.onQuietChange((quiet) => detached.push(quiet))();
    await advance(100);
    expect(jest.getTimerCount()).toBe(0);
    release({ status: 202, data: { status: "skipped" } });
    await settle();
    expect(changes).toEqual([true, false]);
    expect(sent).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
    ]);
    await advance(100);
    expect(sent.at(-1)?.event).toEqual(VISIT);
    expect(sent).toHaveLength(2);
    reporter();
    focus();
    await advance(1000);
    expect(changes).toEqual([true, false, true]);
    expect(detached).toEqual([true]);
    expect(jest.getTimerCount()).toBe(0);
    expect(sent).toHaveLength(2);
  });

  test.each(["initial", "shared"])(
    "cleanup during %s enabled notification stops tracker timers; shared cleanup also cancels retries and focus",
    async (notification) => {
      const remove = jest.spyOn(window, "removeEventListener");
      if (notification === "shared") statuses = ["held"];
      const reporter = start();
      await settle();
      let timer: ReturnType<typeof setInterval>;
      const changes: boolean[] = [],
        later: boolean[] = [];
      reporter.onQuietChange((quiet) => {
        changes.push(quiet);
        clearInterval(timer);
        if (!quiet) {
          timer = setInterval(() => reporter.reportVisit(VISIT), 100);
          reporter();
        }
      });
      reporter.onQuietChange((quiet) => later.push(quiet));
      if (notification === "shared") start();
      await settle();
      const beforeCleanup = sent.slice();
      reporter.reportVisit(VISIT);
      expect(sent).toEqual(beforeCleanup);
      expect(changes).toEqual(notification === "initial" ? [false, true] : [true, false, true]);
      expect(later).toEqual(notification === "initial" ? [true] : [true, true]);
      expect(jest.getTimerCount()).toBe(0);
      expect(remove).toHaveBeenCalledWith("focus", expect.any(Function));
      if (notification === "initial") return;
      stops.at(-1)?.();
      jest.setSystemTime(DAY_TWO);
      statuses = [503];
      const retrying = start();
      await settle();
      expect(jest.getTimerCount()).toBe(1);
      retrying();
      expect(jest.getTimerCount()).toBe(0);
      const count = sent.length;
      focus();
      await advance(60000);
      expect(sent).toHaveLength(count);
    },
  );

  test("midnight resets the day before a shared receipt can notify a screen subscriber", async () => {
    statuses = ["held"];
    const reporter = start();
    const previousDay = release;
    const changes: boolean[] = [];
    reporter.onQuietChange((quiet) => {
      changes.push(quiet);
      if (!quiet) reporter.reportScreen("A");
    });
    const other = start();
    await settle();
    other();
    expect(stored.get(`${PREFIX}check`)).toBe("2026-10-03");
    expect(changes).toEqual([true]);

    jest.setSystemTime(DAY_TWO);
    previousDay({ status: 202, data: { status: "queued" } });
    await settle();
    expect(sent.slice(2).map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
    ]);
    expect(changes).toEqual([true, false]);
    expect(stored.get(`${PREFIX}check`)).toBe("2026-10-03,2026-10-04");
    expect(stored.get(`${PREFIX}screen.A`)).toBe("2026-10-04");
  });

  test("shared claims stop screen retries; rollover cancels backoff and carries the current screen", async () => {
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
    statuses = ["held"];
    focus();
    focus();
    await settle();
    expect(jest.getTimerCount()).toBe(0);
    release(503);
    await settle();
    await advance(999);
    expect(sent).toHaveLength(5);
    await advance(1);
    await settle();
    expect(sent.slice(4).map(({ event }) => event.event)).toEqual([
      "app_opened",
      "app_opened",
      "screen_viewed",
    ]);
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
  test("an app-open accepted after midnight stays claimed for its sending date", async () => {
    statuses = ["held", "held"];
    start();
    jest.setSystemTime(DAY_TWO);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    expect(sent).toHaveLength(2);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    expect(stored.get(`${PREFIX}check`)).toBe("2026-10-03,2026-10-04");
    jest.setSystemTime(DAY_ONE);
    focus();
    await settle();
    expect(sent).toHaveLength(2);
    expect(stored.get(`${PREFIX}open`)).toBe("2026-10-03,2026-10-04");
  });

  test.each([202, 503, "disabled", "callback"] as const)("rollback owner: %s", async (reply) => {
    const reporter = start();
    await settle();
    statuses = ["held", "held", "held"];
    reporter.reportScreen("A");
    const previous = release;
    jest.setSystemTime(DAY_TWO);
    focus();
    jest.setSystemTime(DAY_ONE);
    reporter.reportScreen("B");
    const current = release;
    statuses = Array(6).fill(503);
    const status = typeof reply === "number" ? reply : 202;
    previous(reply === "disabled" ? { status, data: { status: "disabled" } } : status);
    await settle();
    expect(sent.filter(({ event }) => event.properties.screen === "B")).toHaveLength(1);
    expect(stored.get(`${PREFIX}screen.A`)).toBe(
      reply === 202 || reply === "callback" ? "2026-10-03" : undefined,
    );
    expect(stored.get(`${PREFIX}quiet`)).toBe(reply === "disabled" ? "2026-10-03" : undefined);
    current(503);
    await settle();
    await advance(999);
    expect(sent).toHaveLength(4);
    await advance(1);
    expect(sent).toHaveLength(reply === "disabled" ? 4 : 5);
    reporter.onQuietChange((quiet) => {
      if (reply !== "callback" || !quiet) return;
      statuses = ["held", "held"];
      jest.setSystemTime(DAY_TWO);
      focus();
      jest.setSystemTime(DAY_ONE);
      reporter.reportScreen("B");
    });
    for (const delay of [2000, 4000, 8000, 16000]) await advance(delay);
    expect(sent).toHaveLength(reply === "disabled" ? 4 : reply === "callback" ? 11 : 9);
    await advance(60000);
    if (reply === "callback") focus();
    else reporter.reportVisit(VISIT, { keepalive: true });
    expect(sent).toHaveLength(reply === "disabled" ? 4 : reply === "callback" ? 11 : 9);
  });

  test.each(["enabled-first", "disabled-first"])(
    "yesterday's disabled reply stops today's page with %s replies",
    async (wake) => {
      jest.setSystemTime(new Date("2026-10-03T23:59:59.900Z"));
      statuses = ["held"];
      let reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      const previousDay = release;
      jest.setSystemTime(new Date("2026-10-04T00:00:00.100Z"));
      statuses = ["held"];
      focus();
      const currentDay = release;
      let timer: ReturnType<typeof setInterval>;
      reporter.onQuietChange((value) => {
        clearInterval(timer);
        if (!value) timer = setInterval(() => reporter.reportVisit(VISIT), 100);
        else reporter.reportVisit(VISIT, { keepalive: true });
      });
      const enabled = { status: 202, data: { status: "queued" } };
      const disabled = { status: 202, data: { status: "disabled" } };
      if (wake === "enabled-first") {
        currentDay(enabled);
        await settle();
        expect(quiet).toEqual([true, false]);
      }
      previousDay(disabled);
      await settle();
      if (wake === "disabled-first") {
        currentDay(enabled);
        await settle();
      }
      expect(quiet).toEqual(wake === "enabled-first" ? [true, false, true] : [true]);
      expect(stored.get(`${PREFIX}quiet`)).toBe("2026-10-03");
      expect(stored.get(`${PREFIX}check`)).toBe("2026-10-04");
      reporter.reportScreen("A");
      reporter.reportVisit(VISIT, { keepalive: true });
      await advance(60000);
      expect(sent).toHaveLength(2);
      expect(jest.getTimerCount()).toBe(0);
      reporter();
      reporter = start();
      await settle();
      expect(sent).toHaveLength(2);
      jest.setSystemTime(new Date("2026-10-05T00:00:00Z"));
      focus();
      await settle();
      expect(sent).toHaveLength(3);
    },
  );

  test.each([
    [false, "disabled", "screen", "focus"],
    [false, "disabled", "app", "focus"],
    [false, "disabled", "app", "reload"],
    [false, "failed", "screen", "focus"],
    [true, "failed", "screen", "focus"],
  ] as const)(
    "late replies honor disabled, rollover, and cleanup: stopped=%p, reply=%s, kind=%s, wake=%s",
    async (stopped, reply, kind, wake) => {
      jest.setSystemTime(new Date("2026-10-03T23:59:59.900Z"));
      if (kind === "app") statuses = ["held"];
      let reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      if (kind === "screen") {
        statuses = ["held"];
        reporter.reportScreen("A");
      }
      await settle();
      const previousDay = release;
      if (stopped) reporter();
      jest.setSystemTime(new Date("2026-10-04T00:00:00.100Z"));
      statuses = ["held"];
      previousDay(reply === "disabled" ? { status: 202, data: { status: "disabled" } } : 503);
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      if (stopped) {
        await advance(60000);
        expect(sent).toHaveLength(2);
        return;
      }
      const before = kind === "app" ? 1 : 2;
      if (reply === "disabled") {
        expect(sent).toHaveLength(before);
        expect(quiet).toEqual(kind === "app" ? [true] : [false, true]);
        expect(stored.get(`${PREFIX}quiet`)).toBe("2026-10-03");
        expect(stored.get(`${PREFIX}check`)).toBe(kind === "app" ? undefined : "2026-10-03");
        expect(stored.get(`${PREFIX}open`)).toBe(kind === "app" ? undefined : "2026-10-03");
        expect(stored.has(`${PREFIX}screen.A`)).toBe(false);
        reporter.reportScreen("A");
        reporter.reportVisit(VISIT, { keepalive: true });
        await advance(60000);
        expect(sent).toHaveLength(before);
        if (wake === "reload") {
          reporter();
          reporter = start();
          reporter.onQuietChange((value) => quiet.push(value));
          reporter.reportScreen("A");
        } else focus();
        await settle();
      }
      expect(sent.slice(before).map(({ event }) => event.event)).toEqual(["app_opened"]);
      release({ status: 202, data: { status: "queued" } });
      await settle();
      expect(quiet).toEqual(
        kind === "screen"
          ? [false, true, false]
          : wake === "reload"
            ? [true, true, false]
            : [true, false],
      );
      expect(sent.at(-1)?.event).toEqual({
        event: "screen_viewed",
        properties: { surface: "web", screen: "A" },
      });
      expect(stored.get(`${PREFIX}screen.A`)).toBe("2026-10-04");
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
    "a disabled page waits for focus after rollover despite a %s report and stays quiet on rollback",
    async (kind) => {
      statuses = Array(2).fill({ status: 202, data: { status: "disabled" } });
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
      jest.setSystemTime(DAY_ONE);
      focus();
      await settle();
      expect(sent).toHaveLength(2);
    },
  );

  test.each([
    ["2099-01-01", undefined],
    ["2026-10-02", "2099-01-01"],
  ] as const)("gate dates require today's check: quiet=%s, check=%s", async (quiet, check) => {
    stored.set(`${PREFIX}open`, "2026-10-03");
    stored.set(`${PREFIX}quiet`, quiet);
    if (check) stored.set(`${PREFIX}check`, check);
    statuses = ["held"];
    const reporter = start();
    await settle();
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["screen_viewed"]);
    if (!check) {
      release({ status: 202, data: { status: "disabled" } });
      await settle();
      expect(stored.get(`${PREFIX}quiet`)).toBe("2099-01-01,2026-10-03");
      return;
    }
    release({ status: 202, data: { status: "queued" } });
    await settle();
    expect(stored.get(`${PREFIX}check`)).toBe("2099-01-01,2026-10-03");
  });

  test("enabled visits pace admission and block keepalive at the failure cap", async () => {
    const reporter = start();
    await settle();
    statuses = Array(6).fill(503);
    for (let i = 0; i < 6; i++) {
      reporter.reportVisit({ event: "action", properties: { count: i } });
      await settle();
      if (i < 5) {
        reporter.reportVisit(VISIT);
        expect(sent).toHaveLength(i + 2);
        await advance([1000, 2000, 4000, 8000, 16000][i] - 1);
        reporter.reportVisit(VISIT);
        expect(sent).toHaveLength(i + 2);
        await advance(1);
      }
    }
    reporter.reportVisit(VISIT, { keepalive: true });
    expect(sent).toHaveLength(7);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([
    [202, false],
    [400, false],
    [202, true],
    [400, true],
  ] as const)(
    "standalone visit reply %i clears intermittent outage failures: overlapping=%p",
    async (reply, overlapping) => {
      const reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      for (let i = 0; i < 7; i++) {
        if (overlapping) {
          statuses = ["held", 503];
          reporter.reportVisit(VISIT, { keepalive: true });
          reporter.reportVisit(VISIT, { keepalive: true });
          await settle();
          release(reply);
          await settle();
        } else {
          statuses = [503, reply];
          reporter.reportVisit(VISIT);
          await settle();
          await advance(1000);
          reporter.reportVisit(VISIT);
          await settle();
        }
        expect(sent).toHaveLength(2 * i + 3);
      }
      expect(quiet).toEqual([false]);
      expect(jest.getTimerCount()).toBe(0);
      reporter.reportVisit(VISIT);
      expect(sent).toHaveLength(16);
    },
  );

  test.each(["reload", "rollover", "rollback"])(
    "visit cooldown resets on reload and rollover and holds on clock rollback: %s",
    async (reset) => {
      jest.setSystemTime(new Date("2026-10-03T23:59:59.500Z"));
      let reporter = start();
      await settle();
      statuses = [503];
      reporter.reportVisit(VISIT);
      await settle();
      reporter.reportVisit(VISIT);
      expect(sent).toHaveLength(2);
      if (reset === "reload") {
        reporter();
        reporter = start();
      } else if (reset === "rollover") jest.setSystemTime(new Date("2026-10-04T00:00:00Z"));
      else {
        jest.setSystemTime(new Date("2026-10-03T11:00:00Z"));
        await advance(999);
        reporter.reportVisit(VISIT);
        expect(sent).toHaveLength(2);
        await advance(2);
      }
      reporter.reportVisit(VISIT);
      expect(sent[2]).toEqual({ route: ROUTE, event: VISIT });
      await settle();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  test.each([false, true])(
    "successful keepalive visits preserve screen exhaustion: overlapping=%p",
    async (joined) => {
      const reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      statuses = joined ? ["held", 503] : [503];
      reporter.reportScreen("A");
      if (joined) {
        reporter.reportVisit(VISIT, { keepalive: true });
        await settle();
        release(503);
      }
      await settle();
      const delays = joined ? [2000, 4000, 8000, 16000] : [1000, 2000, 4000, 8000, 16000];
      for (const delay of delays) {
        reporter.reportVisit(VISIT, { keepalive: true });
        await settle();
        statuses = [503];
        await advance(delay);
      }
      expect(sent.filter(({ event }) => event.event === "screen_viewed")).toHaveLength(
        joined ? 5 : 6,
      );
      expect(quiet).toEqual([false, true]);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  test("pending enabled visits are sent without pacing or queuing", async () => {
    const reporter = start();
    await settle();
    statuses = Array(6).fill("held");
    for (let i = 0; i < 6; i++) {
      reporter.reportVisit(VISIT);
      await settle();
    }
    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent).toHaveLength(8);
    expect(sent.at(-1)).toEqual({ route: ROUTE, event: VISIT, options: { keepalive: true } });
  });

  test.each([503, 202])(
    "a late visit reply %i honors shared exhaustion and cancels backoff",
    async (reply) => {
      const reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      statuses = ["held", ...Array(reply === 503 ? 5 : 6).fill(503)];
      reporter.reportVisit(VISIT);
      reporter.reportScreen("A");
      await settle();
      for (const delay of reply === 503
        ? [1000, 2000, 4000, 8000]
        : [1000, 2000, 4000, 8000, 16000])
        await advance(delay);
      const count = reply === 503 ? 7 : 8;
      expect(sent).toHaveLength(count);
      expect(jest.getTimerCount()).toBe(reply === 503 ? 1 : 0);
      release(reply === 202 ? { status: 202, data: { status: "queued" } } : reply);
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      expect(quiet).toEqual([false, true]);
      reporter.reportVisit(VISIT);
      focus();
      await advance(60000);
      expect(sent).toHaveLength(count);
    },
  );

  test.each([
    [202, "screen"],
    [400, "screen"],
    [503, "screen"],
    [503, "app"],
    [202, "cleanup"],
  ] as const)("a visit receipt %i releases its check before %s work", async (reply, next) => {
    stored.set(`${PREFIX}open`, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    if (next !== "screen") jest.setSystemTime(DAY_TWO);
    reporter.reportVisit(VISIT, { keepalive: true });
    if (next === "cleanup") reporter();
    release(reply);
    await settle();
    if (next === "screen") focus();
    await settle();
    expect(sent).toEqual([{ route: ROUTE, event: VISIT, options: { keepalive: true } }]);
    expect(jest.getTimerCount()).toBe(reply === 503 && next === "app" ? 1 : 0);
    if (next === "cleanup") expect(stored.has(`${PREFIX}check`)).toBe(false);
    if (next === "screen" && reply !== 503)
      expect(stored.get(`${PREFIX}check`)).toBe(reply === 202 ? "2026-10-03" : undefined);
    if (reply === 503) {
      statuses = [503, 202];
      if (next === "app") focus();
      else reporter.reportScreen("A");
      await settle();
      if (next === "app") {
        await advance(999);
        expect(sent).toHaveLength(1);
        await advance(1);
      } else await advance(1000);
      await advance(1999);
      expect(sent).toHaveLength(2);
      await advance(1);
      expect(sent.slice(1).map(({ event }) => event.event)).toEqual(
        next === "app" ? ["app_opened", "app_opened"] : ["screen_viewed", "screen_viewed"],
      );
    }
  });

  test("a visit-check reply keeps its reservation during a reentrant enabled callback", async () => {
    stored.set(`${PREFIX}open`, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    const checking = release;
    reporter.onQuietChange((quiet) => {
      if (!quiet) reporter.reportScreen("A");
    });
    const other = start();
    other.reportScreen("B");
    await settle();
    other();
    checking(202);
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([
      VISIT,
      { event: "screen_viewed", properties: { surface: "web", screen: "B" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
    ]);
  });
});
