import { describe, expect, test } from "bun:test";
import {
  computeThumbMetrics,
  computeTrackBounds,
  denormalizeScrollLeft,
  normalizeScrollLeft,
  scrollPosForThumbDelta,
  scrollPosForTrackClick,
  wheelDeltaToPixels,
} from "../../src/lib/utils/overlay-scrollbars.js";

describe("computeThumbMetrics", () => {
  test("hides thumb when content fits within the 1px subpixel slack", () => {
    expect(
      computeThumbMetrics({
        scrollSize: 201,
        clientSize: 200,
        scrollPos: 0,
        trackLength: 196,
        minThumbSize: 28,
      }),
    ).toEqual({ visible: false, size: 0, offset: 0 });
  });

  test("sizes thumb proportionally and places it at the scroll ratio", () => {
    const mid = computeThumbMetrics({
      scrollSize: 1000,
      clientSize: 200,
      scrollPos: 400,
      trackLength: 200,
      minThumbSize: 28,
    });
    expect(mid).toEqual({ visible: true, size: 40, offset: 80 });

    const end = computeThumbMetrics({
      scrollSize: 1000,
      clientSize: 200,
      scrollPos: 800,
      trackLength: 200,
      minThumbSize: 28,
    });
    expect(end).toEqual({ visible: true, size: 40, offset: 160 });
  });

  test("clamps thumb to minThumbSize for very long content and caps offset inside track", () => {
    const metrics = computeThumbMetrics({
      scrollSize: 50_000,
      clientSize: 200,
      scrollPos: 49_800,
      trackLength: 200,
      minThumbSize: 28,
    });
    expect(metrics).toEqual({ visible: true, size: 28, offset: 172 });
  });

  test("hides thumb when track length is too short to paint", () => {
    expect(
      computeThumbMetrics({
        scrollSize: 1000,
        clientSize: 200,
        scrollPos: 0,
        trackLength: 6,
        minThumbSize: 28,
      }).visible,
    ).toBe(false);
  });
});

describe("computeTrackBounds", () => {
  test("clears sticky header top inset and rounded corners", () => {
    expect(
      computeTrackBounds({
        viewportLength: 240,
        edgeInset: 2,
        startInset: 32,
        endInset: 0,
        startCornerRadius: 8,
        endCornerRadius: 8,
        reserveEndForOtherAxis: 0,
      }),
    ).toEqual({ start: 34, length: 198 });
  });

  test("reserves corner clearance when radius exceeds edge inset", () => {
    expect(
      computeTrackBounds({
        viewportLength: 200,
        edgeInset: 2,
        startInset: 0,
        endInset: 0,
        startCornerRadius: 10,
        endCornerRadius: 10,
        reserveEndForOtherAxis: 0,
      }),
    ).toEqual({ start: 10, length: 180 });
  });

  test("leaves room for the perpendicular track when both axes overflow", () => {
    expect(
      computeTrackBounds({
        viewportLength: 200,
        edgeInset: 2,
        startInset: 0,
        endInset: 0,
        startCornerRadius: 6,
        endCornerRadius: 6,
        reserveEndForOtherAxis: 12,
      }),
    ).toEqual({ start: 6, length: 182 });
  });
});

