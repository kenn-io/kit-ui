import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gotoPage, setTheme } from "./helpers.js";

// Temporary CI-only bridge. Remove after the declarations and captures are reviewed.
const source = "148d6fc0dd41b0ea3301f38fbd04e419f2baf5a8";
const upstreamBase = "b2ac6ae3910659b9c75476737034f8c305c3a714";
const expected: Record<string, string> = {
  "src/lib/components/Calendar.svelte": "762beca06cc557c4e71b4be46e8f78f1b07c5e55e9190be30d27d9179fc8f5e0",
  "src/lib/components/date-range.ts": "af5770dbb4d3ed035edd16dbf527cc007ccd668a9cbed61e525995484cba503b",
  "scripts/declarations.mjs": "cd3f7ae39da877357cd189dbf0251307103d047331126494b50b39d67c787c82",
  "tsconfig.json": "498701fb4db8276d5f1b57f4444f7e563f2ecc986254d8812daf9acc4fdfad10",
  "bun.lock": "c0af5198f0e1841524dcddc2f6bc399407d4b24318bc614f40aa375586fe306a",
  "svelte.config.js": "27b75e5640bb04cbbbdd131c7d7d0b27189d69080430f35d0ee9daad9ce99930",
  "vite.config.ts": "5998a6e42f2b6c781bcaf68263f90feb677c71b3c50c9c697fb97e4957316f00",
};
const allowed = ["types/components/Calendar.svelte.d.ts", "types/components/date-range.d.ts"];
const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const fileHash = (file: string) => existsSync(file) ? sha(readFileSync(file)) : null;
const run = (cwd: string, command: string, args: string[]) =>
  execFileSync(command, args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const status = (cwd: string) => run(cwd, "git", ["status", "--porcelain=v1", "--untracked-files=all"]);
const hashes = (root: string, files: string[]) => Object.fromEntries(files.map((f) => [f, fileHash(path.join(root, f))]));

// This test runs once, so its receipt and patch belong to the same actual checkout.
test.describe.configure({ retries: 0 });
test.use({ deviceScaleFactor: 2 });
test("calendar strip proof and isolated declaration patch", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const root = process.cwd();
  const receiptPath = testInfo.outputPath("receipt.json");
  const patchPath = testInfo.outputPath("types.patch");
  const receipt: Record<string, any> = { status: "FAILURE", declaredSource: source, declaredUpstreamBase: upstreamBase, allowed, screenshots: [], errors: [] };
  let scratch = "";
  let added = false;
  let failure: unknown;
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, "utf8"));
    const pr = event.pull_request;
    receipt.event = { name: process.env.GITHUB_EVENT_NAME, repository: event.repository?.full_name, baseRepository: pr?.base?.repo?.full_name, headRepository: pr?.head?.repo?.full_name, baseRef: pr?.base?.ref, headRef: pr?.head?.ref, base: pr?.base?.sha, head: pr?.head?.sha, merge: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT };
    expect(receipt.event.name).toBe("pull_request");
    expect([receipt.event.repository, receipt.event.baseRepository, receipt.event.headRepository]).toEqual(["kenn-io/kit-ui", "kenn-io/kit-ui", "salmonumbrella/kit-ui"]);
    expect(receipt.event.baseRef).toBe("main");
    expect(receipt.event.headRef).toBe("feat/calendar-activity");
    expect(receipt.event.base).toBe(upstreamBase);
    expect(receipt.event.head).toMatch(/^[0-9a-f]{40}$/);
    for (const pin of [source, receipt.event.head]) {
      try { run(root, "git", ["cat-file", "-e", `${pin}^{commit}`]); }
      catch { run(root, "git", ["fetch", "--no-tags", "--depth=1", "origin", pin]); }
    }
    const parents = (pin: string) => run(root, "git", ["cat-file", "-p", pin]).split("\n").filter((line) => line.startsWith("parent ")).map((line) => line.slice(7));
    receipt.attestation = {
      sourceTree: run(root, "git", ["rev-parse", `${source}^{tree}`]).trim(),
      proofTree: run(root, "git", ["rev-parse", `${receipt.event.head}^{tree}`]).trim(),
      proofParents: parents(receipt.event.head), mergeParents: parents("HEAD"),
      proofPaths: run(root, "git", ["diff", "--name-status", source, receipt.event.head]),
      proofDiff: run(root, "git", ["diff", "--binary", "--full-index", source, receipt.event.head]),
      mergeDrift: run(root, "git", ["diff", "--binary", "--full-index", source, "HEAD"]),
    };
    receipt.attestation.proofDiffSha256 = sha(receipt.attestation.proofDiff);
    receipt.attestation.mergeDriftSha256 = sha(receipt.attestation.mergeDrift);
    expect(receipt.attestation.proofParents).toEqual([source]);
    expect(receipt.attestation.proofPaths).toBe("M\ttests/browser/calendar-proof.spec.ts\n");
    expect(receipt.attestation.mergeParents).toEqual([upstreamBase, receipt.event.head]);
    receipt.checkout = { head: run(root, "git", ["rev-parse", "HEAD"]).trim(), tree: run(root, "git", ["rev-parse", "HEAD^{tree}"]).trim(), sourceTree: run(root, "git", ["rev-parse", "HEAD:src/lib"]).trim(), sourceFiles: run(root, "git", ["ls-tree", "-r", "HEAD", "src/lib"]), packageHash: fileHash(path.join(root, "package.json")), statusBefore: status(root), specHash: fileHash(path.join(root, "tests/browser/calendar-proof.spec.ts")), retryIndex: testInfo.retry };
    expect(receipt.checkout.head).toBe(receipt.event.merge);
    expect(receipt.checkout.statusBefore).toBe("");
    expect(receipt.checkout.specHash).toBe(sha(run(root, "git", ["show", `${receipt.event.head}:tests/browser/calendar-proof.spec.ts`])));
    expect(testInfo.retry).toBe(0);
    receipt.inputsBefore = hashes(root, Object.keys(expected));
    expect(receipt.inputsBefore).toEqual(expected);
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const packageInputs = Object.fromEntries(["type", "packageManager", "dependencies", "devDependencies", "peerDependencies", "peerDependenciesMeta", "overrides"].map((key) => [key, pkg[key] ?? null]));
    packageInputs["generate:types"] = pkg.scripts["generate:types"];
    receipt.packageInputs = packageInputs;
    expect(sha(JSON.stringify(packageInputs))).toBe("c49fb2fccd99389b8a17f497d38b9482c2fcb36a9c1bc8b1764e0bd427e454a5");
    receipt.closure = {
      local: "Calendar imports date-range and two lucide icons; date-range has no imports. declarations.mjs invokes svelte2tsx and TypeScript; tsconfig extends @tsconfig/svelte and includes vite/client and vite.config.ts; svelte.config.js and vite.config.ts are gated as configuration inputs. bun.lock and package dependency fields pin their transitive package graph. The generator emits all src/lib and checks/rules; their tree and all changed outputs are recorded, but unrelated source is not an input equality gate.",
      installed: ["svelte2tsx/svelte-shims-v4.d.ts", "@tsconfig/svelte/tsconfig.json", "@lucide/svelte/package.json", "@lucide/svelte/dist/icons/chevron-left.svelte.d.ts", "@lucide/svelte/dist/icons/chevron-right.svelte.d.ts", "@lucide/svelte/dist/types.d.ts", "svelte/package.json", "svelte2tsx/package.json", "typescript/package.json", "vite/package.json", "vite/client.d.ts", "@sveltejs/vite-plugin-svelte/package.json", "vite-plus/package.json", "@types/node/package.json"],
    };
    receipt.installed = hashes(path.join(root, "node_modules"), receipt.closure.installed);
    expect(Object.values(receipt.installed).every(Boolean)).toBe(true);
    receipt.versions = Object.fromEntries(["@lucide/svelte", "@tsconfig/svelte", "svelte", "svelte2tsx", "typescript", "vite", "@sveltejs/vite-plugin-svelte", "vite-plus", "@types/node"].map((name) => [name, JSON.parse(readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8")).version]));
    expect(receipt.versions["@lucide/svelte"]).toBe("1.62.0");
    expect(receipt.versions["@tsconfig/svelte"]).toBe("5.0.8");
    expect(receipt.versions.svelte).toBe("5.57.3");
    expect(receipt.versions.svelte2tsx).toBe("0.7.62");
    expect(receipt.versions.typescript).toBe("6.0.3");
    receipt.runtime = { bun: run(root, "bun", ["--version"]).trim(), node: process.version, dependencyRoot: realpathSync(path.join(root, "node_modules")), generator: pkg.scripts["generate:types"] };
    expect(receipt.runtime.bun).toBe("1.4.4");

    for (const width of [1280, 400]) {
      await page.setViewportSize({ width, height: 800 });
      await gotoPage(page, "calendar");
      await page.getByRole("radiogroup", { name: "Strip filter" }).getByRole("radio", { name: "Every 3rd day" }).click();
      const cal = page.getByTestId("calendar-strip").locator(".kit-calendar");
      await expect(cal.locator(".kit-calendar__day.outlined")).toHaveCount(1);
      await expect(cal.locator(".kit-calendar__match")).toHaveCount(10);
      for (const dark of [false, true]) {
        await setTheme(page, { dark });
        await cal.scrollIntoViewIfNeeded();
        const crop = await cal.boundingBox();
        expect(crop).not.toBeNull();
        const measurements = await cal.evaluate((el) => {
          const rect = (s: string) => {
            const e = el.querySelector(s)!;
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          };
          const track = el.querySelector(".kit-calendar__strip")!;
          const cells = track.querySelectorAll(".kit-calendar__day");
          const a = cells[0]!.getBoundingClientRect(), b = cells[1]!.getBoundingClientRect();
          return { header: rect(".kit-calendar__header"), track: rect(".kit-calendar__strip"), selected: rect(".kit-calendar__day.outlined"), weekday: rect(".kit-calendar__day-weekday"), number: rect(".kit-calendar__day-number"), mark: rect(".kit-calendar__match"), cellGap: b.left - a.right, trackScrollLeft: track.scrollLeft, trackScrollWidth: track.scrollWidth, trackClientWidth: track.clientWidth, rootGap: getComputedStyle(el).gap };
        });
        const name = `strip-${width}-${dark ? "dark" : "light"}.png`;
        const file = testInfo.outputPath(name);
        await cal.screenshot({ path: file, animations: "disabled" });
        receipt.screenshots.push({ name, sha256: fileHash(file), viewport: { width, height: 800 }, deviceScaleFactor: 2, crop, measurements, sources: ["src/demo/pages/CalendarDemo.svelte", "src/lib/components/Calendar.svelte", "src/lib/theme.css"] });
      }
    }

    scratch = mkdtempSync(path.join(tmpdir(), "calendar210-proof-"));
    const worktree = path.join(scratch, "checkout");
    run(root, "git", ["worktree", "add", "--detach", worktree, source]);
    added = true;
    receipt.sourceWorktree = { head: run(worktree, "git", ["rev-parse", "HEAD"]).trim(), tree: run(worktree, "git", ["rev-parse", "HEAD^{tree}"]).trim(), statusBeforeDependencies: status(worktree), inputsBefore: hashes(worktree, Object.keys(expected)), packageHash: fileHash(path.join(worktree, "package.json")) };
    expect(receipt.sourceWorktree.head).toBe(source);
    expect(receipt.sourceWorktree.tree).toBe(receipt.attestation.sourceTree);
    expect(receipt.sourceWorktree.statusBeforeDependencies).toBe("");
    expect(receipt.sourceWorktree.inputsBefore).toEqual(expected);
    mkdirSync(path.join(worktree, "node_modules"));
    for (const entry of readdirSync(path.join(root, "node_modules"))) {
      symlinkSync(path.join(root, "node_modules", entry), path.join(worktree, "node_modules", entry));
    }
    receipt.generatedBefore = hashes(worktree, allowed);
    receipt.worktreeBefore = status(worktree);
    expect(receipt.worktreeBefore).toBe("");
    try { receipt.generation = { command: "bun run generate:types", output: run(worktree, "bun", ["run", "generate:types"]) }; }
    catch (error) { receipt.generation = { command: "bun run generate:types", error: String(error), stdout: String((error as any).stdout ?? ""), stderr: String((error as any).stderr ?? "") }; throw error; }
    receipt.generatedAfter = hashes(worktree, allowed);
    receipt.worktreeAfter = status(worktree);
    receipt.inputsAfter = hashes(worktree, Object.keys(expected));
    receipt.installedAfter = hashes(path.join(root, "node_modules"), receipt.closure.installed);
    receipt.sourceWorktree.packageHashAfter = fileHash(path.join(worktree, "package.json"));
    const changed = receipt.worktreeAfter.split("\n").filter(Boolean).map((line: string) => line.slice(3));
    const patch = execFileSync("git", ["diff", "--binary", "--full-index", "--", "types"], { cwd: worktree, maxBuffer: 32 * 1024 * 1024 });
    writeFileSync(patchPath, patch);
    receipt.patch = { path: "types.patch", sha256: sha(patch), bytes: patch.length, changed };
    expect(receipt.inputsAfter).toEqual(expected);
    expect(receipt.sourceWorktree.packageHashAfter).toBe(receipt.sourceWorktree.packageHash);
    expect(receipt.installedAfter).toEqual(receipt.installed);
    expect(changed.every((file: string) => allowed.includes(file))).toBe(true);
    expect(changed.sort()).toEqual([...allowed].sort());
  } catch (error) {
    failure = error;
    receipt.errors.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
  } finally {
    try {
      if (scratch && added) {
        const worktree = path.join(scratch, "checkout");
        receipt.inputsAfter ??= hashes(worktree, Object.keys(expected));
        if (receipt.closure) receipt.installedAfter ??= hashes(path.join(root, "node_modules"), receipt.closure.installed);
        if (receipt.sourceWorktree) receipt.sourceWorktree.packageHashAfter ??= fileHash(path.join(worktree, "package.json"));
        receipt.generatedAfter ??= hashes(worktree, allowed);
        receipt.worktreeAfter ??= status(worktree);
        if (!existsSync(patchPath)) {
          const patch = execFileSync("git", ["diff", "--binary", "--full-index", "--", "types"], { cwd: worktree, maxBuffer: 32 * 1024 * 1024 });
          writeFileSync(patchPath, patch);
          receipt.patch = { path: "types.patch", sha256: sha(patch), bytes: patch.length };
        }
      }
    } catch (error) { receipt.errors.push(`failure evidence: ${String(error)}`); failure ??= error; }
    try {
      if (scratch) {
        const worktree = path.join(scratch, "checkout");
        if (added) {
          rmSync(path.join(worktree, "node_modules"), { recursive: true, force: true });
          run(root, "git", ["worktree", "remove", "--force", worktree]);
        }
        rmSync(scratch, { recursive: true, force: true });
      }
      receipt.cleanup = { scratchRemoved: !scratch || !existsSync(scratch), worktreeRemoved: !added || !existsSync(path.join(scratch, "checkout")), registered: scratch ? run(root, "git", ["worktree", "list", "--porcelain"]).includes(path.join(scratch, "checkout")) : false };
      if (!receipt.cleanup.scratchRemoved || !receipt.cleanup.worktreeRemoved || receipt.cleanup.registered) throw new Error("cleanup incomplete");
    } catch (error) {
      receipt.cleanup = { error: String(error), scratch };
      receipt.errors.push(`cleanup: ${String(error)}`);
      failure ??= error;
    }
    try {
      receipt.checkoutStatusAfter = status(root);
      receipt.checkoutInputsAfter = hashes(root, Object.keys(expected));
      receipt.checkoutPackageHashAfter = fileHash(path.join(root, "package.json"));
      if (receipt.checkout && (receipt.checkoutStatusAfter !== receipt.checkout.statusBefore || receipt.checkoutPackageHashAfter !== receipt.checkout.packageHash || JSON.stringify(receipt.checkoutInputsAfter) !== JSON.stringify(receipt.inputsBefore))) throw new Error("source checkout changed");
    } catch (error) { receipt.errors.push(`checkout: ${String(error)}`); failure ??= error; }
    receipt.status = failure ? "FAILURE" : "SUCCESS";
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  }
  if (failure) throw failure;
});
