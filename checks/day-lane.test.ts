import { describe, expect, test } from "bun:test";
import {
  buildDayLaneSegments,
  type DayLaneEntry,
  type DayLaneItem,
  type DayLaneOverflow,
  type DayLanePlacedItem,
  hourTicks,
  isInDay,
  layoutDayLane,
  layoutDayLanes,
  lanesOf,
  minuteToY,
  placeColumns,
  placeTicks,
  renderedEndMinute,
} from "../src/lib/components/day-lane.js";

const at = (h: number, m = 0) => h * 60 + m;
const point = (id: string, h: number, m = 0): DayLaneItem => ({ id, startMinute: at(h, m) });
const span = (id: string, h1: number, m1: number, h2: number, m2: number): DayLaneItem => ({
  id,
  startMinute: at(h1, m1),
  endMinute: at(h2, m2),
});
const base = { dayMinutes: 1440, hourHeight: 96, minItemHeight: 44 };

const placed = (entries: DayLaneEntry[]) =>
  entries.filter((e): e is DayLanePlacedItem => e.kind === "item");
const overflows = (entries: DayLaneEntry[]) =>
  entries.filter((e): e is DayLaneOverflow => e.kind === "overflow");
const byId = (entries: DayLaneEntry[], id: string) => {
  const found = placed(entries).find((e) => e.item.id === id);
  if (!found) throw new Error(`no placed item ${id}`);
  return found;
};
/** Every input id appears exactly once, placed or inside an overflow. */
const accountedIds = (entries: DayLaneEntry[]) =>
  entries.flatMap((e) => (e.kind === "item" ? [e.item.id] : e.items.map((i) => i.id))).sort();
const rows = (segments: { kind: string; startMinute: number }[]) =>
  segments.map((s) => `${s.kind}:${s.startMinute / 60}`);

describe("segments and folding", () => {
  test("an empty day folds into one band", () => {
    const layout = layoutDayLane([], base);
    expect(layout.segments).toEqual([
      {
        kind: "fold",
        startMinute: 0,
        endMinute: 1440,
        top: 0,
        height: 32,
        key: "0-1440",
        foldHours: 24,
      },
    ]);
    expect(layout.height).toBe(32);
    expect(layout.entries).toEqual([]);
  });

  test("with folding off, an empty day is 24 hour rows", () => {
    const segments = buildDayLaneSegments([], { ...base, foldQuietMinutes: 0 });
    expect(segments).toHaveLength(24);
    expect(segments.every((s) => s.kind === "hour" && s.height === 96)).toBe(true);
    expect(segments[23]!.top).toBe(23 * 96);
  });

  test("a two-hour gap folds and a one-hour gap does not", () => {
    const segments = buildDayLaneSegments([point("a", 9), point("b", 11), point("c", 14)], base);
    // 0-9 fold, 9 busy, 10 empty (one hour, stays), 11 busy, 12-14 fold, 14 busy, 15-24 fold.
    expect(rows(segments)).toEqual([
      "fold:0",
      "hour:9",
      "hour:10",
      "hour:11",
      "fold:12",
      "hour:14",
      "fold:15",
    ]);
    expect(segments[4]).toMatchObject({ endMinute: at(14), foldHours: 2 });
  });

  test("foldQuietMinutes sets the shortest stretch that folds", () => {
    const items = [point("a", 9), point("b", 12)];
    const folds = (minutes: number) =>
      buildDayLaneSegments(items, { ...base, foldQuietMinutes: minutes })
        .filter((s) => s.kind === "fold")
        .map((s) => s.startMinute / 60);
    expect(folds(120)).toEqual([0, 10, 13]);
    // 10:00-12:00 is only two hours, so it stays open at 180 minutes.
    expect(folds(180)).toEqual([0, 13]);
  });

  test("an item's minimum height keeps the next hour open", () => {
    // 44px at 96px/h is 27.5 minutes, so a point at 9:45 reaches 10:12.
    const segments = buildDayLaneSegments([point("a", 9, 45)], base);
    expect(rows(segments)).toEqual(["fold:0", "hour:9", "hour:10", "fold:11"]);
    expect(renderedEndMinute(point("a", 9, 45), 96, 44)).toBe(at(10, 12.5));
  });

  test("an item ending exactly on the hour does not open the next one", () => {
    const segments = buildDayLaneSegments([span("a", 9, 0, 10, 0)], base);
    expect(rows(segments)).toEqual(["fold:0", "hour:9", "fold:10"]);
  });

  test("an opened fold shows its hours and marks the first with the key", () => {
    const items = [point("a", 9)];
    const fold = buildDayLaneSegments(items, base).find((s) => s.kind === "fold")!;
    const open = buildDayLaneSegments(items, { ...base, expandedFolds: [fold.key!] });
    expect(open.slice(0, 9).every((s) => s.kind === "hour")).toBe(true);
    expect(open[0]).toMatchObject({ key: fold.key, foldHours: 9 });
    expect(open[1]!.key).toBeUndefined();
    expect(open[9]!.startMinute).toBe(at(9));
    expect(open[10]!.kind).toBe("fold");
  });

  test("a 23-hour day has 23 rows and its last item lands on the last row", () => {
    const options = { ...base, dayMinutes: 1380, foldQuietMinutes: 0 };
    const layout = layoutDayLane([point("late", 22, 30)], options);
    expect(layout.segments).toHaveLength(23);
    expect(layout.height).toBe(23 * 96);
    expect(byId(layout.entries, "late").top).toBe(22.5 * 96);
    expect(layoutDayLane([point("gone", 23, 10)], options).outside).toEqual(["gone"]);
  });

  test("a 25-hour day has 25 rows and the 25th hour holds items", () => {
    const layout = layoutDayLane([point("x", 24, 15)], { ...base, dayMinutes: 1500 });
    expect(layout.outside).toEqual([]);
    const last = layout.segments[layout.segments.length - 1]!;
    expect(last).toMatchObject({ kind: "hour", startMinute: at(24), endMinute: 1500 });
    expect(layout.segments[0]).toMatchObject({ kind: "fold", foldHours: 24 });
    expect(byId(layout.entries, "x").top).toBe(32 + 24);
  });

  test("a day that is not a whole number of hours ends on a short row", () => {
    const segments = buildDayLaneSegments([], { ...base, dayMinutes: 1410, foldQuietMinutes: 0 });
    expect(segments).toHaveLength(24);
    expect(segments[23]).toMatchObject({ height: 48, endMinute: 1410 });
  });

  test("a day with no length has no rows", () => {
    expect(layoutDayLane([point("a", 0)], { ...base, dayMinutes: 0 }).segments).toEqual([]);
  });
});

