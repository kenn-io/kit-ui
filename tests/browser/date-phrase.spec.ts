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

function liveRegion(page: Page) {
  return phrase(page).locator('[aria-live="polite"]');
}

/** A keydown the way an IME sends it while a composition is open. */
async function composingKey(page: Page, key: string) {
  await field(page).evaluate((input, k) => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, isComposing: true, bubbles: true, cancelable: true }),
    );
  }, key);
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
    // The hint is shown but never announced.
    await expect(liveRegion(page)).toHaveText("");
    await expect(field(page)).toHaveAttribute("maxlength", "200");
    await expect(phrase(page).getByRole("button", { name: "Clear" })).toHaveCount(0);
  });

  test("typing previews the range without committing; Enter commits it", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("May 10 to May 20");

    await expect(summary(page)).toHaveText("May 10 – 20, 2026 · 11 days");
    await expect(liveRegion(page)).toHaveText("May 10 – 20, 2026 · 11 days");
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
    // The text clears on commit, so a second Enter emits nothing.
    await expect(field(page)).toHaveValue("");
    await expect(summary(page)).toHaveText("Type or select dates.");
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(11);
  });

  test("the summary keeps describing a preview held through an incomplete edit", async ({
    page,
  }) => {
    await open(page);
    await field(page).pressSequentially("yesterday");
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveText("14");
    await field(page).press("Backspace");
    await field(page).press("Backspace");
    // "yesterd" doesn't parse: the grid holds Jun 14, and so does the line.
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveText("14");
    await expect(summary(page)).toHaveText("Jun 14, 2026 · 1 day");
    // Clearing the field clears both.
    await phrase(page).getByRole("button", { name: "Clear" }).click();
    await expect(summary(page)).toHaveText("Type or select dates.");
    // Back to the draft: the demo's "last 7 days", Jun 9 – 15.
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(7);
  });

  test("Enter while an IME composition is open does nothing", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("yesterday");
    await expect(summary(page)).toHaveText("Jun 14, 2026 · 1 day");
    await composingKey(page, "Enter");
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');
    await expect(field(page)).toHaveValue("yesterday");
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
    await expect(liveRegion(page)).toHaveText(
      "No dates match that. Try “last 30 days” or “Sep 10 to Oct 20”.",
    );
    await expect(field(page)).toHaveAttribute("aria-invalid", "true");
    await expect(panel(page)).toBeVisible();
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');

    // Editing clears the hint.
    await field(page).press("Backspace");
    await expect(summary(page)).toHaveText("Type or select dates.");
    await expect(field(page)).not.toHaveAttribute("aria-invalid", "true");
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

  test("a click after typing starts a fresh pick, even with a click pending", async ({ page }) => {
    await open(page);
    await panel(page).getByRole("radio", { name: "Custom" }).click();
    const day = (n: number) =>
      panel(page)
        .locator(".kit-calendar__day:not(.outside)")
        .filter({ hasText: new RegExp(`^${n}$`) });
    await day(3).click(); // Jun 3, pending
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(1);

    await field(page).pressSequentially("May 10 to May 20");
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(11);
    await day(25).click(); // May 25 starts a new pick instead of completing Jun 3
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');
    await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveText("25");
    await day(28).click();
    await expect(readout(page)).toHaveText(
      '{"mode":"custom","from":"2026-05-25","to":"2026-05-28"}',
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

test.describe("DateRangePicker typed windows and presets", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "date-range-picker");
  });

  const panel = (page: Page) => page.locator(".kit-date-range-picker__panel");

  test("a typed window matching a preset commits that preset, as its pill does", async ({
    page,
  }) => {
    const demo = page.getByTestId("typed-range-picker");
    await demo.locator(".kit-date-range-picker__trigger").click();
    await field(page).pressSequentially("past 30 days");
    await expect(summary(page)).toHaveText("Last 30 days · May 17 – Jun 15, 2026 · 30 days");
    // The preview lights the matching pill on the Relative tab.
    await expect(panel(page).getByRole("radio", { name: "Relative" })).toBeChecked();
    await expect(panel(page).getByRole("button", { name: "30d" })).toHaveClass(/active/);
    await expect(panel(page).getByRole("button", { name: "7d" })).not.toHaveClass(/active/);
    await field(page).press("Enter");
    await expect(page.getByTestId("typed-range-selection")).toHaveText(
      '{"mode":"relative","days":30}',
    );
    await expect(demo.locator(".kit-date-range-picker__trigger")).toHaveText("Last 30 days");
    await expect(panel(page).getByRole("button", { name: "30d" })).toHaveClass(/active/);
  });

  test("a window no preset offers commits a custom range", async ({ page }) => {
    await page.getByTestId("typed-range-picker").locator(".kit-date-range-picker__trigger").click();
    await field(page).pressSequentially("last 10 days");
    await expect(summary(page)).toHaveText("Jun 6 – 15, 2026 · 10 days");
    await field(page).press("Enter");
    await expect(page.getByTestId("typed-range-selection")).toHaveText(
      '{"mode":"custom","from":"2026-06-06","to":"2026-06-15"}',
    );
  });

  test("a localized preset label shows in the summary and trigger", async ({ page }) => {
    const demo = page.getByTestId("fr-presets-picker");
    await demo.locator(".kit-date-range-picker__trigger").click();
    await field(page).pressSequentially("last 2 weeks");
    await expect(summary(page)).toHaveText("Deux dernières semaines · Jun 2 – 15, 2026 · 14 days");
    await field(page).press("Enter");
    await expect(page.getByTestId("fr-presets-selection")).toHaveText(
      '{"mode":"relative","days":14}',
    );
    await expect(demo.locator(".kit-date-range-picker__trigger")).toHaveText(
      "Deux dernières semaines",
    );
  });

  test("with presets={[]} a typed window commits a custom range", async ({ page }) => {
    await page.getByTestId("no-presets-picker").locator(".kit-date-range-picker__trigger").click();
    await field(page).pressSequentially("last 30 days");
    await expect(summary(page)).toHaveText("May 17 – Jun 15, 2026 · 30 days");
    await field(page).press("Enter");
    await expect(page.getByTestId("no-presets-selection")).toHaveText(
      '{"mode":"custom","from":"2026-05-17","to":"2026-06-15"}',
    );
  });
});

