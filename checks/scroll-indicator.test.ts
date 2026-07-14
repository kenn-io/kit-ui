import { describe, expect, test } from "bun:test";
import { getScrollIndicatorGeometry } from "../src/lib/components/scroll-indicator.js";

describe("getScrollIndicatorGeometry", () => {
  test("hides the indicator when content fits", () => {
    expect(getScrollIndicatorGeometry(200, 200, 0)).toEqual({
      scrollable: false,
      height: 0,
      top: 0,
    });
  });

  test("sizes and positions the indicator within the viewport", () => {
    expect(getScrollIndicatorGeometry(100, 400, 150)).toEqual({
      scrollable: true,
      height: 25,
      top: 37.5,
    });
  });

  test("keeps a usable minimum thumb and clamps overscroll", () => {
    expect(getScrollIndicatorGeometry(100, 1000, 1200)).toEqual({
      scrollable: true,
      height: 24,
      top: 76,
    });
  });

  test("caps the thumb at the track height for sub-minimum viewports", () => {
    expect(getScrollIndicatorGeometry(20, 100, 40)).toEqual({
      scrollable: true,
      height: 20,
      top: 0,
    });
  });
});
