import { describe, expect, test } from "bun:test";
import {
  contrastRatio,
  mixHexColors,
  parseHexColor,
  readableInk,
} from "../src/lib/utils/color-contrast.js";

describe("parseHexColor", () => {
  test("normalizes 3- and 6-digit hex with or without #", () => {
    expect(parseHexColor("FA0")).toBe("#ffaa00");
    expect(parseHexColor(" #0072B2 ")).toBe("#0072b2");
  });

  test("rejects anything that is not 3 or 6 hex digits", () => {
    for (const value of ["", "#12", "#12345", "#1234567", "chartreuse", "rgb(0,0,0)"]) {
      expect(parseHexColor(value)).toBeNull();
    }
  });
});

describe("contrastRatio", () => {
  test("spans 1:1 to 21:1 and ignores argument order", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777", "#777")).toBe(1);
    expect(contrastRatio("#0072b2", "#ffffff")).toBe(contrastRatio("#ffffff", "#0072b2"));
  });

  test("matches published WCAG ratios", () => {
    // #767676 is the lightest gray that passes AA (4.5:1) on white.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  test("throws on a color it cannot measure", () => {
    expect(() => contrastRatio("tomato", "#fff")).toThrow();
  });
});

describe("readableInk", () => {
  test("picks dark ink on light colors and white on dark ones", () => {
    expect(readableInk("#fef08a")).toBe("#1f2328");
    expect(readableInk("#0b1e3f")).toBe("#ffffff");
  });

  test("chooses among caller candidates", () => {
    expect(readableInk("#ffffff", ["#eeeeee", "#333333", "#000000"])).toBe("#000000");
  });
});

describe("mixHexColors", () => {
  test("matches CSS color-mix in srgb", () => {
    // color-mix(in srgb, #0072b2 10%, #ffffff) renders rgb(230, 241, 247).
    expect(mixHexColors("#0072b2", "#ffffff", 0.1)).toBe("#e6f1f7");
    expect(mixHexColors("#123456", "#abcdef", 1)).toBe("#123456");
    expect(mixHexColors("#123456", "#abcdef", 0)).toBe("#abcdef");
  });
});
