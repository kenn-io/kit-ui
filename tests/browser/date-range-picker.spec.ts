import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// The Custom tab picks its from/to span with two clicks on the embedded
// Calendar (first click starts the range, an earlier second click swaps the
// ends) — no native date inputs.

const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "date-range-picker");
});

// The first demo picker, wired to the JSON readout below it.
function panel(page: import("@playwright/test").Page) {
  return page.locator(".kit-date-range-picker__panel");
}

async function openCustomTab(page: import("@playwright/test").Page) {
  await page.locator(".kit-date-range-picker__trigger").first().click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();
}

function day(page: import("@playwright/test").Page, n: number) {
  return panel(page)
    .locator(".kit-calendar__day:not(.outside)")
    .filter({ hasText: new RegExp(`^${n}$`) });
}

test("custom tab renders a calendar, not native date inputs", async ({ page }) => {
  await openCustomTab(page);
  await expect(panel(page).locator(".kit-calendar")).toBeVisible();
  await expect(panel(page).locator("input")).toHaveCount(0);
});

test("two clicks commit an ordered custom range; the readout tracks the pending endpoint", async ({
  page,
}) => {
  await openCustomTab(page);
  const endpoints = panel(page).locator(".kit-date-range-picker__endpoint");
  await expect(endpoints.nth(0)).toHaveClass(/active/);

  // First pick starts the range and arms the To endpoint.
  await day(page, 5).click();
  await expect(endpoints.nth(1)).toHaveClass(/active/);
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(1);

  // Second pick completes and commits.
  await day(page, 10).click();
  await expect(endpoints.nth(0)).toHaveClass(/active/);
  await expect(
    page.locator("code", { hasText: `"from":"${yyyy}-${mm}-05","to":"${yyyy}-${mm}-10"` }),
  ).toBeVisible();
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(6);
});

test("an earlier second pick swaps the ends", async ({ page }) => {
  await openCustomTab(page);
  await day(page, 10).click();
  await day(page, 5).click();
  await expect(
    page.locator("code", { hasText: `"from":"${yyyy}-${mm}-05","to":"${yyyy}-${mm}-10"` }),
  ).toBeVisible();
});
