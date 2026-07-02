import { expect, test } from "@playwright/test";
import { contrastOf, gotoPage, setTheme } from "./helpers.js";

// WCAG AA contrast for the tone system, computed from real rendered
// colors (alpha-composited over the actual page background) — the tone
// audit only a browser can verify. Chip/button labels are small text,
// so the target is 4.5:1.
//
// KNOWN_FAILURES is the measured baseline at the time this suite landed
// (kata 7mxs) — real findings, tracked for remediation in kata y1v0.
// The suite fails on any NEW failing combination or any known one
// degrading further; fixing a tone should remove its entry here.

const MODES = [
  { name: "light", dark: false, highContrast: false },
  { name: "dark", dark: true, highContrast: false },
  { name: "light-hc", dark: false, highContrast: true },
  { name: "dark-hc", dark: true, highContrast: true },
] as const;

/** Stable identity for a tone combination: tone/surface modifier classes
 * without size modifiers or the svelte scoping hash. */
function keyOf(className: string): string {
  return (className.match(/kit-(?:chip|button)--[a-z-]+/g) ?? [])
    .filter((c) => !/--(?:xs|sm|md|lg)$/.test(c))
    .sort()
    .join(".");
}

// Worst measured ratio per failing tone combination per mode.
// Lifecycle: entries are ADDED only from capture output
// (CAPTURE_CONTRAST=1 bunx playwright test contrast — review the printed
// JSON before committing) and must be REMOVED when a tone reaches AA —
// the suite fails on stale entries so a fixed tone can't silently
// regress behind an old baseline.
const KNOWN_FAILURES: Record<string, Record<string, number>> = {
  light: {
    "kit-chip--tone-muted": 2.8,
    "kit-chip--tone-success": 3.14,
    "kit-chip--tone-warning": 2.71,
    "kit-chip--tone-danger": 3.82,
    "kit-chip--tone-info": 4.19,
    "kit-chip--tone-canceled": 2.83,
    "kit-chip--tone-workspace": 3.08,
    "kit-chip--interactive.kit-chip--tone-info": 4.19,
    "kit-button--soft.kit-button--success": 3.26,
    "kit-button--outline.kit-button--success": 3.77,
    "kit-button--info.kit-button--soft": 4.5,
    "kit-button--danger.kit-button--soft": 4.14,
  },
  "light-hc": {
    "kit-chip--tone-success": 3.14,
    "kit-chip--tone-warning": 2.71,
    "kit-chip--tone-danger": 3.82,
    "kit-chip--tone-workspace": 3.08,
    "kit-button--soft.kit-button--success": 3.26,
    "kit-button--outline.kit-button--success": 3.77,
    "kit-button--danger.kit-button--soft": 4.14,
  },
  dark: {},
  "dark-hc": {},
};

async function collectFailures(
  page: import("@playwright/test").Page,
  selector: string,
): Promise<{ failures: Map<string, number>; seen: Set<string> }> {
  const elements = page.locator(selector);
  const count = await elements.count();
  expect(count).toBeGreaterThan(0);
  const failures = new Map<string, number>();
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const el = elements.nth(i);
    if (await el.isDisabled().catch(() => false)) continue; // disabled is AA-exempt
    const key = keyOf((await el.getAttribute("class")) ?? "");
    if (!key) continue;
    seen.add(key);
    const ratio = await contrastOf(el);
    if (ratio < 4.5) {
      const existing = failures.get(key);
      if (existing === undefined || ratio < existing) failures.set(key, ratio);
    }
  }
  return { failures, seen };
}

// Ratios move slightly with rendering differences (font smoothing,
// compositing rounding); a drop beyond this is a real regression.
const DEGRADE_TOLERANCE = 0.15;

for (const mode of MODES) {
  test(`tone contrast in ${mode.name}: no new or degraded AA failures`, async ({ page }) => {
    const baseline = KNOWN_FAILURES[mode.name] ?? {};
    const all = new Map<string, number>();
    const seen = new Set<string>();

    await gotoPage(page, "chip");
    await setTheme(page, mode);
    const chips = await collectFailures(page, ".kit-chip");
    for (const [k, v] of chips.failures) all.set(k, v);
    for (const k of chips.seen) seen.add(k);

    await gotoPage(page, "button");
    await setTheme(page, mode);
    const buttons = await collectFailures(page, ".kit-button");
    for (const [k, v] of buttons.failures) all.set(k, v);
    for (const k of buttons.seen) seen.add(k);

    if (process.env.CAPTURE_CONTRAST) {
      // Baseline regeneration: CAPTURE_CONTRAST=1 bunx playwright test contrast
      console.log(
        `CONTRAST-BASELINE ${mode.name} ${JSON.stringify(
          Object.fromEntries([...all.entries()].map(([k, r]) => [k, Number(r.toFixed(2))])),
        )}`,
      );
      return;
    }

    const fresh = [...all.entries()].filter(([key]) => !(key in baseline));
    expect(
      fresh.map(([k, r]) => `${k}: ${r.toFixed(2)}`),
      "new AA contrast failures (not in the known baseline)",
    ).toEqual([]);

    // Known failures must not get worse than their measured baseline.
    const degraded = [...all.entries()].filter(
      ([key, r]) => key in baseline && r < baseline[key]! - DEGRADE_TOLERANCE,
    );
    expect(
      degraded.map(([k, r]) => `${k}: ${r.toFixed(2)} (baseline ${baseline[k]})`),
      "known failures degraded beyond tolerance",
    ).toEqual([]);

    // A baseline combination that is no longer rendered at all is lost
    // COVERAGE, not a fix — deleting its entry would hide a still-broken
    // tone. Restore the demo variant (or retire the entry deliberately).
    const unrendered = Object.keys(baseline).filter((key) => !seen.has(key));
    expect(
      unrendered,
      "baseline combinations no longer rendered by the demo — coverage lost, not fixed",
    ).toEqual([]);

    // A baseline entry that renders but no longer fails is stale: the
    // tone reached AA and the entry must go, or a later drop back below
    // 4.5 would hide behind the old baseline.
    const stale = Object.keys(baseline).filter((key) => seen.has(key) && !all.has(key));
    expect(
      stale,
      "stale KNOWN_FAILURES entries — these tones now pass AA; remove them",
    ).toEqual([]);
  });
}
