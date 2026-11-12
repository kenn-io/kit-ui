import { describe, expect, test } from "bun:test";
import { formatCount, formatInitials } from "../src/lib/utils/format.ts";

describe("formatCount", () => {
  test("plain below 1,000", () => {
    expect(formatCount(0, "en")).toBe("0");
    expect(formatCount(516, "en")).toBe("516");
    expect(formatCount(999, "en")).toBe("999");
    expect(formatCount(-42, "en")).toBe("-42");
  });

  test("compact with exactly one decimal from 1,000", () => {
    expect(formatCount(1_000, "en")).toBe("1.0K");
    expect(formatCount(7_912, "en")).toBe("7.9K");
    expect(formatCount(18_000, "en")).toBe("18.0K");
    expect(formatCount(1_000_000, "en")).toBe("1.0M");
    expect(formatCount(32_600_000_000, "en")).toBe("32.6B");
    expect(formatCount(-2_500, "en")).toBe("-2.5K");
  });

  test("follows the locale it is given", () => {
    expect(formatCount(18_000, "de")).toBe(
      new Intl.NumberFormat("de", {
        notation: "compact",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(18_000),
    );
    expect(formatCount(18_000, "de")).not.toBe(formatCount(18_000, "en"));
  });
});

describe("formatInitials", () => {
  test("first letters of the first two words", () => {
    expect(formatInitials("Ada Lovelace")).toBe("AL");
    expect(formatInitials("ada byron lovelace")).toBe("AB");
    expect(formatInitials("Cher")).toBe("C");
  });

  test("an email address uses its local part", () => {
    expect(formatInitials("jane.doe@example.com")).toBe("JD");
    expect(formatInitials("ops@example.com")).toBe("O");
  });

  test("skips punctuation and keeps non-Latin letters", () => {
    expect(formatInitials("  (Grace)  Hopper ")).toBe("GH");
    expect(formatInitials("Élodie Ñúñez")).toBe("ÉÑ");
    expect(formatInitials("李 小龙")).toBe("李小");
  });

  test("falls back to the first character, then to a question mark", () => {
    expect(formatInitials("@@")).toBe("@");
    expect(formatInitials("   ")).toBe("?");
  });
});
