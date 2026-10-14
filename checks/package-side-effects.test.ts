import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Bundlers match `sideEffects` entries by path and ignore an entry that matches nothing, so a
// moved or renamed file turns its entry into a silent no-op and the build still succeeds.
const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8")) as {
  sideEffects: string[];
};

describe("package.json sideEffects", () => {
  test("every file entry names a file that exists", () => {
    const files = pkg.sideEffects.filter((entry) => !/[*?[\]{}!]/.test(entry));

    expect(files.filter((entry) => !existsSync(new URL(entry, root)))).toEqual([]);
  });
});
