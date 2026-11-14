import { expect, test } from "@playwright/test";
import { contrastOf, gotoPage, resolvedStyle, setTheme } from "./helpers.js";

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

async function mountCalendarLayout(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const { mount } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: CalendarLayout } =
      await import("/tests/browser/fixtures/CalendarLayout.svelte");
    document.body.replaceChildren();
    mount(CalendarLayout, { target: document.body });
  });
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
  await expect(day(10)).toHaveClass(/range-end/);
  const surface = await resolvedStyle(page, "background-color", "var(--bg-surface)");
  await page.mouse.move(0, 0);
  await expect(day(10).locator(".kit-calendar__match")).toHaveCSS("background-color", surface);

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

test.describe("activity", () => {
  test("shades days with a count and adds the count to their label", async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 2, 15, 12));
    await page.reload();
    const calendar = page.getByTestId("calendar-activity").locator(".kit-calendar");
    await expect(
      calendar.getByRole("gridcell", { name: "Tuesday, March 3, 2026, 1 item" }),
    ).toBeVisible();
    await expect(
      calendar.getByRole("gridcell", { name: "Thursday, March 5, 2026, 4 items" }),
    ).toBeVisible();
    await expect(
      calendar.getByRole("gridcell", { name: "Thursday, March 12, 2026, 9 items" }),
    ).toHaveAttribute("data-activity", "4");
    for (const day of [0, 1].map((i) => calendar.locator(".kit-calendar__day").nth(i))) {
      await expect(day).not.toHaveAttribute("data-activity");
      await expect(day).not.toHaveAttribute("aria-label", /(?:NaN|Infinity|items?)/);
    }

    await test.step("shaded day numbers meet AA contrast in light and dark", async () => {
      for (const dark of [false, true]) {
        await setTheme(page, { dark });
        for (const id of [
          "calendar-activity",
          "calendar-activity-scale",
          "calendar-strip-sunday",
        ]) {
          const days = page
            .getByTestId(id)
            .locator(
              '.kit-calendar__day[data-activity]:not(.outside):not(:disabled):not([aria-disabled="true"])',
            );
          expect(await days.count()).toBeGreaterThan(0);
          for (const step of [1, 2, 3, 4]) {
            const day = page
              .getByTestId(id)
              .locator(
                `.kit-calendar__day[data-activity="${step}"]:not(.outside):not(:disabled):not([aria-disabled="true"])`,
              )
              .first();
            await expect(day).toHaveCount(1);
            await expect.poll(() => contrastOf(day)).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    });

    await test.step("selecting a grid day uses a solid fill", async () => {
      const day = calendar
        .locator('.kit-calendar__day[data-activity]:not([aria-disabled="true"])')
        .first();
      await day.click();
      await expect(day).toHaveAttribute("aria-selected", "true");
      await page.mouse.move(0, 0);
      const accent = await resolvedStyle(page, "color", "var(--accent-blue)");
      await expect(day).toHaveCSS("background-color", accent);
    });
  });

  test("an app scale and label replace the defaults", async ({ page }) => {
    await mountCalendarLayout(page);
    const custom = page.locator(".kit-calendar");
    await expect(
      custom.getByRole("gridcell", { name: "Sunday, March 1, 2026, 0 messages" }),
    ).toHaveAttribute("data-activity", "1");
  });
});