describe("minuteToY", () => {
  const segments = buildDayLaneSegments([point("a", 9)], base);

  test("inside a fold it is the fold's top", () => {
    expect(minuteToY(segments, at(3), 96)).toBe(0);
  });

  test("after a fold it counts only open hours", () => {
    expect(minuteToY(segments, at(9), 96)).toBe(32);
    expect(minuteToY(segments, at(9, 30), 96)).toBe(32 + 48);
  });

  test("clamps before and after the day", () => {
    expect(minuteToY(segments, -60, 96)).toBe(0);
    expect(minuteToY(segments, 1500, 96)).toBe(32 + 96 + 32);
  });
});

describe("ticks", () => {
  test("hourTicks labels every hour of the day", () => {
    const ticks = hourTicks(1500, (h) => `${h}h`);
    expect(ticks).toHaveLength(25);
    expect(ticks[24]).toEqual({ minute: 1440, label: "24h" });
  });

  test("ticks inside a fold drop out, except the one that opens it", () => {
    const segments = buildDayLaneSegments([point("a", 9)], base);
    const ticks = placeTicks(
      hourTicks(1440, (h) => `${h}`),
      segments,
      96,
    );
    expect(ticks.map((t) => [t.label, t.top, t.atFold])).toEqual([
      ["0", 0, true],
      ["9", 32, false],
      ["10", 128, true],
    ]);
  });

  test("DST ticks from the caller keep their labels at their minutes", () => {
    // Spring forward: the caller labels minute 120 as 3 AM.
    const ticks = [
      { minute: 0, label: "12 AM" },
      { minute: 60, label: "1 AM" },
      { minute: 120, label: "3 AM" },
    ];
    const segments = buildDayLaneSegments([], { ...base, dayMinutes: 1380, foldQuietMinutes: 0 });
    expect(placeTicks(ticks, segments, 96).map((t) => [t.label, t.top])).toEqual([
      ["12 AM", 0],
      ["1 AM", 96],
      ["3 AM", 192],
    ]);
  });
});

