import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "day-lane");
});

const lane = (page: import("@playwright/test").Page) => page.getByTestId("day-lane-busy");
const lastEvent = (page: import("@playwright/test").Page) => page.getByTestId("day-lane-event");

test("overlapping items sit side by side and the rest go to +N more", async ({ page }) => {
  const standup = lane(page).getByRole("button", { name: /Shipment status standup/ });
  const call = lane(page).getByRole("button", { name: /Call: Jory and Dev/ });
  const more = lane(page).getByRole("button", { name: /\+3 more from 9:30 AM/ });
  const [a, b, c] = await Promise.all([standup, call, more].map((l) => l.boundingBox()));
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
  expect(b!.x + b!.width).toBeLessThanOrEqual(c!.x);
  await more.click();
  await expect(lastEvent(page)).toHaveText("overflow 3 from 9:30 AM");
});

test("the selected card is the tab stop and arrows move in time order", async ({ page }) => {
  const standup = lane(page).getByRole("button", { name: /Shipment status standup/ });
  await expect(standup).toHaveAttribute("aria-pressed", "true");
  await expect(standup).toHaveAttribute("tabindex", "0");
  await standup.focus();
  await page.keyboard.press("ArrowDown");
  await expect(lane(page).getByRole("button", { name: /Call: Jory and Dev/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(lastEvent(page)).toHaveText("select call");
  await page.keyboard.press("Home");
  await expect(lane(page).getByRole("button", { name: /Signed delivery receipt/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(lane(page).getByRole("button", { name: /9:30 PM$/ })).toBeFocused();
});

test("a card's accessible name ends with its time range", async ({ page }) => {
  await expect(lane(page).getByRole("button", { name: /Container BRKU/ })).toHaveAccessibleName(
    /, 8:30 AM – 8:52 AM$/,
  );
});

test("a quiet stretch folds and opens again", async ({ page }) => {
  const fold = lane(page).getByRole("button", { name: /11:00 AM – 2:00 PM · 3 quiet hours/ });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.click();
  await expect(lastEvent(page)).toHaveText("open 11:00 AM – 2:00 PM");
  const refold = lane(page).getByRole("button", { name: "Fold 3 quiet hours" });
  await expect(refold).toHaveAttribute("aria-expanded", "true");
  await refold.click();
  await expect(fold).toBeVisible();
});

test("a 23-hour day labels its hours from the app's ticks", async ({ page }) => {
  await page.getByText("23 h (spring)").click();
  await page.getByRole("checkbox", { name: "Fold quiet hours" }).uncheck();
  const labels = (await lane(page).locator(".kit-day-lane__hour-label").allTextContents()).map(
    (s) => s.trim(),
  );
  expect(labels).toHaveLength(23);
  await page.getByRole("checkbox", { name: "Fold quiet hours" }).check();
  // The 1 AM to 7 AM band names its own start, so no "1 AM" label sits beside it.
  await expect(
    lane(page).locator(".kit-day-lane__hour-label", { hasText: /^\s*1 AM\s*$/ }),
  ).toHaveCount(0);
  expect(labels.slice(0, 3)).toEqual(["12 AM", "1 AM", "3 AM"]);
});

test("keyboard focus follows a fold as it opens and closes", async ({ page }) => {
  const fold = lane(page).getByRole("button", { name: /11:00 AM – 2:00 PM · 3 quiet hours/ });
  await fold.focus();
  await page.keyboard.press("Enter");
  await expect(lane(page).getByRole("button", { name: "Fold 3 quiet hours" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(fold).toBeFocused();
});
