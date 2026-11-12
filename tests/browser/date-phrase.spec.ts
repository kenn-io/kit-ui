import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Typed date entry in DatePicker and DateRangePicker. Pin "today" to
// Monday 2026-06-15 at noon (local date identical in every runner
// timezone), so every phrase below resolves the same way on any real date.
// The week of the pinned day runs Mon Jun 15 – Sun Jun 21.
const now = new Date(2026, 5, 15, 12, 0, 0);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(now);
});

function phrase(page: Page) {
  return page.locator(".kit-date-phrase-input");
}

function field(page: Page) {
  return phrase(page).getByRole("textbox");
}

function ghost(page: Page) {
  return phrase(page).locator(".kit-date-phrase-input__ghost-rest");
}

function summary(page: Page) {
  return phrase(page).locator(".kit-date-phrase-input__summary");
}

test.describe("DateRangePicker", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "date-range-picker");
  });

  const demo = (page: Page) => page.getByTestId("typed-range-picker");
  const panel = (page: Page) => page.locator(".kit-date-range-picker__panel");
  const readout = (page: Page) => page.getByTestId("typed-range-selection");

  async function open(page: Page) {
    await demo(page).locator(".kit-date-range-picker__trigger").click();
    await expect(field(page)).toBeFocused();
  }

  test("opens with the text field focused and an empty-state hint", async ({ page }) => {
    await open(page);
    await expect(field(page)).toHaveAttribute("placeholder", "What dates are you looking for?");
    await expect(summary(page)).toHaveText("Type or select dates.");
    await expect(summary(page)).toHaveAttribute("aria-live", "polite");
    await expect(phrase(page).getByRole("button", { name: "Clear" })).toHaveCount(0);
  });

  test("typing previews the range without committing; Enter commits it", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("May 10 to May 20");

    await expect(summary(page)).toHaveText("May 10 – 20, 2026 · 11 days");
    await expect(panel(page).getByRole("radio", { name: "Custom" })).toBeChecked();
    await expect(panel(page).locator(".kit-calendar__month")).toHaveText(/May 2026/);
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(11);
    await expect(panel(page).locator(".kit-date-range-picker__endpoint-value")).toHaveText([
      "2026-05-10",
      "2026-05-20",
    ]);
    // Nothing committed yet.
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');

    await field(page).press("Enter");
    await expect(readout(page)).toHaveText(
      '{"mode":"custom","from":"2026-05-10","to":"2026-05-20"}',
    );
    await expect(page.getByTestId("typed-range-bounds")).toHaveText("2026-05-10 → 2026-05-20");
  });

  test("a single date is a one-day range", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("yesterday");
    await expect(summary(page)).toHaveText("Jun 14, 2026 · 1 day");
    await field(page).press("Enter");
    await expect(readout(page)).toHaveText(
      '{"mode":"custom","from":"2026-06-14","to":"2026-06-14"}',
    );
  });

  test("ghost text completes the word and Tab accepts it", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("last 2 w");
    await expect(ghost(page)).toHaveText("eeks");
    // Incomplete: nothing previews yet.
    await expect(summary(page)).toHaveText("Type or select dates.");

    await field(page).press("Tab");
    await expect(field(page)).toHaveValue("last 2 weeks");
    await expect(field(page)).toBeFocused();
    await expect(ghost(page)).toHaveCount(0);
    await expect(summary(page)).toHaveText("Jun 2 – 15, 2026 · 14 days");

    await field(page).press("Enter");
    await expect(readout(page)).toHaveText(
      '{"mode":"custom","from":"2026-06-02","to":"2026-06-15"}',
    );
  });

  test("→ at the end accepts the ghost text; Tab without one moves focus", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("since Ma");
    await expect(ghost(page)).toHaveText("rch");
    await field(page).press("ArrowRight");
    await expect(field(page)).toHaveValue("since March");
    await expect(summary(page)).toHaveText("Mar 1 – Jun 15, 2026 · 107 days");

    await field(page).press("Tab");
    await expect(field(page)).not.toBeFocused();
    await expect(field(page)).toHaveValue("since March");
  });

  test("the clear button empties the field and the preview", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("last month");
    await expect(summary(page)).toHaveText("May 1 – 31, 2026 · 31 days");
    await expect(panel(page).locator(".kit-calendar__month")).toHaveText(/May 2026/);
    await phrase(page).getByRole("button", { name: "Clear" }).click();
    await expect(field(page)).toHaveValue("");
    await expect(field(page)).toBeFocused();
    await expect(summary(page)).toHaveText("Type or select dates.");
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');
    // The calendar returns to the draft's month.
    await expect(panel(page).locator(".kit-calendar__month")).toHaveText(/June 2026/);
  });

  test("Enter on text that isn't a range shows a hint and changes nothing", async ({ page }) => {
    await open(page);
    // A set of days is out of scope: no match, never a wrong range.
    await field(page).pressSequentially("last 3 Fridays");
    await field(page).press("Enter");
    await expect(summary(page)).toHaveText(
      "No dates match that. Try “last 30 days” or “Sep 10 to Oct 20”.",
    );
    await expect(panel(page)).toBeVisible();
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');

    // Editing clears the hint.
    await field(page).press("Backspace");
    await expect(summary(page)).toHaveText("Type or select dates.");
  });

  test("clicking days still picks a range after a typed preview", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("May 10 to May 20");
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(11);

    const day = (n: number) =>
      panel(page)
        .locator(".kit-calendar__day:not(.outside)")
        .filter({ hasText: new RegExp(`^${n}$`) });
    await day(3).click();
    await expect(field(page)).toHaveValue("");
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(1);
    await day(8).click();
    await expect(readout(page)).toHaveText(
      '{"mode":"custom","from":"2026-05-03","to":"2026-05-08"}',
    );
  });

  test("Escape closes the popover without committing", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("last month");
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');
  });

  test("textEntry={false} leaves the field out", async ({ page }) => {
    await page
      .getByTestId("no-text-entry-picker")
      .locator(".kit-date-range-picker__trigger")
      .click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator("input")).toHaveCount(0);
  });
});

