import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// npm prepares a git dependency that has `workspaces` or any of these scripts by running
// `npm install --force` in a fresh clone. That install ignores bun.lock and the consumer's
// lockfile, so every consumer install would fetch kit-ui's dev toolchain at unpinned versions.
const npmGitPrepareScripts = [
  "build",
  "prepare",
  "prepack",
  "preinstall",
  "install",
  "postinstall",
];

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  scripts?: Record<string, string>;
  workspaces?: unknown;
};

describe("package.json git-dependency install", () => {
  test("defines no script that makes npm prepare the git dependency", () => {
    const scripts = Object.keys(pkg.scripts ?? {});

    expect(scripts.filter((name) => npmGitPrepareScripts.includes(name))).toEqual([]);
  });

  test("declares no workspaces", () => {
    expect(pkg.workspaces).toBeUndefined();
  });
});
