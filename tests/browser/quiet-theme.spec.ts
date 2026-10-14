import { expect, test, type Locator, type Page } from "@playwright/test";
import { contrastOf, gotoPage, resolvedStyle, setTheme, useTheme } from "./helpers.js";

// The quiet theme drops uppercase label styling through the
// --label-transform token; the default Workbench pair must keep it.

/** The computed background as rounded 0–255 sRGB channels, whether the
 * browser serializes it as rgb() or as color(srgb …) from color-mix(). */
async function backgroundChannels(locator: Locator): Promise<number[]> {
  const color = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgb) return srgb.slice(1, 4).map((channel) => Math.round(Number(channel) * 255));
  const rgb = color.match(/rgba?\(([^)]+)\)/);
  if (!rgb) throw new Error(`unsupported color: ${color}`);
  return rgb[1]!
    .split(",")
    .slice(0, 3)
    .map((channel) => Math.round(Number(channel)));
}

async function labelStyle(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { transform: style.textTransform, spacing: style.letterSpacing };
    });
}

test("default theme keeps uppercase chip and eyebrow labels", async ({ page }) => {
  await gotoPage(page, "chip");
  await useTheme(page, null);
  expect((await labelStyle(page, ".kit-chip:not(.kit-chip--plain-case)")).transform).toBe(
    "uppercase",
  );

  await gotoPage(page, "card");
  await useTheme(page, null);
  expect((await labelStyle(page, ".kit-card__eyebrow")).transform).toBe("uppercase");
});

test("quiet theme renders chip and eyebrow labels in sentence case", async ({ page }) => {
  await gotoPage(page, "chip");
  await useTheme(page, "quiet");
  expect(await labelStyle(page, ".kit-chip:not(.kit-chip--plain-case)")).toEqual({
    transform: "none",
    spacing: "normal",
  });

  await gotoPage(page, "card");
  await useTheme(page, "quiet");
  expect(await labelStyle(page, ".kit-card__eyebrow")).toEqual({
    transform: "none",
    spacing: "normal",
  });
});

for (const dark of [false, true]) {
  test(`quiet muted text clears AA on every surface (${dark ? "dark" : "light"})`, async ({
    page,
  }) => {
    await gotoPage(page, "chip");
    await useTheme(page, "quiet");
    await setTheme(page, { dark });
    for (const surface of ["--bg-inset", "--bg-primary", "--bg-surface", "--bg-surface-hover"]) {
      const probe = await page.evaluate((background) => {
        document.querySelector("[data-quiet-muted-probe]")?.remove();
        const host = document.createElement("div");
        host.dataset.quietMutedProbe = "";
        host.style.background = `var(${background})`;
        host.style.position = "fixed";
        host.style.inset = "0 auto auto 0";
        const text = document.createElement("span");
        text.textContent = "Muted";
        text.style.color = "var(--text-muted)";
        host.append(text);
        document.body.append(host);
        return "[data-quiet-muted-probe] span";
      }, surface);
      expect(await contrastOf(page.locator(probe)), surface).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("default theme keeps GitHub-style solid label fills", async ({ page }) => {
  await gotoPage(page, "color-label");
  await useTheme(page, null);
  const bug = page.locator(".kit-color-label", { hasText: /^bug$/ }).first();
  expect(await backgroundChannels(bug)).toEqual([215, 58, 74]);
});

for (const dark of [false, true]) {
  test(`quiet tinted labels keep AA text across label colors (${dark ? "dark" : "light"})`, async ({
    page,
  }) => {
    await gotoPage(page, "color-label");
    await useTheme(page, "quiet");
    await setTheme(page, { dark });
    const labels = page.locator(".kit-color-label");
    const count = await labels.count();
    expect(count).toBeGreaterThan(8);
    for (let i = 0; i < count; i++) {
      const label = labels.nth(i);
      const name = (await label.textContent()) ?? "";
      expect(await contrastOf(label), name).toBeGreaterThanOrEqual(4.5);
    }
    const bug = page.locator(".kit-color-label", { hasText: /^bug$/ }).first();
    expect(await backgroundChannels(bug)).not.toEqual([215, 58, 74]);
  });
}

/** WCAG relative luminance of a background token under the current theme. */
async function surfaceLuminance(page: Page, token: string): Promise<number> {
  const color = await resolvedStyle(page, "background-color", `var(${token})`);
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number);
  const linear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

for (const dark of [false, true]) {
  test(`quiet layers inset below page below surface (${dark ? "dark" : "light"})`, async ({
    page,
  }) => {
    await gotoPage(page, "chip");
    await useTheme(page, "quiet");
    await setTheme(page, { dark });
    const inset = await surfaceLuminance(page, "--bg-inset");
    const primary = await surfaceLuminance(page, "--bg-primary");
    const surface = await surfaceLuminance(page, "--bg-surface");
    expect(inset).toBeLessThan(primary);
    expect(primary).toBeLessThan(surface);
  });
}
