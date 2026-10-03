import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { startAppOpenedReporting, type AppOpenedEvent } from "../src/lib/utils/app-opened.js";

const ROUTE = "/api/v1/telemetry/events";
const DAY_ONE = new Date("2026-10-03T12:00:00Z");
const DAY_TWO = new Date("2026-10-04T00:30:00Z");

const g = globalThis as Record<string, unknown>;
let stored: Map<string, string>;
let sent: { route: string; event: AppOpenedEvent }[];
let statuses: (number | "offline" | "held")[];
let release: (status: number) => void;
let stops: (() => void)[];

const post = (route: string, event: AppOpenedEvent) => {
  sent.push({ route, event });
  const next = statuses.shift() ?? 202;
  if (next === "held")
    return new Promise<{ status: number }>(
      (resolve) => (release = (status) => resolve({ status })),
    );
  return next === "offline"
    ? Promise.reject(new TypeError("Failed to fetch"))
    : Promise.resolve({ status: next });
};
const start = () => {
  const stop = startAppOpenedReporting({ route: ROUTE, surface: "web", post });
  stops.push(stop);
  return stop;
};
const focus = () => window.dispatchEvent(new Event("focus"));
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
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
    jest.advanceTimersByTime(1000);
    await settle();
    expect(sent).toHaveLength(3);
    expect([...stored.values()]).toEqual(["2026-10-03"]);
    jest.advanceTimersByTime(5000);
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
    stored.set("kit-ui.app-opened.web", "2026-10-03");
    jest.advanceTimersByTime(5000);
    await settle();
    expect(sent).toHaveLength(1);
  });

  test("a late answer keeps a later day another tab recorded", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-03T23:59:59.500Z") });
    statuses = ["held"];
    start();
    await settle();
    stored.set("kit-ui.app-opened.web", "2026-10-04");
    release(202);
    await settle();
    expect([...stored.values()]).toEqual(["2026-10-04"]);
  });

  test("any answer counts, so an error status is not retried", async () => {
    statuses = [401];
    start();
    await settle();
    jest.advanceTimersByTime(5000);
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
});