test.describe("DateRangePicker with dateSets", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "date-range-picker");
  });

  const demo = (page: Page) => page.getByTestId("set-range-picker");
  const panel = (page: Page) => page.locator(".kit-date-range-picker__panel");
  const readout = (page: Page) => page.getByTestId("set-range-selection");
  const trigger = (page: Page) => demo(page).locator(".kit-date-range-picker__trigger");
  const selected = (page: Page) => panel(page).locator(".kit-calendar__day.selected");
  const fridays = {
    mode: "custom",
    from: "2026-05-29",
    to: "2026-06-12",
    dates: ["2026-05-29", "2026-06-05", "2026-06-12"],
    label: "Fridays",
  };

  test("a set previews as separate days, then Enter commits it", async ({ page }) => {
    await trigger(page).click();
    await field(page).pressSequentially("last 3 Fr");
    await expect(ghost(page)).toHaveText("idays");
    await field(page).press("Tab");
    await expect(summary(page)).toHaveText("Fridays · May 29 – Jun 12, 2026 · 3 days");
    await expect(panel(page).getByRole("radio", { name: "Custom" })).toBeChecked();
    await expect(panel(page).locator(".kit-calendar__month")).toHaveText(/May 2026/);
    // May's grid runs through Jun 7, so Jun 12 is off this page.
    await expect(selected(page)).toHaveText(["29", "5"]);
    // Separate pills, no band between them.
    await expect(panel(page).locator(".kit-calendar__day.selected:not(.range-start)")).toHaveCount(
      0,
    );
    await expect(readout(page)).toHaveText('{"mode":"relative","days":7}');

    await field(page).press("Enter");
    await expect(readout(page)).toHaveText(JSON.stringify(fridays));
    await expect(trigger(page)).toHaveText("Fridays · 3 days");
    await expect(selected(page)).toHaveText(["29", "5"]);
  });

  test("a set passed back in through selection shows again", async ({ page }) => {
    await page.getByRole("button", { name: "External: saved Fridays" }).click();
    await expect(trigger(page)).toHaveText("Fridays · 2 days");
    await trigger(page).click();
    await expect(panel(page).getByRole("radio", { name: "Custom" })).toBeChecked();
    await expect(panel(page).locator(".kit-calendar__month")).toHaveText(/June 2026/);
    await expect(selected(page)).toHaveText(["5", "12"]);
    await expect(panel(page).locator(".kit-date-range-picker__endpoint-value")).toHaveText([
      "2026-06-05",
      "2026-06-12",
    ]);
    // The other tabs still work from a set.
    await panel(page).getByRole("radio", { name: "Relative" }).click();
    await panel(page).getByRole("button", { name: "30d" }).click();
    await expect(readout(page)).toHaveText('{"mode":"relative","days":30}');
  });

  test("a set without usable bounds opens on its first day's month", async ({ page }) => {
    await page.getByRole("button", { name: "External: Fridays without bounds" }).click();
    await expect(trigger(page)).toHaveText("Fridays · 2 days");
    await trigger(page).click();
    await expect(panel(page).getByRole("radio", { name: "Custom" })).toBeChecked();
    await expect(panel(page).locator(".kit-calendar__month")).toHaveText(/March 2026/);
    await expect(selected(page)).toHaveText(["6", "13"]);
  });

  test("a click after a set starts a fresh two-click pick", async ({ page }) => {
    await page.getByRole("button", { name: "External: saved Fridays" }).click();
    await trigger(page).click();
    const day = (n: number) =>
      panel(page)
        .locator(".kit-calendar__day:not(.outside)")
        .filter({ hasText: new RegExp(`^${n}$`) });
    await day(8).click();
    await expect(selected(page)).toHaveText(["8"]);
    await expect(readout(page)).toHaveText(/"dates"/);
    await day(10).click();
    await expect(readout(page)).toHaveText(
      '{"mode":"custom","from":"2026-06-08","to":"2026-06-10"}',
    );
    await expect(trigger(page)).toHaveText("2026-06-08 - 2026-06-10");
  });

  test("without dateSets a set phrase is no match and gets no set completion", async ({ page }) => {
    await page.getByTestId("typed-range-picker").locator(".kit-date-range-picker__trigger").click();
    await field(page).pressSequentially("last 3 Fr");
    await expect(ghost(page)).toHaveCount(0);
    await field(page).pressSequentially("idays");
    await field(page).press("Enter");
    await expect(summary(page)).toHaveText(
      "No dates match that. Try “last 30 days” or “Sep 10 to Oct 20”.",
    );
    await expect(page.getByTestId("typed-range-selection")).toHaveText(
      '{"mode":"relative","days":7}',
    );
  });
});

