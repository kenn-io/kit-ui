import { describe, expect, test } from "bun:test";
import { offsetOfIndex, virtualSlice } from "../src/lib/components/virtual.js";

const fixed = (h: number) => () => h;

describe("virtualSlice", () => {
  test("fixed heights: slices the visible window plus overscan", () => {
    const s = virtualSlice({
      scrollTop: 300,
      viewport: 100,
      count: 100,
      overscan: 2,
      heightOf: fixed(10),
    });
    // visible rows: 30..40; overscan 2 each side
    expect(s.start).toBe(28);
    expect(s.end).toBe(42);
    expect(s.topPad).toBe(280);
    expect(s.totalHeight).toBe(1000);
  });

  test("clamps at the top", () => {
    const s = virtualSlice({
      scrollTop: 0,
      viewport: 50,
      count: 100,
      overscan: 3,
      heightOf: fixed(10),
    });
    expect(s.start).toBe(0);
    expect(s.topPad).toBe(0);
    expect(s.end).toBe(8); // 5 visible + 3 overscan
  });

  test("clamps at the bottom", () => {
    const s = virtualSlice({
      scrollTop: 990,
      viewport: 100,
      count: 100,
      overscan: 4,
      heightOf: fixed(10),
    });
    expect(s.end).toBe(100);
    expect(s.start).toBe(95); // one visible row (99) + 4 overscan
    expect(s.topPad).toBe(950);
  });

  test("empty list", () => {
    const s = virtualSlice({
      scrollTop: 0,
      viewport: 100,
      count: 0,
      heightOf: fixed(10),
    });
    expect(s).toEqual({ start: 0, end: 0, topPad: 0, totalHeight: 0 });
  });

  test("scrolled past the end still returns a valid empty-ish window", () => {
    const s = virtualSlice({
      scrollTop: 5000,
      viewport: 100,
      count: 10,
      overscan: 2,
      heightOf: fixed(10),
    });
    expect(s.totalHeight).toBe(100);
    expect(s.start).toBeGreaterThanOrEqual(0);
    expect(s.end).toBe(10);
    expect(s.start).toBeLessThanOrEqual(s.end);
  });

  test("variable heights: window accounts for measured rows", () => {
    // rows 0..4 are 100px, the rest 10px
    const heightOf = (i: number) => (i < 5 ? 100 : 10);
    const s = virtualSlice({
      scrollTop: 500,
      viewport: 50,
      count: 100,
      overscan: 0,
      heightOf,
    });
    // 500px = exactly past the five 100px rows
    expect(s.start).toBe(5);
    expect(s.topPad).toBe(500);
    expect(s.end).toBe(10); // five 10px rows fill the 50px viewport
    expect(s.totalHeight).toBe(5 * 100 + 95 * 10);
  });

  test("fixedHeight fast path matches the general path", () => {
    const cases = [
      { scrollTop: 0, viewport: 100, count: 100 }, // top clamp
      { scrollTop: 300, viewport: 100, count: 100 }, // row-aligned
      { scrollTop: 305, viewport: 73, count: 100 }, // mid-row
      { scrollTop: 990, viewport: 100, count: 100 }, // bottom clamp
      { scrollTop: 5000, viewport: 100, count: 10 }, // scrolled past end
      { scrollTop: -30, viewport: 100, count: 50 }, // overscroll bounce
      { scrollTop: 40, viewport: 100, count: 3 }, // list shorter than viewport
      { scrollTop: 0, viewport: 100, count: 0 }, // empty
    ];
    for (const input of cases) {
      for (const overscan of [0, 2, 4]) {
        const general = virtualSlice({ ...input, overscan, heightOf: fixed(10) });
        const fast = virtualSlice({ ...input, overscan, heightOf: fixed(10), fixedHeight: 10 });
        expect(fast).toEqual(general);
      }
    }
  });

  test("negative scrollTop (overscroll bounce) behaves like 0", () => {
    const s = virtualSlice({
      scrollTop: -30,
      viewport: 100,
      count: 50,
      overscan: 1,
      heightOf: fixed(20),
    });
    expect(s.start).toBe(0);
    expect(s.topPad).toBe(0);
  });
});

describe("offsetOfIndex", () => {
  test("fixed", () => {
    expect(offsetOfIndex(7, 100, fixed(12))).toBe(84);
  });

  test("variable", () => {
    const heightOf = (i: number) => (i % 2 === 0 ? 10 : 30);
    expect(offsetOfIndex(4, 100, heightOf)).toBe(80);
  });

  test("clamps out-of-range indexes", () => {
    expect(offsetOfIndex(-5, 10, fixed(10))).toBe(0);
    expect(offsetOfIndex(50, 10, fixed(10))).toBe(100);
  });

  test("fixedHeight fast path matches the general path", () => {
    for (const index of [-5, 0, 7, 10, 50]) {
      expect(offsetOfIndex(index, 10, fixed(10), 10)).toBe(offsetOfIndex(index, 10, fixed(10)));
    }
  });
});
