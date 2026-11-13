import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Calendar month/year drill-down (kata j9cr): the header label zooms out
// days → months → years; picking an entry drills back down. Assertions
// avoid locale-dependent label text — they drive cells by index and read
// the demo's month readout instead.

const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth(); // 0-based
const blockStart = thisYear - (thisYear % 12);

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "calendar");
});

// The drill-down demo section renders the second calendar on the page
// (after "Single date", before "Range highlight") with maxDate = today.
function drillCalendar(page: import("@playwright/test").Page) {
  return page.locator(".kit-calendar").nth(1);
}

test("header click zooms days → months → years; year click has nothing above it", async ({
  page,
}) => {
  const cal = drillCalendar(page);
  await expect(cal.locator(".kit-calendar__grid")).toBeVisible();

  await cal.locator(".kit-calendar__month--button").click();
  const units = cal.locator(".kit-calendar__unit");
  await expect(units).toHaveCount(12);
  // The anchored month carries the position marker.
  await expect(units.nth(thisMonth)).toHaveClass(/current/);

  await cal.locator(".kit-calendar__month--button").click();
  await expect(units).toHaveCount(12);
  await expect(cal.locator(".kit-calendar__unit", { hasText: String(thisYear) })).toHaveClass(
    /current/,
  );
  // Years view has no further zoom: the header is a static label again.
  await expect(cal.locator(".kit-calendar__month--button")).toHaveCount(0);
  await expect(cal.locator(".kit-calendar__month")).toContainText(
    `${blockStart}–${blockStart + 11}`,
  );
});

test("picking a year drills to its months, picking a month lands on its days", async ({ page }) => {
  const cal = drillCalendar(page);
  await cal.locator(".kit-calendar__month--button").click();
  await cal.locator(".kit-calendar__month--button").click();

  // A past year: everything in it is pickable despite maxDate = today.
  const pastYear = blockStart === thisYear ? thisYear - 12 : blockStart;
  if (pastYear < blockStart) {
    await cal.locator(".kit-calendar__nav").first().click();
  }
  await cal.locator(".kit-calendar__unit", { hasText: String(pastYear) }).click();

  const units = cal.locator(".kit-calendar__unit");
  await expect(units).toHaveCount(12);
  // March of a past year → day view anchored to that month.
  await units.nth(2).click();
  await expect(cal.locator(".kit-calendar__grid")).toBeVisible();
  await expect(page.locator("code", { hasText: `${pastYear}-03` })).toBeVisible();
});

test("maxDate disables future months, future years, and paging past them", async ({ page }) => {
  const cal = drillCalendar(page);
  await cal.locator(".kit-calendar__month--button").click();

  const units = cal.locator(".kit-calendar__unit");
  await expect(units.nth(thisMonth)).toBeEnabled();
  if (thisMonth < 11) {
    await expect(units.nth(11)).toBeDisabled();
  }
  // Paging months view past maxDate's year is blocked.
  await expect(cal.locator(".kit-calendar__nav").nth(1)).toBeDisabled();

  await cal.locator(".kit-calendar__month--button").click();
  await expect(cal.locator(".kit-calendar__unit", { hasText: String(thisYear) })).toBeEnabled();
  if (thisYear < blockStart + 11) {
    await expect(
      cal.locator(".kit-calendar__unit", { hasText: String(thisYear + 1) }),
    ).toBeDisabled();
  }
  await expect(cal.locator(".kit-calendar__nav").nth(1)).toBeDisabled();
});

