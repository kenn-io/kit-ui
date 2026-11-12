import { expect, test } from "@playwright/test";
import { contrastOf, gotoPage, setTheme } from "./helpers.js";

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

test.describe("activity", () => {
  test("shades days with a count and adds the count to their label", async ({ page }) => {
    const calendar = page.getByTestId("calendar-activity").locator(".kit-calendar");
    const shaded = calendar.locator(".kit-calendar__day[data-activity]");
    expect(await shaded.count()).toBeGreaterThan(0);
    const steps = await shaded.evaluateAll((nodes) =>
      nodes.map((node) => Number((node as HTMLElement).dataset.activity)),
    );
    expect(Math.max(...steps)).toBe(4);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(1);
    await expect(shaded.first()).toHaveAttribute("aria-label", /, \d+ items?$/);

    // Shaded and plain days have different fills. Plain days may all be
    // future, disabled ones early in a month; opacity leaves the fill alone.
    const plain = calendar.locator(".kit-calendar__day:not([data-activity])");
    const background = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(await background(shaded.first())).not.toBe(await background(plain.first()));
    await expect(plain.first()).not.toHaveAttribute("aria-label", /items?$/);
  });

  test("an app scale and label replace the defaults", async ({ page }) => {
    const calendar = page.getByTestId("calendar-activity-scale").locator(".kit-calendar");
    const days = calendar.locator(".kit-calendar__day");
    // The demo's counts are (index * 5) % 13; its scale maps 1–2, 3–5, 6–9, 10+.
    const facts = await days.evaluateAll((nodes) =>
      nodes.map((node) => [
        (node as HTMLElement).dataset.activity ?? null,
        node.getAttribute("aria-label"),
      ]),
    );
    const expected = (count: number) =>
      count <= 0 ? null : count <= 2 ? "1" : count <= 5 ? "2" : count <= 9 ? "3" : "4";
    facts.forEach(([step, label], i) => {
      const count = (i * 5) % 13;
      expect(step).toBe(expected(count));
      expect(label).toMatch(count === 1 ? /, 1 message$/ : new RegExp(`, ${count} messages$`));
    });
  });

  test("selection draws over the shade", async ({ page }) => {
    const calendar = page.getByTestId("calendar-activity").locator(".kit-calendar");
    const day = calendar.locator(".kit-calendar__day[data-activity]:not(:disabled)").first();
    await day.click();
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 0);
    const accent = await day.evaluate((node) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--accent-blue)";
      node.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    // A one-day selection is a solid accent pill; poll past the fill transition.
    await expect
      .poll(() => day.evaluate((node) => getComputedStyle(node).backgroundColor))
      .toBe(accent);
  });

  test("calendars without activity stay unshaded", async ({ page }) => {
    const plain = page.locator(".kit-calendar").first();
    await expect(plain.locator(".kit-calendar__day[data-activity]")).toHaveCount(0);
  });

  for (const dark of [false, true]) {
    test(`shaded day numbers meet AA contrast in ${dark ? "dark" : "light"}`, async ({ page }) => {
      await setTheme(page, { dark });
      for (const id of ["calendar-activity", "calendar-activity-scale"]) {
        const days = page
          .getByTestId(id)
          .locator(".kit-calendar__day[data-activity]:not(.outside):not(:disabled)");
        const count = await days.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
          // Poll: day cells transition color, so a theme switch takes a moment to settle.
          await expect.poll(() => contrastOf(days.nth(i))).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});