test.describe("DatePicker", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "date-picker");
  });

  const trigger = (page: Page) => page.getByRole("button", { name: "Typed date" });
  const dialog = (page: Page) => page.getByRole("dialog", { name: "Select date" });
  const readout = (page: Page) => page.getByTestId("typed-date-value");

  async function open(page: Page) {
    await trigger(page).click();
    await expect(field(page)).toBeFocused();
  }

  test("opens with the text field focused and an empty-state hint", async ({ page }) => {
    await open(page);
    await expect(field(page)).toHaveAttribute("placeholder", "Type a date");
    await expect(summary(page)).toHaveText("Type or select a date.");
  });

  test("typing previews the date without committing; Enter picks it", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("Jul 4");
    await expect(summary(page)).toHaveText("Jul 4, 2026");
    await expect(dialog(page)).toContainText("July 2026");
    await expect(dialog(page).locator(".kit-calendar__day.selected")).toHaveText("4");
    await expect(readout(page)).toHaveText("null");

    await field(page).press("Enter");
    await expect(dialog(page)).toBeHidden();
    await expect(readout(page)).toHaveText("2026-07-04");
    await expect(trigger(page)).toBeFocused();
  });

  test("ghost text completes the word and Tab accepts it", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("next fr");
    await expect(ghost(page)).toHaveText("iday");
    await field(page).press("Tab");
    await expect(field(page)).toHaveValue("next friday");
    await expect(summary(page)).toHaveText("Jun 26, 2026");
    await field(page).press("Enter");
    await expect(readout(page)).toHaveText("2026-06-26");
  });

  test("the clear button empties the field", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("tomorrow");
    await expect(summary(page)).toHaveText("Jun 16, 2026");
    await phrase(page).getByRole("button", { name: "Clear" }).click();
    await expect(field(page)).toHaveValue("");
    await expect(summary(page)).toHaveText("Type or select a date.");
    await expect(dialog(page)).toBeVisible();
  });

  test("a range is no match in the single-date picker", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("next week");
    await field(page).press("Enter");
    await expect(summary(page)).toHaveText("No date matches that. Try “tomorrow” or “Sep 10”.");
    await expect(dialog(page)).toBeVisible();
    await expect(readout(page)).toHaveText("null");
  });

  test("clicking a day still picks it", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("tomorrow");
    await expect(dialog(page).locator(".kit-calendar__day.selected")).toHaveText("16");
    await dialog(page)
      .locator(".kit-calendar__day:not(.outside)")
      .filter({ hasText: /^20$/ })
      .click();
    await expect(dialog(page)).toBeHidden();
    await expect(readout(page)).toHaveText("2026-06-20");
  });

  test("textEntry={false} leaves the field out", async ({ page }) => {
    await page.getByRole("button", { name: "Calendar only" }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator("input")).toHaveCount(0);
  });
});
