import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme } from "./helpers.js";

// One selected idiom across choice groups: the raised pill drawn from the
// --selected-strong-* tokens in theme.css, in light and dark.

async function expectSelectedPill(page: Page, locator: Locator): Promise<void> {
  const bg = await resolvedStyle(page, "background-color", "var(--selected-strong-bg)");
  const shadow = await resolvedStyle(page, "box-shadow", "var(--selected-strong-edge)");
  // Finish the theme-switch transition before reading the settled style.
  const style = await locator.evaluate((el) => {
    for (const animation of el.getAnimations()) animation.finish();
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, shadow: s.boxShadow, opacity: s.opacity };
  });
  expect(style.bg).toBe(bg);
  expect(style.shadow).toBe(shadow);
  expect(style.opacity).toBe("1");
}

for (const dark of [false, true]) {
  const mode = dark ? "dark" : "light";

  test(`segmented control uses the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "segmented-control");
    await setTheme(page, { dark, highContrast: false });
    await expectSelectedPill(
      page,
      page
        .locator(".kit-segmented:not(.kit-segmented--borderless) .kit-segmented__btn.active")
        .first(),
    );
    // A read-only control keeps its chosen option at full strength.
    await expectSelectedPill(
      page,
      page.getByTestId("segmented-readonly").locator(".kit-segmented__btn.active"),
    );
  });

  test(`date range presets use the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "date-range-picker");
    await setTheme(page, { dark, highContrast: false });
    await page.locator(".kit-date-range-picker__trigger").first().click();
    const pill = page.locator(".kit-date-range-picker__pill.active");
    await expect(pill).toBeVisible();
    await expectSelectedPill(page, pill);
    // Unselected presets sit flat on the shared inset track.
    const flat = page.locator(".kit-date-range-picker__pill:not(.active)").first();
    expect(await flat.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgba(0, 0, 0, 0)",
    );
  });

  test(`top bar current tab uses the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "top-bar");
    await setTheme(page, { dark, highContrast: false });
    await expectSelectedPill(page, page.locator('.kit-top-bar__tab[aria-current="page"]').first());
  });
}
