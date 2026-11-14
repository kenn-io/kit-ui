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

function rangeDay(page: import("@playwright/test").Page, n: number) {
  return page
    .locator(".kit-calendar")
    .nth(3)
    .locator(".kit-calendar__day:not(.outside)")
    .filter({ hasText: new RegExp(`^\\s*${n}\\s*$`) });
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
  const day = (n: number) => rangeDay(page, n);
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
    await page.clock.setFixedTime(new Date(2026, 2, 15, 12));
    await page.reload();
    const calendar = page.getByTestId("calendar-activity").locator(".kit-calendar");
    const shaded = calendar.locator(".kit-calendar__day[data-activity]");
    await expect(calendar.getByRole("button", { name: "Mar 3, 2026, 1 item" })).toHaveAttribute(
      "data-activity",
      "1",
    );
    await expect(calendar.getByRole("button", { name: "Mar 5, 2026, 4 items" })).toHaveAttribute(
      "data-activity",
      "2",
    );
    await expect(calendar.getByRole("button", { name: "Mar 10, 2026, 6 items" })).toHaveAttribute(
      "data-activity",
      "3",
    );
    await expect(calendar.getByRole("button", { name: "Mar 12, 2026, 9 items" })).toHaveAttribute(
      "data-activity",
      "4",
    );
    await expect(shaded.first()).toHaveAttribute("aria-label", /, \d+ items?$/);
    for (const day of [0, 1].map((i) => calendar.locator(".kit-calendar__day").nth(i))) {
      await expect(day).not.toHaveAttribute("data-activity");
      await expect(day).not.toHaveAttribute("aria-label", /(?:NaN|Infinity|items?)/);
    }

    // Shaded and plain days have different fills. Plain days may all be
    // future, disabled ones early in a month; opacity leaves the fill alone.
    const plain = calendar.locator(".kit-calendar__day:not([data-activity])");
    const background = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(await background(shaded.first())).not.toBe(await background(plain.first()));
    const noActivity = page.locator(".kit-calendar").first();
    await expect(noActivity.locator(".kit-calendar__day[data-activity]")).toHaveCount(0);
    await expect(noActivity.locator(".kit-calendar__strip, .kit-calendar__match")).toHaveCount(0);
  });

  test("an app scale and label replace the defaults", async ({ page }) => {
    const calendar = page.getByTestId("calendar-activity-scale").locator(".kit-calendar");
    const days = calendar.locator(".kit-calendar__day");
    await expect(days.nth(0)).not.toHaveAttribute("data-activity");
    await expect(days.nth(0)).toHaveAttribute("aria-label", /, 0 messages$/);
    await expect(days.nth(8)).toHaveAttribute("data-activity", "1");
    await expect(days.nth(8)).toHaveAttribute("aria-label", /, 1 message$/);
    await expect(days.nth(11)).toHaveAttribute("data-activity", "2");
    await expect(days.nth(11)).toHaveAttribute("aria-label", /, 3 messages$/);
    await expect(days.nth(9)).toHaveAttribute("data-activity", "3");
    await expect(days.nth(9)).toHaveAttribute("aria-label", /, 6 messages$/);
    await expect(days.nth(2)).toHaveAttribute("data-activity", "4");
    await expect(days.nth(2)).toHaveAttribute("aria-label", /, 10 messages$/);

    await page.evaluate(async () => {
      const { mount } = await import("/node_modules/.vite/deps/svelte.js");
      const { default: CalendarLayout } =
        await import("/tests/browser/fixtures/CalendarLayout.svelte");
      document.body.replaceChildren();
      mount(CalendarLayout, { target: document.body });
    });
    const custom = page.locator(".kit-calendar");
    await expect(custom.getByRole("button", { name: "Mar 1, 2026, 0 messages" })).toHaveAttribute(
      "data-activity",
      "1",
    );
    await expect(
      custom.getByRole("button", { name: "Mar 2, 2026, -1 messages" }),
    ).not.toHaveAttribute("data-activity");
  });

  test("shaded day numbers meet AA contrast in light and dark", async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 2, 15, 12));
    await page.reload();
    for (const dark of [false, true]) {
      await setTheme(page, { dark });
      for (const id of ["calendar-activity", "calendar-activity-scale", "calendar-strip-sunday"]) {
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
    }
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

    await expect(sunday.locator(".kit-calendar__nav").nth(1)).toBeDisabled();
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
    await expect(days.nth(9)).toHaveAttribute("aria-label", /, matches filters$/);
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

    // A match on a solid grid range end uses the surface color.
    const day = (n: number) => rangeDay(page, n);
    await expect(day(20).locator(".kit-calendar__match")).toHaveCount(1);
    await expect(day(20)).toHaveAttribute("aria-label", /, matches filters$/);
    await expect(day(21).locator(".kit-calendar__match")).toHaveCount(0);
    await day(5).click();
    await day(10).click();
    await expect(day(10)).toHaveClass(/range-end/);
    await expect(day(10)).toHaveAttribute("aria-label", /, matches filters$/);
    const dot = day(10).locator(".kit-calendar__match");
    const surface = await day(10).evaluate((node) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--bg-surface)";
      node.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
    await page.mouse.move(0, 0);
    await expect
      .poll(() => dot.evaluate((node) => getComputedStyle(node).backgroundColor))
      .toBe(surface);
  });

  test("the selected day keeps its shade under an outline", async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 2, 15, 12));
    await page.reload();
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
    await expect
      .poll(() => day.evaluate((node) => getComputedStyle(node).backgroundColor))
      .toBe(accent);

    const cal = strip(page);
    const days = cal.locator(".kit-calendar__day");
    const selected = days.nth(27);
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await expect(selected).toHaveAttribute("data-activity", "2");
    const peer = cal.locator('.kit-calendar__day[data-activity="2"][aria-pressed="false"]').first();
    await page.mouse.move(0, 0);
    const background = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((node) => getComputedStyle(node).backgroundColor);
    const colors = await selected.evaluate((node) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "color-mix(in srgb, var(--accent-green) 22%, transparent)";
      probe.style.color = "var(--accent-blue)";
      node.appendChild(probe);
      const style = getComputedStyle(probe);
      const result = { tint: style.backgroundColor, accent: style.color };
      probe.remove();
      return result;
    });
    await expect.poll(() => background(selected)).toBe(colors.tint);
    await expect.poll(() => background(peer)).toBe(colors.tint);
    const shadow = await selected.evaluate((node) => getComputedStyle(node).boxShadow);
    expect(shadow).toContain(colors.accent);
    expect(shadow).toMatch(/0px 0px 0px 2px inset/);

    await days.nth(4).click();
    await expect(page.locator("code", { hasText: "2026-03-05" })).toBeVisible();
    await expect(days.nth(4)).toHaveAttribute("aria-pressed", "true");
    await expect(selected).toHaveAttribute("aria-pressed", "false");
  });

  test("paging the strip resets an open grid chooser", async ({ page }) => {
    await page.evaluate(async () => {
      const { mount } = await import("/node_modules/.vite/deps/svelte.js");
      const { default: CalendarLayout } =
        await import("/tests/browser/fixtures/CalendarLayout.svelte");
      document.body.replaceChildren();
      mount(CalendarLayout, { target: document.body });
    });
    const cal = page.locator(".kit-calendar");
    for (const [zoom, month] of [
      [1, "April 2026"],
      [2, "May 2026"],
    ] as const) {
      await cal.locator(".kit-calendar__month--button").click();
      if (zoom === 2) await cal.locator(".kit-calendar__month--button").click();
      await expect(cal.locator(".kit-calendar__unit")).toHaveCount(12);
      await page.getByRole("button", { name: "Strip", exact: true }).click();
      await cal.getByRole("button", { name: "Next month" }).click();
      await page.getByRole("button", { name: "Grid", exact: true }).click();
      await expect(cal.locator(".kit-calendar__grid")).toBeVisible();
      await expect(cal.locator(".kit-calendar__month--button")).toContainText(month);
    }
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
      await nav.first().click();
      await expect(cal.locator(".kit-calendar__month")).toHaveText("February 2026");
      await expect(cal.locator(".kit-calendar__day[aria-pressed='true']")).toHaveCount(0);
      await nav.nth(1).click();
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
