import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
  startBrowserTelemetry,
  type BrowserTelemetryEvent,
  type BrowserTelemetryOptions,
  type TelemetryReceipt,
} from "../src/lib/utils/browser-telemetry.js";

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
type Reply = TelemetryReceipt;
let statuses: (number | "offline" | "held" | Reply)[];
let release: (status: number | Reply) => void;
let stops: (() => void)[];
let elapsed: number;
let advancingFrom: number | undefined;

/** A bare status is a body-less reply, except 202, which carries a `queued` receipt. */
const reply = (status: number | Reply): Reply =>
  typeof status === "number"
    ? { status, data: status === 202 ? { status: "queued" } : undefined }
    : status;
const post: BrowserTelemetryOptions["post"] = (route, event, options) => {
  sent.push(options ? { route, event, options } : { route, event });
  const next = statuses.shift() ?? 202;
  if (next === "held")
    return new Promise<Reply>((resolve) => (release = (status) => resolve(reply(status))));
  return next === "offline"
    ? Promise.reject(new TypeError("Failed to fetch"))
    : Promise.resolve(reply(next));
};
const start = (storageKey = STORAGE_KEY) => {
  const reporter = startBrowserTelemetry({ route: ROUTE, surface: "web", storageKey, post });
  stops.push(reporter.stop);
  return reporter;
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
/** Storage over `stored` that, like the browser's, lists its items through `Object.keys`. */
const storage = (overrides: Partial<Storage> = {}) =>
  new Proxy(
    {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
      ...overrides,
    },
    {
      ownKeys: () => [...stored.keys()],
      getOwnPropertyDescriptor: (_, key) => ({
        value: stored.get(String(key)),
        enumerable: true,
        configurable: true,
      }),
    },
  );
/** Stored claims as `{ key: "date,date" }` in recency order. */
const claims = () => {
  const lists: Record<string, string> = {};
  for (const [item] of [...stored].sort(([, a], [, b]) => Number(a) - Number(b))) {
    const key = item.slice(0, item.lastIndexOf(":"));
    const date = item.slice(key.length + 1);
    lists[key] = lists[key] ? `${lists[key]},${date}` : date;
  }
  return lists;
};
const seed = (key: string, dates: string) => {
  for (const date of dates.split(",")) stored.set(`${key}:${date}`, String(stored.size + 1));
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
  g.localStorage = storage();
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

describe("startBrowserTelemetry", () => {
  test("unknown permission drops keepalive visits until the cooldown expires", async () => {
    statuses = [400];
    const previous = start();
    await settle();
    previous.stop();
    const reporter = start();
    statuses = [503, 202];
    reporter.reportVisit(VISIT);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);

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

  test.each(["recovered", "observed"])(
    "%s storage after a failed write keeps the page's claims",
    async (failure) => {
      g.localStorage = storage({
        setItem: () => {
          throw new Error("full");
        },
      });
      const reporter = start();
      reporter.reportScreen("A");
      await settle();
      g.localStorage = storage();
      if (failure === "observed") {
        const other = start();
        other.reportScreen("A");
        await settle();
        other.stop();
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
      expect(claims()[`${PREFIX}open`]).toBe(failure === "observed" ? "2026-10-03" : undefined);
    },
  );

  test.each(["working", "read", "write", "both"])(
    "claims dedupe rollback and evict dates beyond the last 35 with %s storage",
    async (failure) => {
      if (failure === "both") blockStorage();
      else if (failure === "read")
        g.localStorage = storage({
          getItem: () => {
            throw new Error("blocked read");
          },
        });
      else if (failure === "write") {
        seed(`${PREFIX}open`, "2026-10-03");
        g.localStorage = storage({
          setItem: () => {
            throw new DOMException("full", "QuotaExceededError");
          },
        });
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
      if (failure === "working") {
        for (const key of [`${PREFIX}open`, `${PREFIX}screen.A`, `${PREFIX}check`]) {
          const dates = claims()[key]!.split(",");
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

  test("disable() quiets the page and its reloads without sending until a later UTC day", async () => {
    seed("unrelated.setting", "kept");
    const reporter = start();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    reporter.reportScreen("A");
    await settle();
    expect(sent.map(({ event }) => event.properties.screen ?? event.event)).toEqual([
      "app_opened",
      "A",
    ]);
    reporter.disable();
    expect(quiet).toEqual([true, false, true]);
    expect(claims()).toEqual({
      "unrelated.setting": "kept",
      [`${PREFIX}open`]: "2026-10-03",
      [`${PREFIX}check`]: "2026-10-03",
      [`${PREFIX}quiet`]: "2026-10-03",
    });
    reporter.reportScreen("B");
    reporter.reportVisit(VISIT, { keepalive: true });
    focus();
    await advance(60000);
    expect(sent).toHaveLength(2);
    reporter.stop();
    const reloaded = start();
    const reloadedQuiet: boolean[] = [];
    reloaded.onQuietChange((value) => reloadedQuiet.push(value));
    await settle();
    expect(reloadedQuiet).toEqual([true]);
    expect(sent).toHaveLength(2);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(2).map(({ event }) => event.event)).toEqual(["app_opened"]);
  });

  test("a disabled receipt drops stored screen names from every day", async () => {
    seed(`${PREFIX}screen.A`, "2026-10-01,2026-10-02");
    seed(`${PREFIX}screen.B%2FC`, "2026-10-02");
    seed(`${PREFIX}open`, "2026-10-02");
    statuses = [{ status: 202, data: { status: "disabled" } }];
    start();
    await settle();
    expect(claims()).toEqual({
      [`${PREFIX}open`]: "2026-10-02",
      [`${PREFIX}quiet`]: "2026-10-03",
    });
  });

  test("a screen reply that lands after disable() stores no screen name", async () => {
    const reporter = start();
    await settle();
    statuses = ["held"];
    reporter.reportScreen("A");
    reporter.disable();
    release(202);
    await settle();
    expect(`${PREFIX}screen.A` in claims()).toBe(false);
    expect(sent).toHaveLength(2);
  });

  test.each(["running", "stopped", "after midnight"])(
    "a screen reply after another tab's opt-out stores no screen name: %s",
    async (variant) => {
      seed(`${PREFIX}screen.A`, "2026-10-02");
      const tab = start();
      await settle();
      statuses = ["held"];
      tab.reportScreen("A");
      const held = release;
      if (variant === "after midnight") jest.setSystemTime(DAY_TWO);
      const other = start();
      await settle();
      other.disable();
      expect(`${PREFIX}screen.A` in claims()).toBe(false);
      if (variant === "stopped") tab.stop();
      held(202);
      await settle();
      expect(`${PREFIX}screen.A` in claims()).toBe(false);
    },
  );

  test.each(["running", "stopped"])(
    "screen history a racing %s tab writes after an opt-out is dropped when the opt-out is seen",
    async (variant) => {
      const tab = start();
      await settle();
      statuses = ["held"];
      tab.reportScreen("A");
      const held = release;
      const other = start();
      await settle();
      // Another renderer's opt-out lands between this tab's opt-out check and its write.
      g.localStorage = storage({
        setItem: (key: string, value: string) => {
          if (key.startsWith(`${PREFIX}screen.A:`)) other.disable();
          stored.set(key, value);
        },
      });
      if (variant === "stopped") tab.stop();
      held(202);
      await settle();
      if (variant === "stopped") {
        expect(`${PREFIX}screen.A` in claims()).toBe(true);
        other.reportScreen("B");
      }
      expect(`${PREFIX}screen.A` in claims()).toBe(false);
      expect(sent).toHaveLength(2);
    },
  );

  test("an app-open answered after cleanup stays claimed for the next page", async () => {
    statuses = ["held"];
    start().stop();
    release(202);
    await settle();
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened"]);
  });

  test("another page's evictions from readable storage bound this page's claims to 35 dates", async () => {
    const reporter = start();
    await settle();
    for (let date = 4; date <= 72; date++) {
      jest.setSystemTime(new Date(Date.UTC(2026, 9, date, 12)));
      const other = date <= 37 ? undefined : start();
      if (!other) focus();
      await settle();
      other?.stop();
    }
    const count = sent.length;
    jest.setSystemTime(DAY_ONE);
    focus();
    await settle();
    expect(sent.slice(count).map(({ event }) => event.event)).toEqual(["app_opened"]);
    reporter.stop();
  });

  test("unpruned stored extras beyond the newest 35 dates claim nothing", async () => {
    const dates = Array.from({ length: 36 }, (_, i) =>
      new Date(Date.UTC(2026, 9, 3 + i)).toISOString().slice(0, 10),
    );
    seed(`${PREFIX}open`, dates.join(","));
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened"]);
    expect(claims()[`${PREFIX}open`]!.split(",")).toEqual([...dates.slice(2), "2026-10-03"]);
  });

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
    await advance(1000);
    expect(sent.slice(1).map(({ event }) => event)).toEqual([
      VISIT,
      { event: "app_opened", properties: { surface: "web" } },
    ]);
    expect(quiet).toEqual([false, true]);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    reporter.reportVisit(VISIT);
    await settle();
    // The visit reported during the app-open retry was held for the enabled receipt.
    expect(sent.slice(3).map(({ event }) => event)).toEqual([
      VISIT,
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
      VISIT,
    ]);
    expect(quiet).toEqual([false, true, false]);
  });

  test.each([503, { status: 202, data: { status: "queued" } }])(
    "unknown visit checks rejected without a claim back off toward the cap; sixth reply %p",
    async (last) => {
      statuses = [404];
      const reporter = start();
      await settle();
      const reasons: string[] = [];
      reporter.onQuietChange((_, reason) => reasons.push(reason));
      statuses = Array.from({ length: 20 }, () => 429);
      for (let i = 0; i < 20; i++) {
        reporter.reportVisit(VISIT);
        await settle();
      }
      expect(sent).toHaveLength(2);
      for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
        await advance(delay - 1);
        reporter.reportVisit(VISIT);
        await settle();
        expect(sent).toHaveLength(2 + index);
        await advance(1);
        statuses = [index === 4 ? last : index % 2 ? 429 : 503];
        reporter.reportVisit(VISIT);
        await settle();
      }
      expect(sent).toHaveLength(7);
      await advance(60000);
      reporter.reportVisit(VISIT);
      await settle();
      expect(sent).toHaveLength(last === 503 ? 7 : 8);
      expect(reasons).toEqual(last === 503 ? ["checking", "unavailable"] : ["checking", "enabled"]);
    },
  );

  test.each([
    [{ status: 202, data: { status: "unknown" } }, "unknown"],
    [new Response("broken", { status: 202 }), "unknown"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 200 }), "unknown"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 201 }), "unknown"],
    [{ status: 202, data: { status: "disabled" } }, "disabled"],
    [200, "unknown"],
    [202 as const, "enabled"],
    // A status-only adapter can't show an opt-out, so it never enables reports.
    [{ status: 202, data: undefined }, "unknown"],
    [{ status: 202 } as unknown as Reply, "unknown"],
    [{ status: 202, data: { status: "skipped" } }, "enabled"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 202 }), "enabled"],
  ] as const)(
    "first replies persist only disabled quiet and enable only queued or skipped receipts: %p",
    async (reply, outcome) => {
      statuses = [reply];
      const reporter = start();
      const reasons: string[] = [];
      reporter.onQuietChange((_, reason) => reasons.push(reason));
      await settle();
      focus();
      await advance(60000);
      expect(sent).toHaveLength(1);
      expect(claims()).toEqual(
        outcome === "disabled"
          ? { [`${PREFIX}quiet`]: "2026-10-03" }
          : outcome === "enabled"
            ? {
                [`${PREFIX}check`]: "2026-10-03",
                [`${PREFIX}open`]: "2026-10-03",
              }
            : { [`${PREFIX}open`]: "2026-10-03" },
      );
      const state = outcome === "unknown" ? "checking" : outcome;
      expect(reasons).toEqual(state === "checking" ? [state] : ["checking", state]);
      reporter.stop();
      const reloaded = start();
      const reloadedReasons: string[] = [];
      reloaded.onQuietChange((_, reason) => reloadedReasons.push(reason));
      await advance(60000);
      expect(reloadedReasons).toEqual([state]);
      expect(sent).toHaveLength(1);
    },
  );
  test.each(["screen", "visit check"])(
    "an interrupted 202 body is a terminal unreadable receipt for %s",
    async (kind) => {
      seed(`${PREFIX}open`, "2026-10-03");
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
      if (kind === "screen") expect(claims()[`${PREFIX}screen.A`]).toBe("2026-10-03");
      expect(`${PREFIX}check` in claims()).toBe(false);
      expect(`${PREFIX}quiet` in claims()).toBe(false);
    },
  );

  test.each(["enabled", "unknown"])(
    "a rejected screen stays claimed and releases the next screen with %s permission",
    async (permission) => {
      if (permission === "unknown") seed(`${PREFIX}open`, "2026-10-03");
      const reporter = start();
      await settle();
      statuses = ["held", "held"];
      reporter.reportScreen("A");
      reporter.reportScreen("B");
      release(400);
      await settle();
      reporter.reportVisit(VISIT, { keepalive: true });
      release(202);
      await settle();
      reporter.reportScreen("A");
      focus();
      await settle();
      expect(claims()[`${PREFIX}screen.A`]).toBe("2026-10-03");
      const reports = [
        { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
        { event: "screen_viewed", properties: { surface: "web", screen: "B" } },
        VISIT,
      ];
      expect(sent.map(({ event }) => event)).toEqual(
        permission === "enabled"
          ? [{ event: "app_opened", properties: { surface: "web" } }, ...reports]
          : reports,
      );
    },
  );

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
      other.stop();
      if (observation === "late 202") release(202);
      else focus();
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      const count = sent.length;
      await advance(60000);
      expect(sent).toHaveLength(count);
    },
  );

  test("visits and screens share backoff while enabled keepalive visits bypass it", async () => {
    const reporter = start();
    await settle();
    statuses = [503, 503];
    reporter.reportVisit(VISIT);
    await settle();
    reporter.reportScreen("A");
    await advance(999);
    expect(sent).toHaveLength(2);
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(2);
    await advance(1);
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "session_ended",
      "screen_viewed",
    ]);
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(3);
    statuses = [202];
    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent.at(-1)).toEqual({ route: ROUTE, event: VISIT, options: { keepalive: true } });
    statuses = [503, 202];
    await advance(2000);
    await advance(4000);
    await advance(60000);
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "session_ended",
      "screen_viewed",
      "session_ended",
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
      reporter.stop();
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

  test("encoded screens dedupe across reload and ignore a stored non-date claim", async () => {
    seed(`${PREFIX}screen.A%2FB`, "invalid");
    const reporter = start();
    reporter.reportScreen("A/B");
    reporter.reportScreen("B");
    reporter.reportScreen("A/B");
    await settle();
    focus();
    reporter.stop();
    const reloaded = start();
    reloaded.reportScreen("A/B");
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "screen_viewed",
      "screen_viewed",
    ]);
    expect(sent[1]?.event.properties).toEqual({ surface: "web", screen: "A/B" });
    expect(claims()[`${PREFIX}screen.A%2FB`]).toBe("invalid,2026-10-03");
  });

  test.each(["enabled", "rejected", "disabled", "cleanup"])(
    "visits during an in-flight check wait for an enabled receipt: %s",
    async (outcome) => {
      statuses = ["held"];
      const reporter = start();
      const first = { event: "first", properties: { n: 1 } };
      reporter.reportVisit(first, { keepalive: true });
      first.properties.n = 2;
      reporter.reportVisit({ event: "second", properties: {} });
      reporter.reportScreen("A");
      expect(sent.map(({ event }) => event.event)).toEqual(["app_opened"]);
      if (outcome === "cleanup") reporter.stop();
      release(
        outcome === "rejected"
          ? 400
          : { status: 202, data: { status: outcome === "disabled" ? "disabled" : "queued" } },
      );
      await advance(60000);
      const held = [
        {
          route: ROUTE,
          event: { event: "first", properties: { n: 1 } },
          options: { keepalive: true },
        },
        { route: ROUTE, event: { event: "second", properties: {} } },
      ];
      const screen = { event: "screen_viewed", properties: { surface: "web", screen: "A" } };
      expect(sent.slice(1)).toEqual(
        outcome === "enabled"
          ? [...held, { route: ROUTE, event: screen }]
          : outcome === "rejected"
            ? [{ route: ROUTE, event: screen }, ...held]
            : [],
      );
      expect(jest.getTimerCount()).toBe(0);
      if (outcome === "disabled") {
        jest.setSystemTime(DAY_TWO);
        focus();
        await settle();
        expect(claims()[`${PREFIX}check`]).toBe("2026-10-04");
        expect(
          sent.filter(({ event }) => event.event === "first" || event.event === "second"),
        ).toEqual([]);
      }
    },
  );

  test("held visits keep the first 64 copyable payloads", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit({ event: "uncopyable", properties: { run: () => {} } });
    for (let i = 0; i < 65; i++) reporter.reportVisit({ event: "held", properties: { i } });
    release(202);
    await settle();
    expect(sent.slice(1).map(({ event }) => event.properties.i)).toEqual(
      Array.from({ length: 64 }, (_, i) => i),
    );
  });

  test("held visits survive rollover until the new day's enabled receipt", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    const previousDay = release;
    jest.setSystemTime(DAY_TWO);
    statuses = ["held"];
    previousDay(202);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
    release(202);
    await settle();
    expect(sent.at(-1)?.event).toEqual(VISIT);
    expect(sent).toHaveLength(3);
  });

  test("a later visit uses the oldest held visit to check after an unreadable app-open receipt", async () => {
    statuses = ["held"];
    const reporter = start();
    const reasons: string[] = [];
    reporter.onQuietChange((_, reason) => reasons.push(reason));
    reporter.reportVisit({ event: "old", properties: {} }, { keepalive: true });
    release(new Response("truncated", { status: 202 }));
    await settle();
    expect(claims()[`${PREFIX}open`]).toBe("2026-10-03");
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened"]);
    statuses = ["held"];
    reporter.reportVisit({ event: "new", properties: {} });
    expect(sent.slice(1)).toEqual([
      { route: ROUTE, event: { event: "old", properties: {} }, options: { keepalive: true } },
    ]);
    release(202);
    await settle();
    expect(reasons).toEqual(["checking", "enabled"]);
    expect(sent.slice(1).map(({ event }) => event.event)).toEqual(["old", "new"]);
  });

  test("a new visit after rollover waits behind older visits for today's enabled receipt", async () => {
    statuses = ["held", "held"];
    const reporter = start();
    const previousDay = release;
    reporter.reportVisit({ event: "old", properties: {} });
    jest.setSystemTime(DAY_TWO);
    reporter.reportVisit({ event: "new", properties: {} });
    const currentDay = release;
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
    previousDay(202);
    await settle();
    expect(sent).toHaveLength(2);
    currentDay(202);
    await settle();
    expect(sent.slice(2).map(({ event }) => event.event)).toEqual(["old", "new"]);
  });

  test.each(["before", "after"])(
    "yesterday's 401 arriving %s today's enabled receipt leaves today's gate enabled",
    async (order) => {
      statuses = ["held", "held"];
      const reporter = start();
      const previousDay = release;
      const reasons: string[] = [];
      reporter.onQuietChange((_, reason) => reasons.push(reason));
      jest.setSystemTime(DAY_TWO);
      focus();
      const currentDay = release;
      if (order === "before") {
        previousDay(401);
        await settle();
      }
      currentDay(202);
      await settle();
      if (order === "after") {
        previousDay(401);
        await settle();
      }
      reporter.reportVisit(VISIT);
      await settle();
      expect(reasons).toEqual(["checking", "enabled"]);
      expect(sent.map(({ event }) => event.event)).toEqual([
        "app_opened",
        "app_opened",
        "session_ended",
      ]);
      expect(claims()[`${PREFIX}open`]).toBe("2026-10-04");
    },
  );

  test("a visit permission check receiving 401 stops without retrying", async () => {
    seed(`${PREFIX}open`, "2026-10-03");
    const reporter = start();
    const reasons: string[] = [];
    reporter.onQuietChange((_, reason) => reasons.push(reason));
    statuses = [401];
    reporter.reportVisit(VISIT);
    await settle();
    focus();
    reporter.reportScreen("A");
    await advance(60000);
    expect(reasons).toEqual(["checking", "unavailable"]);
    expect(sent.map(({ event }) => event.event)).toEqual(["session_ended"]);
    expect(jest.getTimerCount()).toBe(0);
    expect(claims()[`${PREFIX}check`]).toBeUndefined();
  });

  test("a 401 stops the reporter without claiming the event until restart or the next UTC day", async () => {
    statuses = [401];
    const reporter = start();
    const reasons: string[] = [];
    reporter.onQuietChange((_, reason) => reasons.push(reason));
    await settle();
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT, { keepalive: true });
    focus();
    await advance(60000);
    expect(sent).toHaveLength(1);
    expect(claims()).toEqual({});
    expect(reasons).toEqual(["checking", "unavailable"]);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    expect(sent.slice(1).map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
    expect(reasons).toEqual(["checking", "unavailable", "checking", "enabled"]);
    reporter.stop();
    expect(reasons.at(-1)).toBe("stopped");
    jest.setSystemTime(DAY_ONE);
    start();
    await settle();
    expect(sent.at(-1)?.event.event).toBe("app_opened");
    expect(claims()[`${PREFIX}open`]).toBe("2026-10-04,2026-10-03");
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

  test("quiet notifications pause a visit tracker until an enabled receipt", async () => {
    statuses = ["held"];
    const reporter = start();
    let timer: ReturnType<typeof setInterval>;
    const changes: boolean[] = [];
    reporter.onQuietChange((quiet) => {
      changes.push(quiet);
      clearInterval(timer);
      if (!quiet) timer = setInterval(() => reporter.reportVisit(VISIT), 100);
    });
    await advance(100);
    expect(jest.getTimerCount()).toBe(0);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    expect(changes).toEqual([true, false]);
    expect(sent).toEqual([
      { route: ROUTE, event: { event: "app_opened", properties: { surface: "web" } } },
    ]);
    await advance(100);
    expect(sent.at(-1)?.event).toEqual(VISIT);
    expect(sent).toHaveLength(2);
  });

  test.each(["initial", "shared"])(
    "cleanup during %s enabled notification stops tracker timers; shared cleanup also cancels retries and focus",
    async (notification) => {
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
          reporter.stop();
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
      if (notification === "initial") return;
      stops.at(-1)?.();
      jest.setSystemTime(DAY_TWO);
      statuses = [503];
      const retrying = start();
      await settle();
      expect(jest.getTimerCount()).toBe(1);
      retrying.stop();
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
    other.stop();
    expect(claims()[`${PREFIX}check`]).toBe("2026-10-03");
    expect(changes).toEqual([true]);

    jest.setSystemTime(DAY_TWO);
    previousDay({ status: 202, data: { status: "queued" } });
    await settle();
    expect(sent.slice(2).map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
    ]);
    expect(changes).toEqual([true, false]);
    expect(claims()[`${PREFIX}check`]).toBe("2026-10-03,2026-10-04");
    expect(claims()[`${PREFIX}screen.A`]).toBe("2026-10-04");
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
    other.stop();
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
    expect(claims()[`${PREFIX}screen.A`]).toBeUndefined();
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
    expect(claims()[`${PREFIX}check`]).toBe("2026-10-03,2026-10-04");
    jest.setSystemTime(DAY_ONE);
    focus();
    await settle();
    expect(sent).toHaveLength(2);
    expect(claims()[`${PREFIX}open`]).toBe("2026-10-03,2026-10-04");
  });

  /** Holds screen A's D1 report, rolls to D2 so app-open is held too, then rolls back to D1. */
  const holdScreenAcrossRollback = async () => {
    const reporter = start();
    await settle();
    statuses = ["held", "held", "held"];
    reporter.reportScreen("A");
    const previous = release;
    jest.setSystemTime(DAY_TWO);
    focus();
    expect(sent.map(({ event }) => event.properties.screen ?? event.event)).toEqual([
      "app_opened",
      "A",
      "app_opened",
    ]);
    jest.setSystemTime(DAY_ONE);
    return { reporter, previous };
  };

  test.each(["same-success", "same-failure"] as const)(
    "a held screen keeps its date reserved across clock rollback until its reply: %p",
    async (reply) => {
      const { reporter, previous } = await holdScreenAcrossRollback();
      reporter.reportScreen("A");
      expect(sent).toHaveLength(3);
      expect(claims()[`${PREFIX}screen.A`]).toBeUndefined();
      previous(reply === "same-success" ? 202 : 503);
      await settle();
      expect(claims()[`${PREFIX}screen.A`]).toBe(
        reply === "same-success" ? "2026-10-03" : undefined,
      );
      expect(sent.filter(({ event }) => event.properties.screen === "A")).toHaveLength(
        reply === "same-success" ? 1 : 2,
      );
      if (reply === "same-failure") release(503);
      statuses = Array(6).fill(503);
      await settle();
      await advance(999);
      expect(sent).toHaveLength(reply === "same-success" ? 3 : 4);
      await advance(1);
      for (const delay of [2000, 4000, 8000, 16000, 60000]) await advance(delay);
      reporter.reportScreen("A");
      expect(sent.filter(({ event }) => event.properties.screen === "A")).toHaveLength(
        reply === "same-success" ? 1 : 7,
      );
    },
  );

  test.each([202, 503, "callback"] as const)(
    "old screen replies preserve the current request across clock rollback: %p",
    async (reply) => {
      const { reporter, previous } = await holdScreenAcrossRollback();
      reporter.reportScreen("B");
      previous(reply === 503 ? 503 : 202);
      await settle();
      const current = release;
      statuses = Array(6).fill(503);
      expect(sent.filter(({ event }) => event.properties.screen === "B")).toHaveLength(1);
      expect(claims()[`${PREFIX}screen.A`]).toBe(reply === 503 ? undefined : "2026-10-03");
      current(503);
      await settle();
      await advance(999);
      expect(sent.map(({ event }) => event.properties.screen ?? event.event)).toEqual([
        "app_opened",
        "A",
        "app_opened",
        "B",
      ]);
      await advance(1);
      expect(sent.filter(({ event }) => event.properties.screen === "B")).toHaveLength(2);
      reporter.onQuietChange((quiet) => {
        if (reply !== "callback" || !quiet) return;
        statuses = ["held", "held"];
        jest.setSystemTime(DAY_TWO);
        focus();
        jest.setSystemTime(DAY_ONE);
        reporter.reportScreen("B");
      });
      for (const delay of [2000, 4000, 8000, 16000]) await advance(delay);
      expect(sent.filter(({ event }) => event.properties.screen === "B")).toHaveLength(
        reply === "callback" ? 7 : 6,
      );
      expect(sent.filter(({ event }) => event.properties.screen === "A")).toHaveLength(1);
      expect(sent.filter(({ event }) => event.event === "app_opened")).toHaveLength(2);
      const count = sent.length;
      await advance(60000);
      if (reply === "callback") focus();
      else reporter.reportVisit(VISIT, { keepalive: true });
      expect(sent).toHaveLength(count);
    },
  );

  test.each(["enabled-first", "disabled-first"])(
    "yesterday's disabled reply quiets today's page and its reloads with %s replies",
    async (wake) => {
      jest.setSystemTime(new Date("2026-10-03T23:59:59.900Z"));
      statuses = ["held"];
      let reporter = start();
      await settle();
      const reasons: string[] = [];
      reporter.onQuietChange((_, reason) => reasons.push(reason));
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
        expect(reasons).toEqual(["checking", "enabled"]);
      }
      previousDay(disabled);
      await settle();
      if (wake === "disabled-first") {
        currentDay(enabled);
        await settle();
      }
      expect(reasons).toEqual(
        wake === "enabled-first" ? ["checking", "enabled", "disabled"] : ["checking", "disabled"],
      );
      expect(claims()[`${PREFIX}quiet`]).toBe("2026-10-03,2026-10-04");
      expect(claims()[`${PREFIX}check`]).toBe("2026-10-04");
      // The second listener's keepalive visit was held; an enabled receipt before the opt-out sends it.
      const count = wake === "enabled-first" ? 3 : 2;
      reporter.reportScreen("A");
      reporter.reportVisit(VISIT, { keepalive: true });
      await advance(60000);
      expect(sent).toHaveLength(count);
      expect(jest.getTimerCount()).toBe(0);
      reporter.stop();
      reporter = start();
      await settle();
      const reloaded: boolean[] = [];
      reporter.onQuietChange((value) => reloaded.push(value));
      expect(reloaded).toEqual([true]);
      expect(sent).toHaveLength(count);
      jest.setSystemTime(new Date("2026-10-05T00:00:00Z"));
      focus();
      await settle();
      expect(sent).toHaveLength(count + 1);
    },
  );

  test.each([
    ["disabled", "screen", "focus"],
    ["disabled", "app", "focus"],
    ["disabled", "app", "reload"],
    ["failed", "screen", "focus"],
  ] as const)(
    "late replies honor disabled and rollover: reply=%s, kind=%s, wake=%s",
    async (reply, kind, wake) => {
      jest.setSystemTime(new Date("2026-10-03T23:59:59.900Z"));
      if (kind === "app") statuses = ["held"];
      let reporter = start();
      await settle();
      const reasons: string[] = [];
      reporter.onQuietChange((_, reason) => reasons.push(reason));
      if (kind === "screen") {
        statuses = ["held"];
        reporter.reportScreen("A");
      }
      await settle();
      const previousDay = release;
      jest.setSystemTime(new Date("2026-10-04T00:00:00.100Z"));
      statuses = ["held"];
      previousDay(reply === "disabled" ? { status: 202, data: { status: "disabled" } } : 503);
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      const before = kind === "app" ? 1 : 2;
      if (reply === "disabled") {
        expect(sent).toHaveLength(before);
        expect(reasons).toEqual(
          kind === "app" ? ["checking", "disabled"] : ["enabled", "disabled"],
        );
        expect(claims()[`${PREFIX}quiet`]).toBe("2026-10-03");
        expect(claims()[`${PREFIX}check`]).toBe(kind === "app" ? undefined : "2026-10-03");
        expect(claims()[`${PREFIX}open`]).toBe(kind === "app" ? undefined : "2026-10-03");
        expect(`${PREFIX}screen.A` in claims()).toBe(false);
        reporter.reportScreen("A");
        reporter.reportVisit(VISIT, { keepalive: true });
        await advance(60000);
        expect(sent).toHaveLength(before);
        if (wake === "reload") {
          reporter.stop();
          reporter = start();
          reporter.onQuietChange((_, reason) => reasons.push(reason));
          reporter.reportScreen("A");
        } else focus();
        await settle();
      }
      expect(sent.slice(before).map(({ event }) => event.event)).toEqual(["app_opened"]);
      release({ status: 202, data: { status: "queued" } });
      await settle();
      expect(reasons).toEqual(
        kind === "screen"
          ? ["enabled", ...(reply === "disabled" ? ["disabled"] : []), "checking", "enabled"]
          : wake === "reload"
            ? ["checking", "disabled", "stopped", "checking", "enabled"]
            : ["checking", "disabled", "checking", "enabled"],
      );
      expect(sent.at(-1)?.event).toEqual({
        event: "screen_viewed",
        properties: { surface: "web", screen: "A" },
      });
      expect(claims()[`${PREFIX}screen.A`]).toBe("2026-10-04");
    },
  );

  test("six daily failures stop retries until the next UTC day", async () => {
    statuses = Array(6).fill(503);
    const reporter = start();
    const changes: string[] = [];
    reporter.onQuietChange((_, reason) => changes.push(reason));
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
    expect(changes).toEqual(["checking", "unavailable", "checking", "enabled"]);
  });

  test("a disabled page waits for focus after rollover despite screen and visit reports and stays quiet on rollback", async () => {
    statuses = Array(2).fill({ status: 202, data: { status: "disabled" } });
    const reporter = start();
    await settle();
    jest.setSystemTime(DAY_TWO);
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT, { keepalive: true });
    await settle();
    expect(sent).toHaveLength(1);
    focus();
    await settle();
    expect(sent.slice(1).filter(({ event }) => event.event === "app_opened")).toHaveLength(1);
    jest.setSystemTime(DAY_ONE);
    focus();
    await settle();
    expect(sent).toHaveLength(2);
  });

  test.each([
    ["2099-01-01", undefined, "disabled", "quiet"],
    ["2026-10-02", "2099-01-01", "queued", "check"],
  ] as const)(
    "gate dates require today's check: quiet=%s, check=%s, reply=%s",
    async (quiet, check, reply, claim) => {
      seed(`${PREFIX}open`, "2026-10-03");
      seed(`${PREFIX}quiet`, quiet);
      if (check) seed(`${PREFIX}check`, check);
      statuses = ["held"];
      const reporter = start();
      await settle();
      reporter.reportScreen("A");
      reporter.reportVisit(VISIT);
      await settle();
      expect(sent.map(({ event }) => event.event)).toEqual(["screen_viewed"]);
      release({ status: 202, data: { status: reply } });
      await settle();
      expect(claims()[`${PREFIX}${claim}`]).toBe("2099-01-01,2026-10-03");
    },
  );

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
        reporter.stop();
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
    seed(`${PREFIX}open`, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    if (next !== "screen") jest.setSystemTime(DAY_TWO);
    reporter.reportVisit(VISIT, { keepalive: true });
    if (next === "cleanup") reporter.stop();
    release(reply);
    await settle();
    if (next === "screen") focus();
    await settle();
    expect(sent).toEqual([{ route: ROUTE, event: VISIT, options: { keepalive: true } }]);
    expect(jest.getTimerCount()).toBe(reply === 503 && next === "app" ? 1 : 0);
    if (next === "cleanup") expect(claims()[`${PREFIX}check`]).toBe("2026-10-04");
    if (next === "screen" && reply !== 503)
      expect(claims()[`${PREFIX}check`]).toBe(reply === 202 ? "2026-10-03" : undefined);
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
    seed(`${PREFIX}open`, "2026-10-03");
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
    other.stop();
    checking(202);
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([
      VISIT,
      { event: "screen_viewed", properties: { surface: "web", screen: "B" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
    ]);
  });
});
