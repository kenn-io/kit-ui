import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Pin "today" mid-month at noon so the 30-days-back default lands in the
// previous month in every runner timezone.
const now = new Date(2026, 5, 15, 12, 0, 0);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(now);
  await gotoPage(page, "date-picker");
});

test("opens on the chosen date's month and commits a picked day", async ({ page }) => {
  const trigger = page.getByRole("button", { name: /^Start date: / });
  await expect(trigger).toHaveText("May 16, 2026");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Select date" });
  await expect(dialog).toContainText("May 2026");
  await expect(dialog.locator(".kit-calendar__day.selected")).toHaveText("16");

  await dialog.locator(".kit-calendar__day:not(.outside)").filter({ hasText: /^20$/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("date-picker-value")).toHaveText("2026-05-20");
  await expect(trigger).toBeFocused();
});

test("Escape dismisses without changing the date", async ({ page }) => {
  const trigger = page.getByRole("button", { name: /^Start date: / });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Select date" })).toBeHidden();
  await expect(page.getByTestId("date-picker-value")).toHaveText(/^2026-05-16$/);
});

test("an empty picker shows its placeholder and opens on today's month", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Date", exact: true });
  await expect(trigger).toHaveText("Pick a day");
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Select date" })).toContainText("June 2026");
});

test("maxDate disables later days", async ({ page }) => {
  await page.getByRole("button", { name: "Last day" }).click();
  const dialog = page.getByRole("dialog", { name: "Select date" });
  await expect(
    dialog.locator(".kit-calendar__day:not(.outside)").filter({ hasText: /^16$/ }),
  ).toBeDisabled();
});
