import { describe, expect, test } from "bun:test";
import {
  computeThumbMetrics,
  computeTrackBounds,
  scrollPosForThumbDelta,
  scrollPosForTrackClick,
} from "../src/lib/utils/overlay-scrollbars.js";

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
