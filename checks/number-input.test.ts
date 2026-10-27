import { describe, expect, test } from "bun:test";
import {
  clampNumber,
  formatNumber,
  isNumberDraft,
  parseNumberDraft,
  stepNumber,
} from "../src/lib/components/number-input.js";

describe("isNumberDraft", () => {
  test("integers with an optional minus when the range is unbounded below", () => {
    const bounds = { step: 1 };
    for (const text of ["", "-", "12", "-12", "007"]) {
      expect(isNumberDraft(text, bounds)).toBe(true);
    }
    for (const text of ["1.5", "1e3", "+1", "1-", "12a", " 1", "1,000"]) {
      expect(isNumberDraft(text, bounds)).toBe(false);
    }
  });

  test("no minus sign when min is 0 or above", () => {
    expect(isNumberDraft("-1", { min: 0, step: 1 })).toBe(false);
    expect(isNumberDraft("-", { min: 1, step: 1 })).toBe(false);
    expect(isNumberDraft("-1", { min: -5, step: 1 })).toBe(true);
  });

  test("one decimal point when the step is fractional", () => {
    const bounds = { min: 0, max: 1, step: 0.1 };
    for (const text of ["0.", ".5", "0.25", "1"]) {
      expect(isNumberDraft(text, bounds)).toBe(true);
    }
    expect(isNumberDraft("0.1.2", bounds)).toBe(false);
    expect(isNumberDraft("-0.5", bounds)).toBe(false);
  });

  test("numbers past Number.MAX_SAFE_INTEGER are refused", () => {
    expect(isNumberDraft("9007199254740991", { step: 1 })).toBe(true);
    expect(isNumberDraft("9007199254740992", { step: 1 })).toBe(false);
    expect(isNumberDraft("-9007199254740992", { step: 1 })).toBe(false);
  });

  test("a fractional min allows decimals even with an integer step", () => {
    expect(isNumberDraft("1.5", { min: 0.5, step: 1 })).toBe(true);
  });

  test("a fractional max allows decimals, so a value clamped to it stays editable", () => {
    const bounds = { min: 0, max: 2.5, step: 1 };
    expect(isNumberDraft(formatNumber(clampNumber(3, bounds)), bounds)).toBe(true);
  });
});

describe("parseNumberDraft", () => {
  test("drafts without digits mean no value", () => {
    expect(parseNumberDraft("")).toBeNull();
    expect(parseNumberDraft("-")).toBeNull();
    expect(parseNumberDraft(".")).toBeNull();
    expect(parseNumberDraft("-.")).toBeNull();
  });

  test("partial and padded drafts read as numbers", () => {
    expect(parseNumberDraft("1.")).toBe(1);
    expect(parseNumberDraft("-.5")).toBe(-0.5);
    expect(parseNumberDraft("007")).toBe(7);
  });
});

describe("stepNumber", () => {
  test("on-grid values move one step", () => {
    expect(stepNumber(10, 1, { min: 0, step: 5 })).toBe(15);
    expect(stepNumber(10, -1, { min: 0, step: 5 })).toBe(5);
  });

  test("off-grid values snap to the next grid point in that direction", () => {
    expect(stepNumber(7, 1, { min: 0, step: 5 })).toBe(10);
    expect(stepNumber(7, -1, { min: 0, step: 5 })).toBe(5);
  });

  test("the grid is anchored at min", () => {
    expect(stepNumber(6, 1, { min: 1, step: 5 })).toBe(11);
    expect(stepNumber(7, 1, { min: 1, step: 5 })).toBe(11);
  });

  test("decimal steps land on exact decimals", () => {
    expect(stepNumber(0.2, 1, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
    expect(stepNumber(0.3, -1, { min: 0, max: 1, step: 0.1 })).toBe(0.2);
    expect(stepNumber(0.30000000000000004, 1, { step: 0.1 })).toBe(0.4);
  });

  test("grid checks hold for large values and huge steps", () => {
    expect(stepNumber(1000000.2, 1, { min: 0, step: 0.1 })).toBe(1000000.3);
    expect(stepNumber(1, -1, { step: 1e10 })).toBe(0);
    expect(stepNumber(1, 1, { step: 1e10 })).toBe(1e10);
  });

  test("stepping stops at the safe-integer limit", () => {
    expect(stepNumber(Number.MAX_SAFE_INTEGER, 1, { step: 1 })).toBe(Number.MAX_SAFE_INTEGER);
    expect(stepNumber(-Number.MAX_SAFE_INTEGER, -1, { step: 1 })).toBe(-Number.MAX_SAFE_INTEGER);
  });

  test("steps finer than 100 decimal places still move the value", () => {
    expect(stepNumber(0, 1, { step: 1e-101 })).toBe(1e-101);
  });

  test("results stay inside min and max", () => {
    expect(stepNumber(3600, 1, { min: 1, max: 3600, step: 1 })).toBe(3600);
    expect(stepNumber(1, -1, { min: 1, max: 3600, step: 1 })).toBe(1);
    expect(stepNumber(0.95, 1, { min: 0, max: 1, step: 0.1 })).toBe(1);
  });

  test("an empty field starts from min going up and max going down", () => {
    expect(stepNumber(null, 1, { min: 1, max: 10, step: 1 })).toBe(1);
    expect(stepNumber(null, -1, { min: 1, max: 10, step: 1 })).toBe(10);
    expect(stepNumber(null, 1, { step: 1 })).toBe(0);
    expect(stepNumber(null, -1, { min: 5, step: 1 })).toBe(5);
  });
});

describe("formatNumber", () => {
  test("extreme values are written out in full digits", () => {
    expect(formatNumber(1e-7)).toBe("0.0000001");
    expect(formatNumber(-1.5e-7)).toBe("-0.00000015");
    expect(formatNumber(1e21)).toBe("1000000000000000000000");
    expect(formatNumber(1.25e21)).toBe("1250000000000000000000");
  });

  test("ordinary values keep their shortest form", () => {
    expect(formatNumber(null)).toBe("");
    expect(formatNumber(0.1)).toBe("0.1");
    expect(formatNumber(-42)).toBe("-42");
  });

  test("a formatted small value is still an editable draft", () => {
    expect(isNumberDraft(formatNumber(1e-7), { min: 0, step: 1e-7 })).toBe(true);
  });
});
