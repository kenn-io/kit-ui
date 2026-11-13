import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// The own-Calendar example in the DatePhraseInput docs is the gallery's
// OwnCalendarDateField.svelte, which svelte-check and a browser test cover.
// Keep the two identical so the documented code is the code that runs.
test("the documented own-Calendar example is the demo file", () => {
  const root = new URL("..", import.meta.url).pathname;
  const doc = readFileSync(`${root}docs/components/date-phrase-input.md`, "utf8");
  const section = doc.slice(doc.indexOf("## Using the field with your own Calendar"));
  const block = /```svelte\n([\s\S]*?)```/.exec(section)?.[1];
  const demo = readFileSync(`${root}src/demo/pages/OwnCalendarDateField.svelte`, "utf8");
  const squash = (s: string) => s.replace(/\s+/g, " ").trim();
  expect(block).toBeDefined();
  expect(squash(block!)).toBe(squash(demo.replace('"../../lib/index.js"', '"@kenn-io/kit-ui"')));
});
