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
const start = (storageKey = STORAGE_KEY, send = post) => {
  const reporter = startBrowserTelemetry({ route: ROUTE, surface: "web", storageKey, post: send });
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
    if (!item.includes(":")) continue; // The opt-out token isn't a dated claim.
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
  Object.defineProperty(g, "localStorage", {
    configurable: true,
    get: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  });
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
  test.each([34, 36])(
    "a %i-day stored visit survives an auth pause only within retention",
    async (age) => {
      statuses = ["held"];
      const reporter = start();
      reporter.reportVisit(VISIT, { keepalive: true });
      reporter.stop();
      jest.setSystemTime(new Date(DAY_ONE.getTime() + age * 86400000));
      statuses = [401];
      const unauthorized = start();
      await settle();
      unauthorized.reportVisit({ event: "during_auth_pause", properties: {} });
      expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
      unauthorized.stop();
      start();
      await settle();
      expect(sent.map(({ event }) => event.event)).toEqual([
        "app_opened",
        "app_opened",
        "app_opened",
        ...(age === 34 ? ["session_ended"] : []),
      ]);
      expect([...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.`))).toEqual([]);
    },
  );

  test("a synchronous post throw leaves a stored visit available to a later reporter", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    reporter.stop();
    let throws = 0;
    const failing = start(STORAGE_KEY, (route, event, options) => {
      if (event.event === VISIT.event) {
        throws++;
        throw new Error("post could not start");
      }
      return post(route, event, options);
    });
    await settle();
    expect(throws).toBe(1);
    expect([...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.v1.`))).toHaveLength(
      1,
    );
    failing.stop();
    start();
    await settle();
    expect(sent.filter(({ event }) => event.event === VISIT.event)).toEqual([
      { route: ROUTE, event: VISIT },
    ]);
  });

  test("a stored enabled claim consumes a visit once even when its POST returns 503", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    reporter.stop();
    seed(`${PREFIX}open`, "2026-10-03");
    seed(`${PREFIX}check`, "2026-10-03");
    statuses = [503];
    start();
    await settle();
    await advance(1000);
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
  });

  test("pending storage caps visits across reporters at 64", async () => {
    statuses = ["held", "held"];
    const first = start();
    const second = start();
    for (let i = 0; i < 65; i++) {
      (i % 2 ? first : second).reportVisit({ event: "held", properties: { i } });
      await advance(1);
    }
    first.stop();
    second.stop();
    expect([...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.`))).toHaveLength(
      64,
    );
    start();
    for (let i = 0; i < 4; i++) await settle();
    expect(
      sent.filter(({ event }) => event.event === "held").map(({ event }) => event.properties.i),
    ).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });

  test("malformed records are removed without blocking valid neighbors", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    const prefix = `${PREFIX}outcome.v1.`;
    for (const [id, raw] of Object.entries({
      syntax: "{",
      null: "null",
      rank: '{"day":"2026-10-03","token":"","rank":0,"event":{"event":"bad","properties":{}}}',
      event: '{"day":"2026-10-03","token":"","rank":1,"event":{"event":42,"properties":{}}}',
      options:
        '{"day":"2026-10-03","token":"","rank":1,"event":{"event":"bad","properties":{}},"options":{"keepalive":"yes"}}',
    }))
      stored.set(prefix + id, raw);
    release(202);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
    expect([...stored.keys()].filter((key) => key.startsWith(prefix))).toEqual([]);
  });

  test("enqueue ranks preserve order with equal clocks, rollback, and reversed storage keys", async () => {
    g.localStorage = new Proxy(storage(), { ownKeys: () => [...stored.keys()].reverse() });
    statuses = ["held", "held"];
    const first = start();
    first.reportVisit({ event: "first", properties: {} });
    const second = start();
    second.reportVisit({ event: "second", properties: {} });
    jest.setSystemTime(new Date("2026-10-03T11:00:00Z"));
    first.reportVisit({ event: "third", properties: {} });
    first.stop();
    second.stop();
    start();
    await settle();
    expect(sent.slice(2).map(({ event }) => event.event)).toEqual([
      "app_opened",
      "first",
      "second",
      "third",
    ]);
  });

  test("equal stored ranks use record IDs to order visits", async () => {
    stored.set(
      `${PREFIX}outcome.v1.b`,
      '{"day":"2026-10-03","rank":1,"token":"","event":{"event":"second","properties":{}}}',
    );
    stored.set(
      `${PREFIX}outcome.v1.a`,
      '{"day":"2026-10-03","rank":1,"token":"","event":{"event":"first","properties":{}}}',
    );
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "first", "second"]);
  });

  /** Starts a reporter, then a stale reporter whose visit write lands after the other's opt-out. */
  const lateWrite = () => {
    statuses = ["held", "held"];
    const reporter = start();
    const stale = start();
    let raced = false;
    g.localStorage = new Proxy(
      storage({
        setItem: (key, value) => {
          stored.set(key, value);
          if (key.startsWith(`${PREFIX}outcome.`)) stale.stop();
        },
      }),
      {
        ownKeys: () => {
          // Another tab opts out after this tab snapshots permission, before it writes.
          const snapshot = [...stored.keys()];
          if (!raced) {
            raced = true;
            reporter.disable();
          }
          return snapshot;
        },
      },
    );
    stale.reportVisit({ event: "late", properties: {} });
    g.localStorage = storage();
    expect([...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.`))).toHaveLength(1);
    return reporter;
  };

  test.each(["rollover", "clock rollback"])(
    "a stale tab's late outcome stays discarded after %s while fresh visits send",
    async (clock) => {
      lateWrite().stop();
      jest.setSystemTime(clock === "rollover" ? DAY_TWO : new Date("2026-10-02T12:00:00Z"));
      statuses = ["held"];
      const fresh = start();
      fresh.reportVisit({ event: "fresh", properties: {} });
      release(202);
      await settle();
      expect(sent.map(({ event }) => event.event)).toEqual([
        "app_opened",
        "app_opened",
        "app_opened",
        "fresh",
      ]);
    },
  );

  test("blocked reads preserve visits admitted under a previously read opt-out token", async () => {
    statuses = ["held"];
    const optedOut = start();
    optedOut.disable();
    optedOut.stop();
    jest.setSystemTime(DAY_TWO);
    statuses = ["held"];
    const reporter = start();
    g.localStorage = storage({
      setItem: (key, value) => {
        if (key.startsWith(`${PREFIX}outcome.`))
          throw new DOMException("full", "QuotaExceededError");
        stored.set(key, value);
      },
    });
    reporter.reportVisit(VISIT);
    expect([...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.`))).toEqual([]);
    blockStorage();
    reporter.reportVisit({ event: "while_blocked", properties: {} });
    Object.defineProperty(g, "localStorage", {
      configurable: true,
      writable: true,
      value: storage(),
    });
    release(202);
    await settle();
    expect(sent.filter(({ event }) => event.event === VISIT.event)).toEqual([
      { route: ROUTE, event: VISIT },
    ]);
  });

  test("reads leave unknown outcome versions in place", async () => {
    const future = '{"day":"2026-10-03","rank":1,"event":{"event":"future","properties":{}}}';
    stored.set(`${PREFIX}outcome.v2.future`, future);
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    release(202);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
    expect(stored.get(`${PREFIX}outcome.v2.future`)).toBe(future);
  });

  test.each(["local", "receipt"])(
    "%s opt-out clears stored visits without touching another server",
    async (kind) => {
      statuses = ["held", "held"];
      const other = start("other-server");
      other.reportVisit({ event: "other", properties: {} });
      const reporter = start();
      reporter.reportVisit(VISIT);
      stored.set(`${PREFIX}outcome.v2.future`, "{}");
      if (kind === "local") reporter.disable();
      else release({ status: 202, data: { status: "disabled" } });
      await settle();
      expect([...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.`))).toEqual([]);
      reporter.stop();
      other.stop();
      jest.setSystemTime(DAY_TWO);
      start();
      await settle();
      expect(sent.filter(({ event }) => event.event === "session_ended")).toEqual([]);
      start("other-server");
      await settle();
      expect(sent.at(-1)?.event).toEqual({ event: "other", properties: {} });
    },
  );

  test.each(["rollover", "clock rollback"])(
    "a stale disabled pump preserves fresh visits after %s",
    async (clock) => {
      statuses = ["held"];
      const stale = start();
      stale.disable();
      jest.setSystemTime(clock === "rollover" ? DAY_TWO : new Date("2026-10-02T12:00:00Z"));
      statuses = ["held"];
      const fresh = start();
      fresh.reportVisit({ event: "fresh", properties: {} });
      stale.reportVisit({ event: "disabled", properties: {} });
      fresh.stop();
      start();
      await settle();
      expect(sent.map(({ event }) => event.event)).toEqual([
        "app_opened",
        "app_opened",
        "app_opened",
        "fresh",
      ]);
    },
  );

  test("opt-out on full storage clears another reporter's visit and keeps its quiet claim", async () => {
    statuses = ["held"];
    start().reportVisit(VISIT);
    const size = () =>
      [...stored].reduce((total, [key, value]) => total + key.length + value.length, 0);
    const capacity = size();
    const tokenWrites: { value: string; remaining: string[] }[] = [];
    g.localStorage = storage({
      setItem: (key, value) => {
        if (
          key.startsWith(PREFIX) &&
          !key.startsWith(`${PREFIX}outcome.`) &&
          !/:\d{4}-\d{2}-\d{2}$/.test(key)
        ) {
          tokenWrites.push({
            value,
            remaining: [...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.`)),
          });
        }
        if (size() - (stored.get(key)?.length ?? 0) + key.length + value.length > capacity)
          throw new DOMException("full", "QuotaExceededError");
        stored.set(key, value);
      },
    });
    statuses = ["held"];
    start().disable();
    expect(tokenWrites.map(({ remaining }) => remaining)).toEqual([[]]);
    expect(tokenWrites[0]!.value.length).toBeGreaterThan(0);
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
    jest.setSystemTime(DAY_TWO);
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "app_opened",
      "app_opened",
    ]);
  });

  test("a disabled receipt after stop clears held visits", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    reporter.stop();
    release({ status: 202, data: { status: "disabled" } });
    await settle();
    jest.setSystemTime(DAY_TWO);
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
  });

  test("blocked storage reads retain page visits until stop", async () => {
    blockStorage();
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    release(202);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
    jest.setSystemTime(DAY_TWO);
    statuses = ["held"];
    focus();
    reporter.reportVisit({ event: "lost", properties: {} });
    reporter.stop();
    start();
    await settle();
    expect(sent.filter(({ event }) => event.event === "lost")).toEqual([]);
  });

  test("blocked outcome writes retain page visits and consume stored ones", async () => {
    const key = `${PREFIX}outcome.v1.persisted`;
    stored.set(
      key,
      JSON.stringify({
        event: { event: "persisted", properties: {} },
        rank: 1,
        day: "2026-10-03",
        token: "",
      }),
    );
    g.localStorage = storage({
      setItem: (key, value) => {
        if (value.includes("session_ended")) throw new Error("quota");
        stored.set(key, value);
      },
    });
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit(VISIT);
    reporter.reportVisit({ event: "small", properties: {} });
    expect([...stored.keys()].filter((key) => key.startsWith(`${PREFIX}outcome.v1.`))).toHaveLength(
      2,
    );
    release(202);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "persisted",
      "session_ended",
      "small",
    ]);
    expect(stored.has(key)).toBe(false);
    reporter.stop();
    start();
    await settle();
    expect(sent.filter(({ event }) => event.event === "persisted")).toHaveLength(1);
  });

  test("repeated terminal daily actions do not scan localStorage", async () => {
    let scans = 0;
    g.localStorage = new Proxy(storage(), {
      ownKeys: (target) => {
        scans++;
        return Reflect.ownKeys(target);
      },
    });
    const reporter = start();
    reporter.reportDaily("message", VISIT);
    await settle();
    const before = scans;
    for (let i = 0; i < 10; i++) reporter.reportDaily("message", VISIT);
    expect(scans).toBe(before);
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
  });

  test("daily actions discard non-cloneable properties without throwing into the caller", async () => {
    const reporter = start();
    await settle();
    expect(() =>
      reporter.reportDaily("message", {
        event: "message_opened",
        properties: { callback: () => {} },
      }),
    ).not.toThrow();
    reporter.reportDaily("message", VISIT);
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      VISIT,
    ]);
  });

  test("daily actions snapshot the caller's event and properties while queued", async () => {
    statuses = ["held"];
    const reporter = start();
    const properties = { surface: "web", filter: { kind: "semantic" } };
    const event = { event: "search_executed", properties };
    reporter.reportDaily("search", event);
    event.event = "message_opened";
    properties.surface = "tui";
    properties.filter.kind = "keyword";
    event.properties = { surface: "other", filter: { kind: "different" } };
    release(202);
    await settle();
    expect(sent.slice(1).map(({ event }) => event)).toEqual([
      { event: "search_executed", properties: { surface: "web", filter: { kind: "semantic" } } },
    ]);
  });

  test("a late old-day action receipt leaves the same key pending on the new day", async () => {
    const reporter = start();
    await settle();
    statuses = ["held"];
    reporter.reportDaily("message", VISIT);
    const previousDay = release;
    jest.setSystemTime(DAY_TWO);
    statuses = ["held"];
    reporter.reportDaily("message", VISIT);
    const currentDay = release;
    previousDay(202);
    await settle();
    currentDay(202);
    await settle();
    reporter.reportDaily("message", { event: "today", properties: {} });
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "session_ended",
      "app_opened",
      "session_ended",
    ]);
    expect(claims()[`${PREFIX}daily.message`]).toBe("2026-10-03,2026-10-04");
  });

  test("daily keys share the screen queue and keep first events in caller order", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportDaily("message/web", VISIT);
    reporter.reportDaily("message/web", { event: "changed", properties: {} });
    reporter.reportDaily("search", {
      event: "search_run",
      properties: { surface: "web", type: "text" },
    });
    reporter.reportScreen("settings");
    expect(sent).toHaveLength(1);
    release(202);
    await settle();
    reporter.reportDaily("message/web", VISIT);
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "settings" } },
      VISIT,
      { event: "search_run", properties: { surface: "web", type: "text" } },
    ]);
    expect(claims()[`${PREFIX}daily.message%2Fweb`]).toBe("2026-10-03");
  });

  test.each([
    { status: 202, data: { status: "queued" } },
    { status: 202, data: {} },
    { status: 400, data: {} },
  ])("daily terminal receipt %p survives reloads and other tabs", async (receipt) => {
    const reporter = start();
    await settle();
    statuses = [receipt];
    reporter.reportDaily("message", VISIT);
    await settle();
    const other = start();
    other.reportDaily("message", VISIT);
    await settle();
    reporter.stop();
    other.stop();
    start().reportDaily("message", VISIT);
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      VISIT,
    ]);
  });

  test("failed daily actions stay unclaimed for retry and can report after rollover", async () => {
    const reporter = start();
    await settle();
    statuses = ["offline", 503];
    reporter.reportDaily("message", VISIT);
    await settle();
    expect(claims()[`${PREFIX}daily.message`]).toBeUndefined();
    await advance(1000);
    expect(sent.slice(1).map(({ event }) => event)).toEqual([VISIT, VISIT]);
    expect(claims()[`${PREFIX}daily.message`]).toBeUndefined();
    jest.setSystemTime(DAY_TWO);
    reporter.reportDaily("message", VISIT);
    await settle();
    expect(sent.slice(-2).map(({ event }) => event.event)).toEqual(["app_opened", "session_ended"]);
    expect(claims()[`${PREFIX}daily.message`]).toBe("2026-10-04");
  });

  test("rollover drops an old-day action behind a held report", async () => {
    statuses = ["held"];
    const reporter = start();
    const previousDay = release;
    reporter.reportDaily("message", VISIT);
    jest.setSystemTime(DAY_TWO);
    focus();
    await settle();
    previousDay(202);
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      { event: "app_opened", properties: { surface: "web" } },
    ]);
    expect(claims()[`${PREFIX}daily.message`]).toBeUndefined();
    reporter.reportDaily("message", VISIT);
    await settle();
    expect(sent.slice(2).map(({ event }) => event)).toEqual([VISIT]);
    expect(claims()[`${PREFIX}daily.message`]).toBe("2026-10-04");
  });

  test.each(["receipt", "local", "other-tab"])(
    "daily opt-out via %s clears stored caller keys and stops storage scans",
    async (source) => {
      let scans = 0;
      g.localStorage = new Proxy(storage(), {
        ownKeys: (target) => {
          scans++;
          return Reflect.ownKeys(target);
        },
      });
      const reporter = start();
      await settle();
      reporter.reportDaily("already-sent", VISIT);
      await settle();
      statuses = ["held"];
      reporter.reportDaily("held", VISIT);
      reporter.reportDaily("pending", VISIT);
      if (source === "local") reporter.disable();
      if (source === "other-tab") {
        const other = start();
        other.disable();
        other.stop();
      }
      release(source === "receipt" ? { status: 202, data: { status: "disabled" } } : 202);
      await settle();
      const before = scans;
      reporter.reportDaily("after-opt-out", VISIT);
      reporter.reportDaily("another", VISIT);
      expect(scans).toBe(before);
      await advance(60000);
      expect(sent).toHaveLength(3);
      expect(Object.keys(claims()).filter((key) => key.startsWith(`${PREFIX}daily.`))).toEqual([]);
      jest.setSystemTime(DAY_TWO);
      reporter.reportDaily("after-opt-out", VISIT);
      expect(scans).toBe(before);
      focus();
      await settle();
      expect(sent.slice(3).map(({ event }) => event.event)).toEqual(["app_opened"]);
      reporter.reportDaily("after-opt-out", VISIT);
      await settle();
      expect(sent.slice(4).map(({ event }) => event)).toEqual([VISIT]);
    },
  );

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

  test("a 404 app-open check stays claimed across a same-day reload", async () => {
    statuses = Array(12).fill(404);
    const reporter = start();
    await settle();
    reporter.stop();
    start();
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened"]);
    await advance(60000);
    expect(sent).toHaveLength(1);
    expect(claims()[`${PREFIX}open`]).toBe("2026-10-03");
  });

  test("a visit after an unknown receipt waits for an enabled screen check", async () => {
    seed(`${PREFIX}open`, "2026-10-03");
    statuses = [{ status: 202, data: { status: "unknown" } }];
    const reporter = start();
    reporter.reportScreen("initial");
    await settle();
    expect(claims()[`${PREFIX}screen.initial`]).toBe("2026-10-03");
    expect(claims()[`${PREFIX}check`]).toBeUndefined();
    expect(claims()[`${PREFIX}quiet`]).toBeUndefined();
    statuses = ["held"];
    reporter.reportVisit(VISIT);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["screen_viewed"]);
    reporter.reportScreen("A");
    expect(sent.at(-1)?.event.properties.screen).toBe("A");
    release(202);
    await settle();
    expect(sent.slice(1).map(({ event }) => event)).toEqual([
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
      VISIT,
    ]);
  });

  test("exhausted unknown checks become unavailable until a new screen checks permission", async () => {
    statuses = [new Response("truncated", { status: 202 })];
    const reporter = start();
    const reasons: [boolean, string][] = [];
    reporter.onQuietChange((quiet, reason) => reasons.push([quiet, reason]));
    await settle();
    expect(reasons.map(([, reason]) => reason)).toEqual(["checking", "unavailable"]);
    statuses = [new Response("truncated", { status: 202 })];
    reporter.reportScreen("initial");
    expect(reasons.at(-1)).toEqual([true, "checking"]);
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "screen_viewed"]);
    expect(reasons.at(-1)).toEqual([true, "unavailable"]);
    focus();
    await advance(60000);
    expect(sent).toHaveLength(2);
    statuses = ["held"];
    reporter.reportScreen("A");
    expect(reasons.at(-1)).toEqual([true, "checking"]);
    reporter.reportVisit(VISIT);
    expect(sent).toHaveLength(3);
    expect(sent.at(-1)?.event.properties.screen).toBe("A");
    release(202);
    await settle();
    expect(reasons.at(-1)).toEqual([false, "enabled"]);
    expect(sent.slice(3).map(({ event }) => event)).toEqual([VISIT]);
  });

  test.each([401, "enabled visit"] as const)(
    "HTTP 401 leaves daily claims free and stops reporting: %p",
    async (outcome) => {
      const seededOpen = typeof outcome === "string";
      if (seededOpen) seed(`${PREFIX}open`, "2026-10-03");
      if (outcome === "enabled visit") seed(`${PREFIX}check`, "2026-10-03");
      statuses = [401];
      const before = claims();
      const reporter = start();
      if (seededOpen) reporter.reportVisit(VISIT);
      await settle();
      if (outcome === "enabled visit") expect(claims()).toEqual(before);
      else expect(claims()[`${PREFIX}open`]).toBeUndefined();
      await advance(999);
      expect(sent).toHaveLength(1);
      await advance(1);
      expect(sent).toHaveLength(1);
      reporter.reportScreen("A");
      focus();
      await advance(60000);
      expect(sent).toHaveLength(1);
      reporter.stop();
      start().reportScreen("A");
      await settle();
      if (outcome !== "enabled visit") expect(claims()[`${PREFIX}check`]).toBe("2026-10-03");
    },
  );

  test("HTTP 401 leaves a daily action unclaimed for an explicit retry", async () => {
    seed(`${PREFIX}open`, "2026-10-03");
    seed(`${PREFIX}check`, "2026-10-03");
    statuses = [401];
    const before = claims();
    const reporter = start();
    reporter.reportDaily("message", VISIT);
    await settle();
    expect(sent.map(({ event }) => event)).toEqual([VISIT]);
    expect(claims()).toEqual(before);
    await advance(60000);
    expect(sent).toHaveLength(1);
    reporter.stop();
    start().reportDaily("message", VISIT);
    await settle();
    expect(sent.slice(1).map(({ event }) => event)).toEqual([VISIT]);
    expect(claims()[`${PREFIX}daily.message`]).toBe("2026-10-03");
  });

  test.each(["daily", "queued"])(
    "six %s failures stop reporting until a new day's enabled receipt",
    async (kind) => {
      statuses = kind === "queued" ? ["held"] : Array(6).fill(503);
      const reporter = start();
      if (kind === "queued") {
        for (let i = 0; i < 8; i++) reporter.reportVisit({ event: "held", properties: { i } });
        statuses = Array(6).fill(503);
        release(202);
      }
      await settle();
      for (const delay of [1000, 2000, 4000, 8000, 16000]) await advance(delay);
      const count = kind === "queued" ? 7 : 6;
      expect(sent).toHaveLength(count);
      expect(jest.getTimerCount()).toBe(0);
      await advance(60000);
      focus();
      expect(sent).toHaveLength(count);
      reporter.reportScreen("A");
      jest.setSystemTime(DAY_TWO);
      statuses = ["held"];
      focus();
      expect(sent.at(-1)?.event.event).toBe("app_opened");
      expect(sent.filter(({ event }) => event.event === "held")).toHaveLength(
        kind === "queued" ? 6 : 0,
      );
      release(202);
      await settle();
      if (kind === "queued")
        expect(
          sent.filter(({ event }) => event.event === "held").map(({ event }) => event.properties.i),
        ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      else
        expect(sent.slice(count).map(({ event }) => event.event)).toEqual([
          "app_opened",
          "screen_viewed",
        ]);
    },
  );

  test("an enabled keepalive visit posts while a queued visit is still in flight", async () => {
    statuses = ["held"];
    const reporter = start();
    reporter.reportVisit({ event: "queued", properties: {} });
    statuses = ["held"];
    release(202);
    await settle();
    const queuedReply = release;
    reporter.reportVisit(VISIT, { keepalive: true });
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "queued", "session_ended"]);
    expect(sent.at(-1)?.options).toEqual({ keepalive: true });
    queuedReply(202);
    await settle();
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

  test.each(["working", "write", "blocked"])(
    "claims dedupe rollback and evict dates beyond the last 35 with %s storage",
    async (failure) => {
      if (failure === "blocked") blockStorage();
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

  test("a rejected app-open check after rollover leaves later reports able to check permission", async () => {
    const reporter = start();
    await settle();
    const quiet: boolean[] = [];
    reporter.onQuietChange((value) => quiet.push(value));
    jest.setSystemTime(DAY_TWO);
    statuses = [503, "held"];
    reporter.reportScreen("A");
    await settle();
    reporter.reportScreen("A");
    reporter.reportVisit(VISIT);
    await advance(1000);
    expect(sent.slice(1).map(({ event }) => event)).toEqual([
      { event: "app_opened", properties: { surface: "web" } },
      { event: "app_opened", properties: { surface: "web" } },
    ]);
    expect(quiet).toEqual([false, true]);
    release({ status: 202, data: { status: "queued" } });
    await settle();
    reporter.reportVisit(VISIT);
    await settle();
    expect(sent.slice(3).map(({ event }) => event)).toEqual([
      VISIT,
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
      VISIT,
    ]);
    expect(quiet).toEqual([false, true, false]);
  });

  test.each([
    [{ status: 202, data: { status: "unknown" } }, "unknown"],
    [new Response("broken", { status: 202 }), "unknown"],
    [new Response(JSON.stringify({ status: "queued" }), { status: 200 }), "unknown"],
    [{ status: 202, data: { status: "disabled" } }, "disabled"],
    [202 as const, "enabled"],
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
      const final = outcome === "unknown" ? "unavailable" : outcome;
      expect(reasons).toEqual(["checking", final]);
      reporter.stop();
      const reloaded = start();
      const reloadedReasons: string[] = [];
      reloaded.onQuietChange((_, reason) => reloadedReasons.push(reason));
      await advance(60000);
      expect(reloadedReasons).toEqual([final]);
      expect(sent).toHaveLength(1);
    },
  );
  test("a rejected enabled screen stays claimed and releases the next screen", async () => {
    const reporter = start();
    await settle();
    statuses = ["held"];
    reporter.reportScreen("A");
    reporter.reportScreen("B");
    release(400);
    await settle();
    reporter.reportScreen("A");
    focus();
    await settle();
    expect(claims()[`${PREFIX}screen.A`]).toBe("2026-10-03");
    expect(sent.map(({ event }) => event.properties.screen ?? event.event)).toEqual([
      "app_opened",
      "A",
      "B",
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

  test("visits and screens share backoff", async () => {
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
    statuses = [503, 202];
    await advance(2000);
    await advance(4000);
    await advance(60000);
    expect(sent.map(({ event }) => event.event)).toEqual([
      "app_opened",
      "session_ended",
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

  test("app-open claims stay independent across product keys", async () => {
    start();
    await settle();
    start("example.other.web");
    await settle();
    expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
  });

  test("encoded screens dedupe across reload", async () => {
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
    expect(claims()[`${PREFIX}screen.A%2FB`]).toBe("2026-10-03");
  });

  test("held visits preserve copied FIFO payloads and keepalive options", async () => {
    statuses = ["held"];
    const reporter = start();
    const visit = { event: "held", properties: { i: 0 } };
    reporter.reportVisit(visit, { keepalive: true });
    visit.properties.i = 99;
    reporter.reportVisit({ event: "uncopyable", properties: { run: () => {} } });
    reporter.reportVisit({ event: "held", properties: { i: 1 } });
    release(202);
    await settle();
    expect(sent.slice(1).map(({ event }) => event.properties.i)).toEqual([0, 1]);
    expect(sent[1]?.options).toEqual({ keepalive: true });
  });

  test.each([202, 401])(
    "held visits wait for today's enabled receipt after yesterday's %i",
    async (status) => {
      statuses = ["held"];
      const reporter = start();
      const previousDay = release;
      reporter.reportVisit({ event: "old", properties: {} });
      jest.setSystemTime(DAY_TWO);
      statuses = ["held"];
      reporter.reportVisit({ event: "new", properties: {} });
      previousDay(status);
      await settle();
      expect(sent.map(({ event }) => event.event)).toEqual(["app_opened", "app_opened"]);
      release(202);
      await settle();
      expect(sent.slice(2).map(({ event }) => event.event)).toEqual(["old", "new"]);
    },
  );

  test("quiet reasons distinguish checking, enabled, disabled, unavailable, and stopped", async () => {
    const reporter = start();
    const reasons: [boolean, string][] = [];
    reporter.onQuietChange((quiet, reason) => reasons.push([quiet, reason]));
    await settle();
    jest.setSystemTime(DAY_TWO);
    statuses = [401];
    focus();
    await settle();
    reporter.disable();
    reporter.stop();
    expect(reasons).toEqual([
      [true, "checking"],
      [false, "enabled"],
      [true, "checking"],
      [true, "unavailable"],
      [true, "disabled"],
      [true, "stopped"],
    ]);
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

  test.each(["initial", "shared"])(
    "cleanup during %s enabled notification stops trackers and later subscribers",
    async (notification) => {
      if (notification === "shared") statuses = ["held"];
      const reporter = start();
      if (notification === "initial") await settle();
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
      if (notification === "shared") {
        start();
        await settle();
      }
      const beforeCleanup = sent.slice();
      reporter.reportVisit(VISIT);
      expect(sent).toEqual(beforeCleanup);
      expect(changes).toEqual(notification === "shared" ? [true, false, true] : [false, true]);
      expect(later).toEqual(notification === "shared" ? [true, true] : [true]);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  test("stop cancels retry timers and removes focus reporting", async () => {
    statuses = [503];
    const reporter = start();
    await settle();
    expect(jest.getTimerCount()).toBe(1);
    const remove = jest.spyOn(window, "removeEventListener");
    reporter.stop();
    expect(remove).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
    const count = sent.length;
    focus();
    await advance(60000);
    expect(sent).toHaveLength(count);
  });

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

  test("shared claims stop screen retries", async () => {
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
  });

  test("rollover cancels the screen retry and resets app-open backoff", async () => {
    const reporter = start();
    await settle();
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
    expect(sent).toHaveLength(3);
    await advance(1);
    expect(sent.filter(({ event }) => event.event === "app_opened")).toHaveLength(3);
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
    const previousDay = release;
    jest.setSystemTime(DAY_TWO);
    focus();
    previousDay({ status: 202, data: { status: "queued" } });
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
      expect(quiet).toEqual(wake === "enabled-first" ? [true, false, true] : [true, true]);
      expect(claims()[`${PREFIX}quiet`]).toBe("2026-10-03,2026-10-04");
      expect(claims()[`${PREFIX}check`]).toBe("2026-10-04");
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

  test.each(["screen", "app"])(
    "a late disabled %s reply waits for focus before rollover",
    async (kind) => {
      jest.setSystemTime(new Date("2026-10-03T23:59:59.900Z"));
      if (kind === "app") statuses = ["held"];
      const reporter = start();
      await settle();
      const quiet: boolean[] = [];
      reporter.onQuietChange((value) => quiet.push(value));
      if (kind === "screen") {
        statuses = ["held"];
        reporter.reportScreen("A");
      }
      await settle();
      const previousDay = release;
      jest.setSystemTime(new Date("2026-10-04T00:00:00.100Z"));
      statuses = ["held"];
      previousDay({ status: 202, data: { status: "disabled" } });
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      const before = kind === "app" ? 1 : 2;
      expect(sent).toHaveLength(before);
      expect(quiet).toEqual(kind === "app" ? [true, true] : [false, true]);
      expect(claims()[`${PREFIX}quiet`]).toBe("2026-10-03");
      expect(claims()[`${PREFIX}check`]).toBe(kind === "app" ? undefined : "2026-10-03");
      expect(claims()[`${PREFIX}open`]).toBe(kind === "app" ? undefined : "2026-10-03");
      expect(`${PREFIX}screen.A` in claims()).toBe(false);
      reporter.reportScreen("A");
      reporter.reportVisit(VISIT, { keepalive: true });
      await advance(60000);
      expect(sent).toHaveLength(before);
      focus();
      await settle();
      expect(sent.slice(before).map(({ event }) => event.event)).toEqual(["app_opened"]);
      release({ status: 202, data: { status: "queued" } });
      await settle();
      expect(quiet).toEqual(
        kind === "screen" ? [false, true, true, false] : [true, true, true, false],
      );
      expect(sent.at(-1)?.event).toEqual({
        event: "screen_viewed",
        properties: { surface: "web", screen: "A" },
      });
      expect(claims()[`${PREFIX}screen.A`]).toBe("2026-10-04");
    },
  );

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
      if (reset === "rollover") statuses = ["held"];
      reporter.reportVisit(VISIT);
      if (reset === "rollover") {
        expect(sent[2]).toEqual({
          route: ROUTE,
          event: { event: "app_opened", properties: { surface: "web" } },
        });
        expect(sent).toHaveLength(3);
        release(202);
        await settle();
        expect(sent[3]).toEqual({ route: ROUTE, event: VISIT });
      } else expect(sent[2]).toEqual({ route: ROUTE, event: VISIT });
      await settle();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

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

  test("a failed screen receipt releases its reservation before retrying and later work", async () => {
    seed(`${PREFIX}open`, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    reporter.reportScreen("initial");
    reporter.reportScreen("A");
    release(503);
    await settle();
    expect(claims()[`${PREFIX}screen.initial`]).toBeUndefined();
    await advance(999);
    expect(sent).toHaveLength(1);
    await advance(1);
    expect(sent.map(({ event }) => event.properties.screen)).toEqual(["initial", "initial", "A"]);
    expect(claims()[`${PREFIX}screen.A`]).toBe("2026-10-03");
  });

  test("a screen-check reply keeps its reservation during a reentrant enabled callback", async () => {
    seed(`${PREFIX}open`, "2026-10-03");
    statuses = ["held"];
    const reporter = start();
    reporter.reportScreen("initial");
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
      { event: "screen_viewed", properties: { surface: "web", screen: "initial" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "B" } },
      { event: "screen_viewed", properties: { surface: "web", screen: "A" } },
    ]);
  });
});
