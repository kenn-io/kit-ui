#!/usr/bin/env node
/**
 * kit-ui-check — scan a project that consumes @kenn-io/kit-ui for hand-rolled
 * component equivalents and design-token violations.
 *
 * Usage:
 *   kit-ui-check [paths…] [options]        (paths default to ./src)
 *
 * Options:
 *   --disable <rules>   comma-separated rule names to skip
 *   --rules <rules>     run only these comma-separated rules
 *   --warn              report findings but exit 0
 *   --json              machine-readable output
 *   --list-rules        print rule names and exit
 *
 * Suppress a single finding with a `kit-ui-check-ignore` comment on the same
 * line or the line above.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ALL_RULES, checkSource } from "../checks/rules.mjs";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".svelte-kit",
  "coverage",
  "test-results",
]);

function parseArgs(argv) {
  const opts = { paths: [], rules: Object.keys(ALL_RULES), warn: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--warn") {
      opts.warn = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--list-rules") {
      for (const name of Object.keys(ALL_RULES)) console.log(name);
      process.exit(0);
    } else if (arg === "--rules") {
      opts.rules = (argv[++i] ?? "").split(",").filter(Boolean);
    } else if (arg === "--disable") {
      const disabled = new Set((argv[++i] ?? "").split(","));
      opts.rules = opts.rules.filter((r) => !disabled.has(r));
    } else if (arg === "--help" || arg === "-h") {
      console.log("usage: kit-ui-check [paths…] [--rules a,b] [--disable a,b] [--warn] [--json]");
      process.exit(0);
    } else {
      opts.paths.push(arg);
    }
  }
  if (opts.paths.length === 0) opts.paths.push("src");
  return opts;
}

function* walk(path) {
  const stats = statSync(path);
  if (stats.isFile()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(path, entry.name));
    } else if (/\.(svelte|css)$/.test(entry.name)) {
      yield join(path, entry.name);
    }
  }
}

const opts = parseArgs(process.argv.slice(2));
const unknown = opts.rules.filter((r) => !(r in ALL_RULES));
if (unknown.length > 0) {
  console.error(`unknown rule(s): ${unknown.join(", ")} (see --list-rules)`);
  process.exit(2);
}

const results = [];
let scanned = 0;
for (const root of opts.paths) {
  for (const file of walk(root)) {
    scanned += 1;
    const source = readFileSync(file, "utf8");
    for (const finding of checkSource(source, file, opts.rules)) {
      results.push({ file: relative(process.cwd(), file), ...finding });
    }
  }
}

if (opts.json) {
  console.log(JSON.stringify({ scanned, findings: results }, null, 2));
} else {
  for (const f of results) {
    console.log(`${f.file}:${f.line}  [${f.rule}]  ${f.message}`);
  }
  console.log(
    `\nkit-ui-check: ${results.length} finding(s) in ${scanned} file(s)`,
  );
}

process.exit(results.length > 0 && !opts.warn ? 1 : 0);
