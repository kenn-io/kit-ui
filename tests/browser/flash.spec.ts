import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Flash stack behavior: the store caps concurrent flashes at 5 (oldest
// trimmed) and each banner dismisses individually.

test("stack caps at 5 concurrent flashes and dismisses individually", async ({ page }) => {
  await gotoPage(page, "flash-banner");
  const showThree = page.getByRole("button", { name: "Show three flashes" });
  const banners = page.locator(".kit-flash-banner");

  await showThree.click();
  await expect(banners).toHaveCount(3);

  await showThree.click();
  // 6 shown in total — the cap trims to 5.
  await expect
    .poll(async () => banners.count())
    .toBeLessThanOrEqual(5);
  const afterCap = await banners.count();
  expect(afterCap).toBeGreaterThanOrEqual(4); // "Copied" (4s) may lapse mid-check

  const before = await banners.count();
  await page.locator(".kit-flash-banner__dismiss").first().click();
  await expect(banners).toHaveCount(before - 1);
});