describe("placing items", () => {
  test("two overlapping items sit side by side", () => {
    const { entries } = layoutDayLane([span("a", 9, 0, 10, 0), span("b", 9, 30, 10, 30)], base);
    expect(byId(entries, "a")).toMatchObject({ column: 0, columns: 2 });
    expect(byId(entries, "b")).toMatchObject({ column: 1, columns: 2 });
  });

  test("three overlapping items use three columns with no overflow", () => {
    const { entries } = layoutDayLane(
      [span("a", 9, 0, 10, 0), span("b", 9, 10, 10, 0), span("c", 9, 20, 10, 0)],
      base,
    );
    expect(overflows(entries)).toEqual([]);
    expect(placed(entries).map((e) => [e.item.id, e.column, e.columns])).toEqual([
      ["a", 0, 3],
      ["b", 1, 3],
      ["c", 2, 3],
    ]);
  });

  test("past the column limit the rest go into one +N more item, none lost", () => {
    const items = [
      span("a", 9, 0, 10, 0),
      span("b", 9, 5, 10, 0),
      span("c", 9, 10, 10, 0),
      span("d", 9, 15, 10, 0),
    ];
    const { entries } = layoutDayLane(items, base);
    expect(placed(entries).map((e) => [e.item.id, e.column, e.columns])).toEqual([
      ["a", 0, 3],
      ["b", 1, 3],
    ]);
    const [more] = overflows(entries);
    expect(more!.items.map((i) => i.id)).toEqual(["c", "d"]);
    expect(more).toMatchObject({ column: 2, columns: 3, startMinute: at(9, 10), height: 44 });
    expect(more!.top).toBe(32 + (10 / 60) * 96);
    expect(accountedIds(entries)).toEqual(["a", "b", "c", "d"]);
  });

  test("maxColumns is configurable", () => {
    const items = [span("a", 9, 0, 10, 0), span("b", 9, 5, 10, 0), span("c", 9, 10, 10, 0)];
    const { entries } = layoutDayLane(items, { ...base, maxColumns: 2 });
    expect(placed(entries).map((e) => e.item.id)).toEqual(["a"]);
    expect(overflows(entries)[0]!.items.map((i) => i.id)).toEqual(["b", "c"]);
    expect(overflows(entries)[0]).toMatchObject({ column: 1, columns: 2 });
  });

  test("point items at the same minute share the row, then overflow", () => {
    const items = ["p1", "p2", "p3", "p4", "p5"].map((id) => point(id, 14, 5));
    const capped = layoutDayLane(items, base).entries;
    expect(placed(capped)).toHaveLength(2);
    expect(overflows(capped)[0]!.items).toHaveLength(3);
    expect(accountedIds(capped)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    const wide = layoutDayLane(items, { ...base, maxColumns: 10 }).entries;
    expect(placed(wide).map((e) => e.column)).toEqual([0, 1, 2, 3, 4]);
    expect(placed(wide).every((e) => e.point && e.height === 44 && e.columns === 5)).toBe(true);
  });

  test("point items closer than their minimum height collide", () => {
    const { entries } = layoutDayLane([point("a", 9, 0), point("b", 9, 10)], base);
    expect(byId(entries, "b")).toMatchObject({ column: 1, columns: 2 });
    const apart = layoutDayLane([point("a", 9, 0), point("b", 9, 30)], base).entries;
    expect(byId(apart, "b")).toMatchObject({ column: 0, columns: 1 });
  });

  test("a freed column is reused inside a cluster", () => {
    const { entries } = layoutDayLane(
      [span("long", 9, 0, 11, 0), span("first", 9, 0, 10, 0), span("then", 10, 0, 11, 0)],
      base,
    );
    expect(byId(entries, "first").column).toBe(1);
    expect(byId(entries, "then").column).toBe(1);
    expect(placed(entries).every((e) => e.columns === 2)).toBe(true);
  });

  test("separate clusters do not share a column count", () => {
    const { entries } = layoutDayLane(
      [span("a", 9, 0, 10, 0), span("b", 9, 30, 10, 0), span("c", 13, 0, 14, 0)],
      base,
    );
    expect(byId(entries, "c")).toMatchObject({ column: 0, columns: 1 });
  });

  test("hidden items far apart in one cluster get separate +N more items", () => {
    const items = [
      span("a", 8, 0, 12, 0),
      span("b", 8, 0, 12, 0),
      point("c", 8, 0),
      point("d", 8, 0),
      point("e", 11, 0),
    ];
    const { entries } = layoutDayLane(items, base);
    expect(overflows(entries).map((o) => o.items.map((i) => i.id))).toEqual([["c", "d"], ["e"]]);
    expect(accountedIds(entries)).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("an item from the day before is clipped at the top", () => {
    const { entries, outside } = layoutDayLane([span("night", -1, 0, 1, 0)], {
      ...base,
      foldQuietMinutes: 0,
    });
    expect(outside).toEqual([]);
    expect(byId(entries, "night")).toMatchObject({
      top: 0,
      height: 96,
      clippedStart: true,
      clippedEnd: false,
    });
  });

  test("an item running into the next day is clipped at the bottom", () => {
    const { entries, height } = layoutDayLane([span("late", 23, 30, 25, 0)], {
      ...base,
      foldQuietMinutes: 0,
    });
    const late = byId(entries, "late");
    expect(late.clippedEnd).toBe(true);
    expect(late.top + late.height).toBe(height);
  });

  test("a card near the day's end stops at the end, below its minimum height", () => {
    const { entries, height } = layoutDayLane(
      [
        span("late", 23, 50, 25, 0),
        point("p1", 23, 55),
        point("p2", 23, 55),
        point("p3", 23, 55),
        point("p4", 23, 55),
      ],
      { ...base, foldQuietMinutes: 0 },
    );
    for (const e of entries) expect(e.top + e.height).toBeLessThanOrEqual(height);
    expect(byId(entries, "late").height).toBe(height - byId(entries, "late").top);
    expect(overflows(entries)).toHaveLength(1);
  });

  test("overflow keys stay distinct when ids contain spaces", () => {
    const a = layoutDayLane([point("x", 9), point("a b", 9), point("c", 9)], {
      ...base,
      maxColumns: 1,
    });
    const b = layoutDayLane([point("x", 9), point("a", 9), point("b c", 9)], {
      ...base,
      maxColumns: 1,
    });
    expect(overflows(a.entries)[0]!.key).not.toBe(overflows(b.entries)[0]!.key);
  });

  test("a carried-over card keeps open every hour it covers", () => {
    // At 32px per hour a 44px card from minute 0 reaches 1:22, so hour 1 stays open.
    const options = { ...base, hourHeight: 32 };
    const segments = buildDayLaneSegments([span("night", -1, 0, 0, 5)], options);
    expect(rows(segments)).toEqual(["hour:0", "hour:1", "fold:2"]);
    expect(renderedEndMinute(span("night", -1, 0, 0, 5), 32, 44)).toBe(82.5);
  });

  test("items outside the day are reported, not placed", () => {
    const items = [
      point("start", 0),
      point("end", 24),
      span("before", -2, 0, 0, 0),
      point("nan", NaN),
      { id: "untimed" },
    ];
    const layout = layoutDayLane(items, base);
    expect(placed(layout.entries).map((e) => e.item.id)).toEqual(["start"]);
    expect(layout.outside).toEqual(["end", "before", "nan", "untimed"]);
    expect(isInDay(point("x", 0), 1440)).toBe(true);
  });

  test("date-only items go to the strip and do not open hours", () => {
    const items: DayLaneItem[] = [
      { id: "z", dateOnly: true },
      { id: "a", dateOnly: true, startMinute: 600 },
      point("p", 9),
    ];
    const layout = layoutDayLane(items, base);
    expect(layout.dateOnly.map((i) => i.id)).toEqual(["z", "a"]);
    expect(placed(layout.entries).map((e) => e.item.id)).toEqual(["p"]);
    expect(layout.segments[0]).toMatchObject({ kind: "fold", foldHours: 9 });
  });

  test("entries come in reading order: top, then column", () => {
    const { entries } = layoutDayLane(
      [point("late", 15), span("b", 9, 30, 10, 0), span("a", 9, 0, 10, 0), point("x", 9, 0)],
      base,
    );
    expect(entries.map((e) => (e.kind === "item" ? e.item.id : "more"))).toEqual([
      "a",
      "x",
      "b",
      "late",
    ]);
  });
});

describe("lanes", () => {
  const withLane = (item: DayLaneItem, lane: DayLaneItem["lane"]): DayLaneItem => ({
    ...item,
    lane,
  });

  test("each lane gets its own columns on shared rows", () => {
    const items = [
      withLane(span("a", 9, 0, 10, 0), "mara"),
      withLane(span("b", 9, 0, 10, 0), "dev"),
      withLane(span("c", 9, 15, 10, 0), "mara"),
    ];
    const layout = layoutDayLanes(items, ["mara", "dev"], base);
    const [mara, dev] = layout.lanes;
    expect(mara!.key).toBe("mara");
    expect(placed(mara!.entries).map((e) => [e.item.id, e.column, e.columns])).toEqual([
      ["a", 0, 2],
      ["c", 1, 2],
    ]);
    expect(placed(dev!.entries).map((e) => [e.item.id, e.column, e.columns])).toEqual([
      ["b", 0, 1],
    ]);
    // Same rows in every lane, so 9 AM lines up.
    expect(byId(mara!.entries, "a").top).toBe(byId(dev!.entries, "b").top);
  });

  test("an item with several lanes appears in each", () => {
    const item = withLane(point("thread", 10), ["mara", "dev"]);
    const layout = layoutDayLanes([item], ["mara", "dev", "ines"], base);
    expect(layout.lanes.map((l) => l.entries.length)).toEqual([1, 1, 0]);
    expect(lanesOf(item)).toEqual(["mara", "dev"]);
  });

  test("a repeated lane key places the card once in that lane", () => {
    const layout = layoutDayLanes(
      [withLane(point("a", 9), ["mara", "mara", "dev"])],
      ["mara", "dev"],
      base,
    );
    expect(layout.lanes.map((l) => l.entries.length)).toEqual([1, 1]);
  });

  test("a quiet hour folds only when every lane is quiet", () => {
    const items = [withLane(point("a", 9), "mara"), withLane(point("b", 12), "dev")];
    const layout = layoutDayLanes(items, ["mara", "dev"], base);
    expect(rows(layout.segments)).toEqual(["fold:0", "hour:9", "fold:10", "hour:12", "fold:13"]);
  });

  test("items in no listed lane are reported and do not open hours", () => {
    const items = [
      withLane(point("a", 9), "mara"),
      withLane(point("b", 15), "gone"),
      point("c", 18),
      { id: "d", dateOnly: true, lane: "mara" },
    ];
    const layout = layoutDayLanes(items, ["mara"], base);
    expect(layout.unassigned).toEqual(["b", "c"]);
    expect(layout.dateOnly.map((i) => i.id)).toEqual(["d"]);
    expect(rows(layout.segments)).toEqual(["fold:0", "hour:9", "fold:10"]);
  });

  test("the column limit applies per lane", () => {
    const items = ["p1", "p2", "p3"].map((id) => withLane(point(id, 9), "mara"));
    const layout = layoutDayLanes(items, ["mara"], { ...base, maxColumns: 2 });
    const entries = layout.lanes[0]!.entries;
    expect(placed(entries)).toHaveLength(1);
    expect(overflows(entries)[0]!.items.map((i) => i.id)).toEqual(["p2", "p3"]);
  });
});

describe("placeColumns", () => {
  test("touching spans do not overlap", () => {
    const result = placeColumns(
      [
        { top: 0, bottom: 10 },
        { top: 10, bottom: 20 },
      ],
      3,
      10,
    );
    expect(result.placed.map((p) => [p.column, p.columns])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });
});

describe("performance", () => {
  test("a busy day of 600 items lays out quickly", () => {
    // Deterministic pseudo-random items, clustered in working hours.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const items: DayLaneItem[] = Array.from({ length: 600 }, (_, i) => {
      const startMinute = at(7) + rand() * 14 * 60;
      return rand() < 0.6
        ? { id: `i${i}`, startMinute }
        : { id: `i${i}`, startMinute, endMinute: startMinute + rand() * 90 };
    });
    layoutDayLane(items, base); // warm up
    const runs = 20;
    const t0 = performance.now();
    let layout = layoutDayLane(items, base);
    for (let r = 1; r < runs; r++) layout = layoutDayLane(items, base);
    const perRun = (performance.now() - t0) / runs;
    expect(accountedIds(layout.entries)).toHaveLength(600);
    // Generous bound for slow CI machines; locally this is about a millisecond.
    expect(perRun).toBeLessThan(50);
  });
});