// Month strip demo: March 2026 with day 28 selected, the app's fixed
// scale over (day * 7 + 3) % 13 counts (day 20 has none), and a
// Sunday-first blue fr strip for February 2026 with maxDate Feb 20,
// marking days ending in 4.
test.describe("month strip", () => {
  const strip = (page: import("@playwright/test").Page) =>
    page.getByTestId("calendar-strip").locator(".kit-calendar");
  const filter = (page: import("@playwright/test").Page, name: string) =>
    page.getByRole("radiogroup", { name: "Strip filter" }).getByRole("radio", { name });

  test("shows the month's own days in one row, with weekday letters", async ({ page }) => {
    const cal = strip(page);
    const days = cal.locator(".kit-calendar__day");
    await expect(days).toHaveCount(31);
    await expect(cal.locator(".kit-calendar__grid, .kit-calendar__weekdays")).toHaveCount(0);
    // The month label is static: no drill-down in the strip.
    await expect(cal.locator(".kit-calendar__month--button")).toHaveCount(0);
    const tops = await days.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).offsetTop),
    );
    expect(new Set(tops).size).toBe(1);
    await expect(days.first().locator(".kit-calendar__day-number")).toHaveText("1");
    await expect(days.last().locator(".kit-calendar__day-number")).toHaveText("31");
    expect(
      (await days.locator(".kit-calendar__day-weekday").allTextContents()).slice(0, 7),
    ).toEqual(["S", "M", "T", "W", "T", "F", "S"]);

    const sunday = page.getByTestId("calendar-strip-sunday").locator(".kit-calendar");
    const sundayDays = sunday.locator(".kit-calendar__day");
    await expect(sundayDays).toHaveCount(28);
    // Feb 1 2026 is a Sunday.
    await expect(sundayDays.first().locator(".kit-calendar__day-weekday")).toHaveText("D");
    await expect(sundayDays.first()).toHaveAttribute("aria-label", /^dim\., /);
  });

  test("matches mark days independently of counts and selection", async ({ page }) => {
    const cal = strip(page);
    const days = cal.locator(".kit-calendar__day");
    const dots = cal.locator(".kit-calendar__match");
    const facts = () =>
      days.evaluateAll((nodes) =>
        nodes.map((node) => [
          (node as HTMLElement).dataset.activity ?? null,
          node.getAttribute("aria-pressed"),
        ]),
      );
    await expect(dots).toHaveCount(0);
    const before = await facts();

    await filter(page, "Every 3rd day").click();
    await expect(dots).toHaveCount(10);
    await expect(days.nth(2)).toHaveAttribute("aria-label", /, \d+ messages?, matches filters$/);
    await expect(days.nth(3)).not.toHaveAttribute("aria-label", /matches filters/);
    expect(await facts()).toEqual(before);

    // Replacing the filter replaces the marks; day 20 is marked without a count.
    await filter(page, "10th–20th").click();
    await expect(dots).toHaveCount(11);
    await expect(days.nth(2)).not.toHaveAttribute("aria-label", /matches filters/);
    await expect(days.nth(19)).not.toHaveAttribute("data-activity");
    await expect(days.nth(19)).toHaveAttribute("aria-label", /\d, matches filters$/);
    expect(await facts()).toEqual(before);

    await filter(page, "No filter").click();
    await expect(dots).toHaveCount(0);

    // Feb 24 is past maxDate: disabled, yet still marked and announced.
    const sunday = page.getByTestId("calendar-strip-sunday").locator(".kit-calendar");
    const sundayDays = sunday.locator(".kit-calendar__day");
    await expect(sunday.locator(".kit-calendar__day:has(.kit-calendar__match)")).toHaveCount(3);
    await expect(sundayDays.nth(23)).toBeDisabled();
    await expect(sundayDays.nth(23).locator(".kit-calendar__match")).toHaveCount(1);
    await expect(sundayDays.nth(23)).toHaveAttribute("aria-label", /, correspond aux filtres$/);
  });

  test("the selected day keeps its shade under an outline", async ({ page }) => {
    const accent = await resolvedStyle(page, "color", "var(--accent-blue)");

    const cal = strip(page);
    const days = cal.locator(".kit-calendar__day");
    const selected = days.nth(27);
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await expect(selected).toHaveAttribute("data-activity", "2");
    await page.mouse.move(0, 0);
    const tint = await resolvedStyle(
      page,
      "background-color",
      "color-mix(in srgb, var(--accent-green) 22%, transparent)",
    );
    await expect(selected).toHaveCSS("background-color", tint);
    const shadow = await selected.evaluate((node) => getComputedStyle(node).boxShadow);
    expect(shadow).toContain(accent);
    expect(shadow).toMatch(/0px 0px 0px 2px inset/);
  });

  test("paging the strip resets an open grid chooser", async ({ page }) => {
    await mountCalendarLayout(page);
    const cal = page.locator(".kit-calendar");
    await cal.locator(".kit-calendar__month--button").click();
    await cal.locator(".kit-calendar__month--button").click();
    await expect(cal.locator(".kit-calendar__unit")).toHaveCount(12);
    await page.getByRole("button", { name: "Strip", exact: true }).click();
    await cal.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await expect(cal.locator(".kit-calendar__grid")).toBeVisible();
    await expect(cal.locator(".kit-calendar__month--button")).toContainText("April 2026");
  });

  test("at 400px the strip scrolls and keeps keyboard focus visible", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.reload();
    const cal = strip(page);
    const track = cal.locator(".kit-calendar__strip");
    const nav = cal.locator(".kit-calendar__nav");
    const selected = cal.locator(".kit-calendar__day").nth(27);
    await test.step("show the selected day by scrolling only the strip", async () => {
      const visible = async () => {
        const [box, cell] = await Promise.all([track.boundingBox(), selected.boundingBox()]);
        if (box == null || cell == null) return false;
        return cell.x >= box.x - 1 && cell.x + cell.width <= box.x + box.width + 1;
      };
      const scrollLeft = () => track.evaluate((node) => node.scrollLeft);
      expect(await track.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
      // The calendar itself fits the viewport; only its track scrolls.
      expect(
        await cal.evaluate((node) => node.getBoundingClientRect().right <= window.innerWidth),
      ).toBe(true);
      expect(
        await track.evaluate((node) => {
          const trackBox = node.getBoundingClientRect();
          const calendarBox = node.parentElement!.getBoundingClientRect();
          return trackBox.left >= calendarBox.left && trackBox.right <= calendarBox.right;
        }),
      ).toBe(true);
      await expect.poll(visible).toBe(true);

      // A month without a selection starts at day 1.
      await nav.nth(1).click();
      await expect(cal.locator(".kit-calendar__month")).toHaveText("April 2026");
      await expect.poll(scrollLeft).toBe(0);

      // Paging back reveals the selection by scrolling only the track. The
      // gallery scrolls in its own containers, so scroll every ancestor of the
      // track to the top (the strip then sits below the fold), click without
      // Playwright's scroll-into-view, and check no ancestor moved.
      const ancestorScroll = () =>
        track.evaluate((node) => {
          const offsets: number[] = [];
          for (let el = node.parentElement; el; el = el.parentElement) {
            offsets.push(el.scrollLeft, el.scrollTop);
          }
          return offsets;
        });
      await track.evaluate((node) => {
        for (let el = node.parentElement; el; el = el.parentElement) el.scrollTo(0, 0);
      });
      const before = await ancestorScroll();
      await nav.first().evaluate((node) => (node as HTMLElement).click());
      await expect.poll(visible).toBe(true);
      expect(await ancestorScroll()).toEqual(before);
    });

    await test.step("keep focus rings visible while tabbing through days", async () => {
      const days = cal.locator(".kit-calendar__day");
      for (const highContrast of [false, true]) {
        await setTheme(page, { highContrast });
        await cal.locator(".kit-calendar__nav").last().focus();
        for (const [key, indices] of [
          ["Tab", Array.from({ length: 31 }, (_, i) => i)],
          ["Shift+Tab", Array.from({ length: 30 }, (_, i) => 29 - i)],
        ] as const) {
          for (const index of indices) {
            await page.keyboard.press(key);
            const day = days.nth(index);
            await expect(day).toBeFocused();
            const fits = await day.evaluate((element) => {
              const dayBox = element.getBoundingClientRect();
              const trackBox = element.parentElement!.getBoundingClientRect();
              const style = getComputedStyle(element);
              const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
              return (
                style.outlineStyle !== "none" &&
                ring > 0 &&
                dayBox.left - ring >= trackBox.left &&
                dayBox.right + ring <= trackBox.right &&
                dayBox.top - ring >= trackBox.top &&
                dayBox.bottom + ring <= trackBox.bottom
              );
            });
            expect(fits, `day ${index + 1}, ${key}, high contrast ${highContrast}`).toBe(true);
          }
        }
      }
    });
  });
});
