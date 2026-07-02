import { expect, test } from "@playwright/test";
import { gotoPage, setSlider } from "./helpers.js";

// TopBar collapses its tab group into a SelectDropdown by measurement
// (with an expand latch so it doesn't oscillate). The demo hosts the bar
// in a slider-controlled container, so we sweep real widths.

test("tabs collapse into a dropdown when narrow and expand back when wide", async ({ page }) => {
  await gotoPage(page, "top-bar");

  const host = page.locator(".bar-host").first();
  const bar = host.locator(".kit-top-bar");
  const tabs = bar.locator(".kit-top-bar__tabs");
  // Scoped to the nav's collapse target — the demo bar also carries an
  // unrelated SelectDropdown (repo picker) in its right region.
  const dropdown = bar.locator(".kit-top-bar__nav-select");
  const slider = page.locator('input[type="range"]').first();

  // Wide: the full tab row fits.
  await expect(tabs).toBeVisible();
  await expect(dropdown).not.toBeVisible();

  // Sweep down in steps (the collapse is measured, not a breakpoint).
  for (const width of [800, 680, 560, 440, 360]) {
    await setSlider(slider, width);
  }
  await expect(dropdown).toBeVisible();
  await expect(tabs).not.toBeVisible();

  // Collapsed dropdown still switches tabs.
  await dropdown.locator(".kit-select-dropdown__trigger").click();
  await page.getByRole("option", { name: "Issues" }).click();
  await expect(dropdown).toContainText("Issues");

  // Sweep back up — the latch releases once the full row fits again.
  for (const width of [440, 560, 680, 800, 920]) {
    await setSlider(slider, width);
  }
  await expect(tabs).toBeVisible();
  await expect(dropdown).not.toBeVisible();
  // The selection made while collapsed is preserved.
  await expect(
    tabs.locator(".kit-top-bar__tab.active"),
  ).toHaveText("Issues");
});
