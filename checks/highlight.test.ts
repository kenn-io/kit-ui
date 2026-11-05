import { expect, test } from "bun:test";
import { highlightSegments } from "../src/lib/utils/highlight.js";

test("lowercase expansion keeps matches aligned with original characters", () => {
  expect(highlightSegments("İstanbul theme", "theme")).toEqual([
    { text: "İstanbul ", match: false },
    { text: "theme", match: true },
  ]);
  expect(highlightSegments("İstanbul", "i")).toEqual([
    { text: "İ", match: true },
    { text: "stanbul", match: false },
  ]);
});

test("highlighting follows lowercase substring filtering", () => {
  expect(highlightSegments("ΟΣ", "οσ")).toEqual([{ text: "ΟΣ", match: false }]);
  expect(highlightSegments("[preview] a.b", "[PREVIEW]")).toEqual([
    { text: "[preview]", match: true },
    { text: " a.b", match: false },
  ]);
  expect(highlightSegments("[preview] a.b", "a.b")).toEqual([
    { text: "[preview] ", match: false },
    { text: "a.b", match: true },
  ]);
  expect(highlightSegments("Theme", "")).toEqual([{ text: "Theme", match: false }]);
  expect(highlightSegments("Theme", "missing")).toEqual([{ text: "Theme", match: false }]);
});