test("browsing zoomed grids never mutates the bound month", async ({ page }) => {
  const cal = drillCalendar(page);
  const readout = page.locator(".calendar-demo").nth(1).locator("code");
  const prefix = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`;
  await expect(readout).toHaveText(prefix);

  await cal.locator(".kit-calendar__month--button").click();
  await cal.locator(".kit-calendar__nav").first().click(); // previous year
  await expect(readout).toHaveText(prefix);

  await cal.locator(".kit-calendar__month--button").click();
  await cal.locator(".kit-calendar__nav").first().click(); // previous 12-year block
  await expect(readout).toHaveText(prefix);

  // Picking a year is still view-only — only a month pick commits.
  await cal.locator(".kit-calendar__unit").first().click();
  await expect(readout).toHaveText(prefix);
});

test("two-click day range completes, swaps reversed picks, and restarts", async ({ page }) => {
  // The day-range demo renders the fourth calendar on the page.
  const cal = page.locator(".kit-calendar").nth(3);
  const day = (n: number) =>
    cal.locator(".kit-calendar__day:not(.outside)").filter({ hasText: new RegExp(`^${n}$`) });
  const mm = String(thisMonth + 1).padStart(2, "0");

  // Reversed picks swap into an ordered range.
  await day(10).click();
  await day(5).click();
  await expect(
    page.locator("code", { hasText: `${thisYear}-${mm}-05 → ${thisYear}-${mm}-10` }),
  ).toBeVisible();
  await expect(cal.locator(".kit-calendar__day.selected")).toHaveCount(6);

  // A third pick starts a fresh range.
  await day(20).click();
  await expect(cal.locator(".kit-calendar__day.selected")).toHaveCount(1);
});

test("zooming out and back preserves the selected range highlight", async ({ page }) => {
  // The range-highlight demo calendar (third on the page) has a selected week.
  const cal = page.locator(".kit-calendar").nth(2);
  const selectedBefore = await cal.locator(".kit-calendar__day.selected").count();
  expect(selectedBefore).toBeGreaterThan(0);

  await cal.locator(".kit-calendar__month--button").click();
  await cal.locator(".kit-calendar__unit.current").click();
  await expect(cal.locator(".kit-calendar__day.selected")).toHaveCount(selectedBefore);
});

// Keyboard grid navigation (WAI-ARIA APG date picker grid). "Today" is
// pinned to Thursday 2026-01-15 at noon so the month and year boundaries
// below are the same in every runner timezone. Assertions read each day's
// `data-date` rather than its locale-dependent name.
test.describe("keyboard grid", () => {
  test.beforeEach(async ({ page }) => {
    // The file-level hook already loaded the page on the real clock; a
    // same-hash goto would not reload it.
    await page.clock.setFixedTime(new Date(2026, 0, 15, 12, 0, 0));
    await page.reload();
    await page.locator(".content__heading").waitFor();
  });

  // The day-range demo: no maxDate and no selection until a pick.
  function rangeCalendar(page: import("@playwright/test").Page) {
    return page.locator(".kit-calendar").nth(3);
  }

  async function expectFocusedDay(cal: import("@playwright/test").Locator, date: string) {
    const focused = cal.locator(".kit-calendar__day:focus");
    await expect(focused).toHaveAttribute("data-date", date);
    await expect(focused).toHaveAttribute("tabindex", "0");
  }

  test("the grid is one tab stop, on today when nothing is selected", async ({ page }) => {
    const cal = rangeCalendar(page);
    await expect(cal.locator('.kit-calendar__day[tabindex="0"]')).toHaveCount(1);
    await expect(cal.locator('.kit-calendar__day[tabindex="-1"]')).toHaveCount(41);

    await cal.locator(".kit-calendar__nav").last().focus();
    await page.keyboard.press("Tab");
    await expectFocusedDay(cal, "2026-01-15");
    await page.keyboard.press("Tab");
    await expect(cal.locator(".kit-calendar__day:focus")).toHaveCount(0);
    await page.keyboard.press("Shift+Tab");
    await expectFocusedDay(cal, "2026-01-15");
  });

  test("the tab stop starts on the selected day, else the month's first day", async ({ page }) => {
    // The range-highlight demo selects Mon 12 – Sun 18 January.
    const week = page.locator(".kit-calendar").nth(2);
    await expect(week.locator('.kit-calendar__day[tabindex="0"]')).toHaveAttribute(
      "data-date",
      "2026-01-12",
    );

    const cal = rangeCalendar(page);
    await cal.locator(".kit-calendar__nav").last().click();
    await expect(cal.locator('.kit-calendar__day[tabindex="0"]')).toHaveAttribute(
      "data-date",
      "2026-02-01",
    );
  });

  test("grid semantics: rows of gridcells with dates, selection, and today", async ({ page }) => {
    const cal = page.locator(".kit-calendar").first();
    const grid = cal.getByRole("grid", { name: "January 2026" });
    await expect(grid.getByRole("row")).toHaveCount(6);
    await expect(grid.getByRole("gridcell")).toHaveCount(42);
    const today = grid.getByRole("gridcell", { name: "Thursday, January 15, 2026" });
    await expect(today).toHaveAttribute("aria-current", "date");
    await expect(today).toHaveAttribute("aria-selected", "true");
    await expect(
      grid.getByRole("gridcell", { name: "Wednesday, January 14, 2026" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  test("arrows move by day and week, crossing into the next month", async ({ page }) => {
    const cal = rangeCalendar(page);
    await cal.locator('.kit-calendar__day[tabindex="0"]').focus();

    await page.keyboard.press("ArrowRight");
    await expectFocusedDay(cal, "2026-01-16");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expectFocusedDay(cal, "2026-01-14");
    await page.keyboard.press("ArrowUp");
    await expectFocusedDay(cal, "2026-01-07");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expectFocusedDay(cal, "2026-02-04");
    await expect(cal.getByRole("grid")).toHaveAccessibleName("February 2026");
    await expect(page.locator(".calendar-demo").nth(3).locator(".readout")).toHaveText(
      "pick a start date",
    );
  });

  test("Home and End go to the week's first and last day", async ({ page }) => {
    const cal = rangeCalendar(page);
    await cal.locator('.kit-calendar__day[tabindex="0"]').focus();
    await page.keyboard.press("Home");
    await expectFocusedDay(cal, "2026-01-12");
    await page.keyboard.press("End");
    await expectFocusedDay(cal, "2026-01-18");
  });

  test("PageUp/PageDown move a month, clamping the day; Shift moves a year", async ({ page }) => {
    const cal = rangeCalendar(page);
    await cal.locator('.kit-calendar__day[tabindex="0"]').focus();
    await page.keyboard.press("PageUp");
    await expectFocusedDay(cal, "2025-12-15");
    await expect(cal.getByRole("grid")).toHaveAccessibleName("December 2025");
    await page.keyboard.press("PageDown");
    await expectFocusedDay(cal, "2026-01-15");

    // Jan 15 → Jan 29 → Jan 31, then a month later is the last day of February.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expectFocusedDay(cal, "2026-01-31");
    await page.keyboard.press("PageDown");
    await expectFocusedDay(cal, "2026-02-28");

    await page.keyboard.press("Shift+PageUp");
    await expectFocusedDay(cal, "2025-02-28");
    await expect(cal.getByRole("grid")).toHaveAccessibleName("February 2025");
    await page.keyboard.press("Shift+PageDown");
    await page.keyboard.press("Shift+PageDown");
    await expectFocusedDay(cal, "2027-02-28");
  });

  test("Enter and Space pick the focused day, including across months", async ({ page }) => {
    const cal = rangeCalendar(page);
    const readout = page.locator(".calendar-demo").nth(3).locator(".readout");
    await cal.locator('.kit-calendar__day[tabindex="0"]').focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await expect(readout).toContainText("2026-01-14");

    await page.keyboard.press("PageDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await expect(readout).toHaveText("range: 2026-01-14 → 2026-02-15");
    await expect(cal.locator(".kit-calendar__day.selected").first()).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("days after maxDate are reachable but cannot be picked", async ({ page }) => {
    const cal = page.locator(".kit-calendar").first();
    const readout = page.locator(".calendar-demo").first().locator("code");
    await expect(readout).toHaveText("2026-01-15");

    await cal.locator('.kit-calendar__day[tabindex="0"]').focus();
    await expectFocusedDay(cal, "2026-01-15");
    await page.keyboard.press("ArrowRight");
    await expectFocusedDay(cal, "2026-01-16");
    await expect(cal.locator(".kit-calendar__day:focus")).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    // force: Playwright waits on aria-disabled; the click itself is real.
    await cal.locator('[data-date="2026-01-16"]').click({ force: true });
    await expect(readout).toHaveText("2026-01-15");

    // Paging into a month wholly after maxDate stays blocked, as the arrow
    // button is.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expectFocusedDay(cal, "2026-01-30");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("PageDown");
    await expectFocusedDay(cal, "2026-01-30");
    await expect(cal.getByRole("grid")).toHaveAccessibleName("January 2026");

    // Back to an enabled day, which picks.
    await page.keyboard.press("PageUp");
    await page.keyboard.press("Enter");
    await expect(readout).toHaveText("2025-12-30");
  });
});