describe("pointer mapping", () => {
  test("maps drag delta linearly and clamps to scroll bounds", () => {
    expect(
      scrollPosForThumbDelta({
        startScrollPos: 200,
        deltaPx: 40,
        scrollSize: 1000,
        clientSize: 200,
        trackLength: 200,
        thumbSize: 40,
      }),
    ).toBe(400);

    expect(
      scrollPosForThumbDelta({
        startScrollPos: 700,
        deltaPx: 500,
        scrollSize: 1000,
        clientSize: 200,
        trackLength: 200,
        thumbSize: 40,
      }),
    ).toBe(800);

    expect(
      scrollPosForThumbDelta({
        startScrollPos: 50,
        deltaPx: -200,
        scrollSize: 1000,
        clientSize: 200,
        trackLength: 200,
        thumbSize: 40,
      }),
    ).toBe(0);
  });

  test("centers the thumb on track clicks and clamps at ends", () => {
    expect(
      scrollPosForTrackClick({
        clickOffsetInTrack: 100,
        scrollSize: 1000,
        clientSize: 200,
        trackLength: 200,
        thumbSize: 40,
      }),
    ).toBe(400);

    expect(
      scrollPosForTrackClick({
        clickOffsetInTrack: 5,
        scrollSize: 1000,
        clientSize: 200,
        trackLength: 200,
        thumbSize: 40,
      }),
    ).toBe(0);

    expect(
      scrollPosForTrackClick({
        clickOffsetInTrack: 195,
        scrollSize: 1000,
        clientSize: 200,
        trackLength: 200,
        thumbSize: 40,
      }),
    ).toBe(800);
  });
});

describe("wheelDeltaToPixels", () => {
  test("passes pixel deltas through unchanged", () => {
    expect(
      wheelDeltaToPixels({
        deltaX: -12,
        deltaY: 48,
        deltaMode: 0,
        lineHeight: 20,
        pageWidth: 400,
        pageHeight: 300,
      }),
    ).toEqual({ dx: -12, dy: 48 });
  });

  test("scales line deltas by line height", () => {
    expect(
      wheelDeltaToPixels({
        deltaX: 2,
        deltaY: 3,
        deltaMode: 1,
        lineHeight: 18,
        pageWidth: 400,
        pageHeight: 300,
      }),
    ).toEqual({ dx: 36, dy: 54 });
  });

  test("scales page deltas by viewport dimensions", () => {
    expect(
      wheelDeltaToPixels({
        deltaX: -1,
        deltaY: 1,
        deltaMode: 2,
        lineHeight: 18,
        pageWidth: 400,
        pageHeight: 300,
      }),
    ).toEqual({ dx: -400, dy: 300 });
  });
});

describe("RTL scrollLeft normalization", () => {
  test("passes LTR offsets through clamped to [0, maxScroll]", () => {
    expect(normalizeScrollLeft(0, 400, false)).toBe(0);
    expect(normalizeScrollLeft(150, 400, false)).toBe(150);
    expect(normalizeScrollLeft(600, 400, false)).toBe(400);
    expect(normalizeScrollLeft(-20, 400, false)).toBe(0);

    expect(denormalizeScrollLeft(0, 400, false)).toBe(0);
    expect(denormalizeScrollLeft(150, 400, false)).toBe(150);
    expect(denormalizeScrollLeft(600, 400, false)).toBe(400);
  });

  test("maps negative RTL scrollLeft to visual left-to-right coordinates and back", () => {
    // At RTL start (right edge), scrollLeft is 0 -> visual right end (maxScroll).
    expect(normalizeScrollLeft(0, 400, true)).toBe(400);
    // Scrolled 100px left from right edge -> 300px from left end.
    expect(normalizeScrollLeft(-100, 400, true)).toBe(300);
    // Scrolled fully left -> visual left edge (0).
    expect(normalizeScrollLeft(-400, 400, true)).toBe(0);
    // Clamps out-of-range values cleanly.
    expect(normalizeScrollLeft(-500, 400, true)).toBe(0);
    expect(normalizeScrollLeft(50, 400, true)).toBe(400);

    // Round-trip back to negative DOM scrollLeft.
    expect(denormalizeScrollLeft(400, 400, true)).toBe(0);
    expect(denormalizeScrollLeft(300, 400, true)).toBe(-100);
    expect(denormalizeScrollLeft(0, 400, true)).toBe(-400);
    expect(denormalizeScrollLeft(-50, 400, true)).toBe(-400);
    expect(denormalizeScrollLeft(500, 400, true)).toBe(0);
  });
});
