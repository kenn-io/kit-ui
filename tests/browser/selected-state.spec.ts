import { expect, test, type Locator } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

// One selected idiom across choice groups: the raised pill drawn from the
// --selected-strong-* tokens in theme.css, in light and dark.

async function expectSelectedPill(locator: Locator): Promise<void> {
  // Resolve the tokens beside the element: a popover retunes them.
  const style = await locator.evaluate((el) => {
    // Finish the theme-switch transition before reading the settled style.
    for (const animation of el.getAnimations()) animation.finish();
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--selected-strong-bg)";
    probe.style.boxShadow = "var(--selected-strong-edge)";
    el.parentElement!.append(probe);
    const want = getComputedStyle(probe);
    const s = getComputedStyle(el);
    const out = {
      bg: s.backgroundColor,
      shadow: s.boxShadow,
      opacity: s.opacity,
      wantBg: want.backgroundColor,
      wantShadow: want.boxShadow,
    };
    probe.remove();
    return out;
  });
  expect(style.bg).toBe(style.wantBg);
  expect(style.shadow).toBe(style.wantShadow);
  expect(style.opacity).toBe("1");
}

for (const dark of [false, true]) {
  const mode = dark ? "dark" : "light";

  test(`segmented control uses the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "segmented-control");
    await setTheme(page, { dark, highContrast: false });
    await expectSelectedPill(
      page
        .locator(".kit-segmented:not(.kit-segmented--borderless) .kit-segmented__btn.active")
        .first(),
    );
    // A read-only control keeps its chosen option at full strength.
    await expectSelectedPill(
      page.getByTestId("segmented-readonly").locator(".kit-segmented__btn.active"),
    );
  });

  test(`date range presets use the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "date-range-picker");
    await setTheme(page, { dark, highContrast: false });
    await page.locator(".kit-date-range-picker__trigger").first().click();
    const pill = page.locator(".kit-date-range-picker__pill.active");
    await expect(pill).toBeVisible();
    await expectSelectedPill(pill);
    // Unselected presets sit flat on the shared inset track.
    const flat = page.locator(".kit-date-range-picker__pill:not(.active)").first();
    expect(await flat.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgba(0, 0, 0, 0)",
    );
  });

  test(`top bar current tab uses the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "top-bar");
    await setTheme(page, { dark, highContrast: false });
    await expectSelectedPill(page.locator('.kit-top-bar__tab[aria-current="page"]').first());
  });
}
