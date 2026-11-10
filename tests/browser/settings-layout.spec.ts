import { expect, test } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme } from "./helpers";

test("the current settings category reads in primary ink, not the accent", async ({ page }) => {
  await gotoPage(page, "settings-layout");
  const current = page.locator('.kit-settings__nav-item[aria-current="true"]').first();
  await expect(current).toBeVisible();

  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    // The theme switch starts color transitions; read the settled styles.
    await page.evaluate(() => {
      for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish();
    });
    const primary = await resolvedStyle(page, "color", "var(--text-primary)");
    const accent = await resolvedStyle(page, "color", "var(--accent-blue)");
    await expect(current).toHaveCSS("color", primary);
    await current.hover();
    await expect(current).toHaveCSS("color", primary);
    expect(primary).not.toBe(accent);
  }
});
