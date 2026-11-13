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
  expect(c!.height).toBe(44);
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
  await expect(lane(page).getByRole("button", { name: /Late note/ })).toBeFocused();
});

test("a point in the last minute renders at full height on 24-hour and 23-hour days", async ({
  page,
}) => {
  const late = lane(page).getByRole("button", { name: /Late note/ });
  expect((await late.boundingBox())!.height).toBe(44);
  await page.getByText("23 h (spring)").click();
  expect((await late.boundingBox())!.height).toBe(44);
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

test("changing days closes folds even when returning to the original day", async ({ page }) => {
  const fold = lane(page).getByRole("button", { name: /11:00 AM – 2:00 PM · 3 quiet hours/ });
  await fold.click();
  await page.getByText("23 h (spring)").click();
  await page.getByText("24 h", { exact: true }).click();
  await expect(fold).toHaveAttribute("aria-expanded", "false");
});

test("tabbing back into the lane returns to the selected card", async ({ page }) => {
  const standup = lane(page).getByRole("button", { name: /Shipment status standup/ });
  const call = lane(page).getByRole("button", { name: /Call: Jory and Dev/ });
  await standup.focus();
  await page.keyboard.press("ArrowDown");
  await expect(call).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(standup).toBeFocused();
  await expect(standup).toHaveAttribute("tabindex", "0");
  await expect(call).toHaveAttribute("tabindex", "-1");
});

test("the now line stays inside a fold and moves to its hour when opened", async ({ page }) => {
  const fold = lane(page).getByRole("button", { name: /11:00 AM – 2:00 PM · 3 quiet hours/ });
  const now = lane(page).locator(".kit-day-lane__now");
  const [band, line] = await Promise.all([fold.boundingBox(), now.boundingBox()]);
  expect(line!.y).toBeGreaterThan(band!.y);
  expect(line!.y).toBeLessThan(band!.y + band!.height);
  expect(line!.x + line!.width).toBeCloseTo(band!.x + band!.width);
  const markerRight = await now.evaluate((element) => {
    const style = getComputedStyle(element, "::before");
    return (
      element.getBoundingClientRect().left +
      parseFloat(style.left) +
      new DOMMatrixReadOnly(style.transform).m41 +
      parseFloat(style.width)
    );
  });
  expect(markerRight).toBeLessThanOrEqual(band!.x);
  await fold.click();
  const refold = lane(page).getByRole("button", { name: "Fold 3 quiet hours" });
  const [button, openedLine] = await Promise.all([refold.boundingBox(), now.boundingBox()]);
  expect(openedLine!.y).toBeGreaterThan(button!.y + button!.height);
});
