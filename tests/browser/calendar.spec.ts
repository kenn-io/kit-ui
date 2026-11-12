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
    // Without layout or matches the grid has no strip parts.
    await expect(plain.locator(".kit-calendar__strip, .kit-calendar__match")).toHaveCount(0);
  });

  for (const dark of [false, true]) {
    test(`shaded day numbers meet AA contrast in ${dark ? "dark" : "light"}`, async ({ page }) => {
      await setTheme(page, { dark });
      for (const id of [
        "calendar-activity",
        "calendar-activity-scale",
        "calendar-strip",
        "calendar-strip-sunday",
      ]) {
        const days = page
          .getByTestId(id)
          .locator(".kit-calendar__day[data-activity]:not(.outside):not(:disabled)");
        const count = await days.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
          // Poll: day cells transition color, so a theme switch takes a moment to settle.
          await expect.poll(() => contrastOf(days.nth(i))).toBeGreaterThanOrEqual(4.5);
        }
        // Strip weekend letters use the quieter ink; measure them on their shades
        // too (green strip, blue Sunday strip).
        if (!id.startsWith("calendar-strip")) continue;
        const letters = page
          .getByTestId(id)
          .locator(
            ".kit-calendar__day.weekend[data-activity]:not(:disabled) .kit-calendar__day-weekday",
          );
        const letterCount = await letters.count();
        expect(letterCount).toBeGreaterThan(0);
        for (let i = 0; i < letterCount; i++) {
          await expect.poll(() => contrastOf(letters.nth(i))).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
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

  test("shows the month's own days in one row, with weekday letters and weekends", async ({
    page,
  }) => {
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
    await expect(days.first().locator(".kit-calendar__day-weekday")).not.toBeEmpty();

    // Mar 1 2026 is a Sunday: nine weekend days, their letters in a quieter ink.
    await expect(cal.locator(".kit-calendar__day.weekend")).toHaveCount(9);
    await expect(days.first()).toHaveClass(/weekend/);
    await expect(days.nth(2)).not.toHaveClass(/weekend/);
    const ink = (n: number) =>
      days
        .nth(n)
        .locator(".kit-calendar__day-weekday")
        .evaluate((node) => getComputedStyle(node).color);
    // Day 1 (Sunday) and day 3 (Tuesday) share a shade step, so only the weekend ink differs.
    await expect(days.first()).toHaveAttribute(
      "data-activity",
      (await days.nth(2).getAttribute("data-activity")) ?? "",
    );
    expect(await ink(0)).not.toBe(await ink(2));

    // Sunday-first: Feb 1 2026 is a Sunday, so the first and seventh days are the weekend.
    const sunday = page.getByTestId("calendar-strip-sunday").locator(".kit-calendar__day");
    await expect(
      page.getByTestId("calendar-strip-sunday").locator(".kit-calendar__day.weekend"),
    ).toHaveCount(8);
    await expect(sunday.first()).toHaveClass(/weekend/);
    await expect(sunday.nth(6)).toHaveClass(/weekend/);
  });

  test("a Sunday-first strip follows its locale, labels and maxDate", async ({ page }) => {
    const cal = page.getByTestId("calendar-strip-sunday").locator(".kit-calendar");
    const days = cal.locator(".kit-calendar__day");
    await expect(days).toHaveCount(28);
    // Feb 1 2026 is a Sunday.
    await expect(days.first().locator(".kit-calendar__day-weekday")).toHaveText("D");
    await expect(days.first()).toHaveAttribute("aria-label", /^dim\., /);

    // Feb 24 is past maxDate: disabled, yet still marked and announced.
    const matched = cal.locator(".kit-calendar__day:has(.kit-calendar__match)");
    await expect(matched).toHaveCount(3);
    await expect(days.nth(23)).toBeDisabled();
    await expect(days.nth(23).locator(".kit-calendar__match")).toHaveCount(1);
    await expect(days.nth(23)).toHaveAttribute("aria-label", /, correspond aux filtres$/);
    await expect(days.nth(13)).toBeEnabled();
    await expect(cal.locator(".kit-calendar__nav").nth(1)).toBeDisabled();
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
    await expect(days.nth(2).locator(".kit-calendar__match")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(await facts()).toEqual(before);

    // Replacing the filter replaces the marks; day 20 is marked without a count.
    await filter(page, "10th–20th").click();
    await expect(dots).toHaveCount(11);
    await expect(days.nth(2)).not.toHaveAttribute("aria-label", /matches filters/);
    await expect(days.nth(9)).toHaveAttribute("aria-label", /, matches filters$/);
    await expect(days.nth(19)).not.toHaveAttribute("data-activity");
    await expect(days.nth(19)).toHaveAttribute("aria-label", /\d, matches filters$/);
    await expect(days.nth(19)).not.toHaveAttribute("aria-label", /message/);
    expect(await facts()).toEqual(before);

    await filter(page, "No filter").click();
    await expect(dots).toHaveCount(0);
  });

  test("the selected day keeps its shade under an outline", async ({ page }) => {
    const cal = strip(page);
    const days = cal.locator(".kit-calendar__day");
    const selected = days.nth(27);
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    const step = await selected.getAttribute("data-activity");
    expect(step).not.toBeNull();
    const peer = cal
      .locator(`.kit-calendar__day[data-activity="${step}"][aria-pressed="false"]`)
      .first();
    await page.mouse.move(0, 0);
    const background = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((node) => getComputedStyle(node).backgroundColor);
    await expect.poll(() => background(selected)).toBe(await background(peer));
    expect(await selected.evaluate((node) => getComputedStyle(node).boxShadow)).toMatch(
      /0px 0px 0px 2px inset/,
    );

    await days.nth(4).click();
    await expect(page.locator("code", { hasText: "2026-03-05" })).toBeVisible();
    await expect(days.nth(4)).toHaveAttribute("aria-pressed", "true");
    await expect(selected).toHaveAttribute("aria-pressed", "false");
  });

  test("the arrows page one month and drop an out-of-month selection", async ({ page }) => {
    const cal = strip(page);
    const days = cal.locator(".kit-calendar__day");
    await cal.locator(".kit-calendar__nav").nth(1).click();
    await expect(days).toHaveCount(30);
    await cal.locator(".kit-calendar__nav").first().click();
    await cal.locator(".kit-calendar__nav").first().click();
    await expect(days).toHaveCount(28);
    await expect(cal.locator(".kit-calendar__day[aria-pressed='true']")).toHaveCount(0);
  });

  test("at 400px the strip scrolls inside itself and shows the selected day", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await gotoPage(page, "calendar");
    const cal = strip(page);
    const track = cal.locator(".kit-calendar__strip");
    const nav = cal.locator(".kit-calendar__nav");
    const selected = cal.locator(".kit-calendar__day").nth(27);
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
    await expect.poll(visible).toBe(true);

    // A month without a selection starts at day 1.
    await nav.nth(1).click();
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
});

test("matches draw on the grid, in surface ink on a solid range end", async ({ page }) => {
  // The day-range demo (fourth calendar) marks days ending in 0.
  const cal = page.locator(".kit-calendar").nth(3);
  const day = (n: number) =>
    cal.locator(".kit-calendar__day:not(.outside)").filter({ hasText: new RegExp(`^${n}$`) });
  await expect(day(20).locator(".kit-calendar__match")).toHaveCount(1);
  await expect(day(20)).toHaveAttribute("aria-label", /, matches filters$/);
  await expect(day(21).locator(".kit-calendar__match")).toHaveCount(0);

  await day(5).click();
  await day(10).click();
  await expect(day(10)).toHaveClass(/range-end/);
  await expect(day(10)).toHaveAttribute("aria-pressed", "true");
  await expect(day(10)).toHaveAttribute("aria-label", /, matches filters$/);
  const dot = (n: number) =>
    day(n)
      .locator(".kit-calendar__match")
      .evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.mouse.move(0, 0);
  await expect.poll(() => dot(10)).not.toBe(await dot(20));
});