test.describe("touch devices", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("opening a picker doesn't focus the field (no keyboard over the calendar)", async ({
    page,
  }) => {
    await gotoPage(page, "date-range-picker");
    await page.getByTestId("typed-range-picker").locator(".kit-date-range-picker__trigger").tap();
    await expect(page.locator(".kit-date-range-picker__panel")).toBeVisible();
    await expect(field(page)).toBeVisible();
    await expect(field(page)).not.toBeFocused();

    await gotoPage(page, "date-picker");
    await page.getByRole("button", { name: "Typed date" }).tap();
    await expect(page.getByRole("dialog", { name: "Select date" })).toBeVisible();
    await expect(field(page)).not.toBeFocused();
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

  test("the summary keeps describing a preview held through an incomplete edit", async ({
    page,
  }) => {
    await open(page);
    await field(page).pressSequentially("tomorrow");
    await expect(dialog(page).locator(".kit-calendar__day.selected")).toHaveText("16");
    await field(page).press("Backspace");
    await field(page).press("Backspace");
    await expect(dialog(page).locator(".kit-calendar__day.selected")).toHaveText("16");
    await expect(summary(page)).toHaveText("Jun 16, 2026");
    await phrase(page).getByRole("button", { name: "Clear" }).click();
    await expect(summary(page)).toHaveText("Type or select a date.");
    await expect(dialog(page).locator(".kit-calendar__day.selected")).toHaveCount(0);
  });

  test("keys that confirm an IME composition don't submit or take the ghost", async ({ page }) => {
    await open(page);
    await field(page).pressSequentially("next fr");
    await expect(ghost(page)).toHaveText("iday");
    await composingKey(page, "Tab");
    await composingKey(page, "ArrowRight");
    await expect(field(page)).toHaveValue("next fr");
    await field(page).pressSequentially("iday");
    await composingKey(page, "Enter");
    await expect(dialog(page)).toBeVisible();
    await expect(readout(page)).toHaveText("null");
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
