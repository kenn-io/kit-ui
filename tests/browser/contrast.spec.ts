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

const KNOWN_FAILURES: Record<string, string[]> = {
  light: [
    "kit-chip--tone-canceled",
    "kit-chip--tone-danger",
    "kit-chip--tone-info",
    "kit-chip--tone-info.kit-chip--interactive",
    "kit-chip--tone-muted",
    "kit-chip--tone-muted.kit-chip--interactive",
    "kit-chip--tone-success",
    "kit-chip--tone-warning",
    "kit-chip--tone-workspace",
    "kit-button--info.kit-button--solid",
    "kit-button--info.kit-button--soft",
    "kit-button--success.kit-button--solid",
    "kit-button--success.kit-button--soft",
    "kit-button--success.kit-button--outline",
    "kit-button--danger.kit-button--solid",
    "kit-button--danger.kit-button--soft",
    "kit-button--danger.kit-button--outline",
    "kit-button--neutral.kit-button--outline",
    "kit-button--workflow.kit-button--soft",
  ],
  dark: [
    "kit-button--info.kit-button--solid",
    "kit-button--success.kit-button--solid",
    "kit-button--danger.kit-button--solid",
    "kit-button--neutral.kit-button--outline",
  ],
  "light-hc": [
    "kit-chip--tone-canceled",
    "kit-chip--tone-danger",
    "kit-chip--tone-info",
    "kit-chip--tone-info.kit-chip--interactive",
    "kit-chip--tone-muted",
    "kit-chip--tone-muted.kit-chip--interactive",
    "kit-chip--tone-success",
    "kit-chip--tone-warning",
    "kit-chip--tone-workspace",
    "kit-button--info.kit-button--solid",
    "kit-button--info.kit-button--soft",
    "kit-button--success.kit-button--solid",
    "kit-button--success.kit-button--soft",
    "kit-button--success.kit-button--outline",
    "kit-button--danger.kit-button--solid",
    "kit-button--danger.kit-button--soft",
    "kit-button--danger.kit-button--outline",
    "kit-button--neutral.kit-button--outline",
    "kit-button--workflow.kit-button--soft",
  ],
  "dark-hc": [
    "kit-button--info.kit-button--solid",
    "kit-button--success.kit-button--solid",
    "kit-button--danger.kit-button--solid",
    "kit-button--neutral.kit-button--outline",
  ],
};

async function collectFailures(
  page: import("@playwright/test").Page,
  selector: string,
): Promise<Map<string, number>> {
  const elements = page.locator(selector);
  const count = await elements.count();
  expect(count).toBeGreaterThan(0);
  const failures = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const el = elements.nth(i);
    if (await el.isDisabled().catch(() => false)) continue; // disabled is AA-exempt
    const key = keyOf((await el.getAttribute("class")) ?? "");
    if (!key) continue;
    const ratio = await contrastOf(el);
    if (ratio < 4.5) {
      const existing = failures.get(key);
      if (existing === undefined || ratio < existing) failures.set(key, ratio);
    }
  }
  return failures;
}

for (const mode of MODES) {
  test(`tone contrast in ${mode.name}: no new AA failures`, async ({ page }) => {
    const known = new Set(
      (KNOWN_FAILURES[mode.name] ?? []).map((k) => k.split(".").sort().join(".")),
    );
    const all = new Map<string, number>();

    await gotoPage(page, "chip");
    await setTheme(page, mode);
    for (const [k, v] of await collectFailures(page, ".kit-chip")) all.set(k, v);

    await gotoPage(page, "button");
    await setTheme(page, mode);
    for (const [k, v] of await collectFailures(page, ".kit-button")) all.set(k, v);

    const fresh = [...all.entries()].filter(([key]) => !known.has(key));
    expect(
      fresh.map(([k, r]) => `${k}: ${r.toFixed(2)}`),
      "new AA contrast failures (not in the known baseline)",
    ).toEqual([]);

    // Known failures must not degrade below the UI-component minimum.
    const degraded = [...all.entries()].filter(([key, r]) => known.has(key) && r < 1.5);
    expect(
      degraded.map(([k, r]) => `${k}: ${r.toFixed(2)}`),
      "known failures degraded below 1.5:1",
    ).toEqual([]);
  });
}
