// Generate and verify the committed type declarations in `types/`.
//
// kit-ui is consumed as source, but consumers that type-check with tsgo
// (`svelte-check --tsgo`) only transpile `.svelte` files inside their own
// workspace. Without declarations, every kit-ui component resolves to the
// ambient `*.svelte` shim and loses its props and `<script module>` exports.
// Git dependencies get no build step under Bun, so the declarations are
// committed and this script keeps them honest.
//
//   node scripts/declarations.mjs generate   rewrite types/
//   node scripts/declarations.mjs check      fail on missing, stale, or
//                                            untyped public entries
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emitDts } from "svelte2tsx";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB_DIR = "src/lib";
const TYPES_DIR = "types";
// Plain-JS public entries that live outside src/lib: source -> declaration.
const JS_ENTRIES = { "checks/rules.mjs": "types/check/rules.d.mts" };
const CODE_TARGET = /\.(ts|mts|js|mjs|svelte)$/;

async function emit(outDir) {
  await rm(outDir, { recursive: true, force: true });
  await emitDts({
    libRoot: path.join(ROOT, LIB_DIR),
    declarationDir: outDir,
    svelteShimsPath: require.resolve("svelte2tsx/svelte-shims-v4.d.ts"),
    tsconfig: path.join(ROOT, "tsconfig.json"),
  });
  for (const [source, declaration] of Object.entries(JS_ENTRIES)) {
    const program = ts.createProgram([path.join(ROOT, source)], {
      allowJs: true,
      declaration: true,
      emitDeclarationOnly: true,
      declarationDir: path.join(outDir, path.dirname(path.relative(TYPES_DIR, declaration))),
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      skipLibCheck: true,
    });
    const result = program.emit();
    if (result.emitSkipped) {
      throw new Error(`failed to emit declarations for ${source}`);
    }
  }
}

async function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

// src/lib/components/Button.svelte -> types/components/Button.svelte.d.ts
// src/lib/stores/flash.svelte.ts  -> types/stores/flash.svelte.d.ts
function declarationFor(source) {
  const jsEntry = JS_ENTRIES[source];
  if (jsEntry) return jsEntry;
  if (!source.startsWith(`${LIB_DIR}/`)) return null;
  const rel = source.slice(LIB_DIR.length + 1);
  if (rel.endsWith(".svelte")) return `${TYPES_DIR}/${rel}.d.ts`;
  if (rel.endsWith(".ts") && !rel.endsWith(".d.ts")) {
    return `${TYPES_DIR}/${rel.replace(/\.ts$/, ".d.ts")}`;
  }
  return null;
}

async function checkCoverage(problems) {
  const sources = (await listFiles(path.join(ROOT, LIB_DIR))).map((f) => `${LIB_DIR}/${f}`);
  for (const source of [...sources, ...Object.keys(JS_ENTRIES)]) {
    const declaration = declarationFor(source);
    if (declaration && !existsSync(path.join(ROOT, declaration))) {
      problems.push(`${source} has no declaration (expected ${declaration})`);
    }
  }
}

async function checkExports(problems) {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  const rootTypes = pkg.exports?.["."]?.types;
  if (pkg.types !== rootTypes) {
    problems.push(`package.json "types" must match exports["."].types (${rootTypes})`);
  }
  if (!pkg.files?.includes(TYPES_DIR)) {
    problems.push(`package.json "files" must include "${TYPES_DIR}"`);
  }
  for (const [subpath, value] of Object.entries(pkg.exports ?? {})) {
    const conditions = typeof value === "string" ? { default: value } : value;
    const target = conditions.default ?? conditions.svelte;
    if (typeof target !== "string" || !CODE_TARGET.test(target)) continue;
    const expected = declarationFor(target.replace(/^\.\//, ""));
    const keys = Object.keys(conditions);
    if (keys[0] !== "types") {
      problems.push(`exports["${subpath}"] must list a "types" condition first`);
      continue;
    }
    if (conditions.types !== `./${expected}`) {
      problems.push(`exports["${subpath}"].types should be "./${expected}"`);
    }
  }
}

async function checkFresh(problems) {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "kit-ui-types-"));
  try {
    const fresh = path.join(scratch, TYPES_DIR);
    await emit(fresh);
    const expected = await listFiles(fresh);
    const committed = new Set(await listFiles(path.join(ROOT, TYPES_DIR)));
    for (const file of expected) {
      if (!committed.has(file)) {
        problems.push(`${TYPES_DIR}/${file} is missing`);
        continue;
      }
      committed.delete(file);
      const [want, have] = await Promise.all([
        readFile(path.join(fresh, file), "utf8"),
        readFile(path.join(ROOT, TYPES_DIR, file), "utf8"),
      ]);
      if (want !== have) problems.push(`${TYPES_DIR}/${file} is stale`);
    }
    for (const file of committed) {
      problems.push(`${TYPES_DIR}/${file} has no source`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

const command = process.argv[2];
if (command === "generate") {
  await emit(path.join(ROOT, TYPES_DIR));
} else if (command === "check") {
  const problems = [];
  await checkCoverage(problems);
  await checkExports(problems);
  await checkFresh(problems);
  if (problems.length > 0) {
    console.error(problems.map((p) => `declarations: ${p}`).join("\n"));
    console.error("Run `bun run generate:types` and commit types/.");
    process.exit(1);
  }
} else {
  console.error("usage: node scripts/declarations.mjs <generate|check>");
  process.exit(2);
}
