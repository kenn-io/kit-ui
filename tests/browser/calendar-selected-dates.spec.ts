import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Calendar's selectedDates, driven through the DatePhraseInput demo, whose
// bare Calendar shows a typed set with it. Pin "today" to Monday
// 2026-06-15 at noon so the set never depends on the real date.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 5, 15, 12, 0, 0));
  await gotoPage(page, "date-phrase-input");
});

test("selectedDates marks separate days, each on its own with no band", async ({ page }) => {
  const host = page.getByTestId("date-phrase-host");
  await host.getByRole("textbox").pressSequentially("Fridays in June");
  const calendar = host.locator(".kit-calendar");
  await expect(calendar.locator(".kit-calendar__month")).toHaveText(/June 2026/);
  const selected = calendar.locator(".kit-calendar__day.selected");
  await expect(selected).toHaveText(["5", "12", "19", "26"]);
  // Every selected day is a whole pill: no band cells between them.
  await expect(calendar.locator(".kit-calendar__day.selected:not(.range-start)")).toHaveCount(0);
  await expect(calendar.locator(".kit-calendar__day.selected:not(.range-end)")).toHaveCount(0);
  for (const day of await selected.all()) {
    await expect(day).toHaveAttribute("aria-pressed", "true");
  }
  await expect(
    calendar.locator('.kit-calendar__day:not(.selected)[aria-pressed="true"]'),
  ).toHaveCount(0);

  // A range still draws as a band.
  await host.getByRole("textbox").fill("Jun 1 to Jun 3");
  await expect(selected).toHaveCount(3);
  await expect(calendar.locator(".kit-calendar__day.selected:not(.range-start)")).toHaveCount(2);
});

test("the documented single-date composition around a bare Calendar works", async ({ page }) => {
  const host = page.getByTestId("own-calendar-host");
  await host.getByRole("button", { name: "Pick a date" }).click();
  const input = host.getByRole("textbox");
  await expect(input).toBeFocused();
  await input.pressSequentially("Jul 4");
  await expect(host.locator(".kit-date-phrase-input__summary")).toHaveText("Jul 4, 2026");
  await expect(host.locator(".kit-calendar__month")).toHaveText(/July 2026/);
  await expect(host.locator(".kit-calendar__day.selected")).toHaveText("4");
  await expect(host.getByTestId("own-calendar-value")).toHaveText("picked: none");
  // A range isn't a date here: Enter does nothing.
  await input.fill("next week");
  await input.press("Enter");
  await expect(host.getByTestId("own-calendar-value")).toHaveText("picked: none");
  await input.fill("tomorrow");
  await input.press("Enter");
  await expect(host.getByTestId("own-calendar-value")).toHaveText("picked: 2026-06-16");
  await expect(host.getByRole("button", { name: "Jun 16, 2026" })).toBeVisible();
});
