import { expect, test, type Page } from "@playwright/test";
import type { DayLaneItem } from "../../src/lib/components/day-lane.js";
import { gotoPage } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "day-lane");
});

const lane = (page: import("@playwright/test").Page) => page.getByTestId("day-lane-busy");
const lastEvent = (page: import("@playwright/test").Page) => page.getByTestId("day-lane-event");

async function mountDayLane(
  page: Page,
  options: {
    items: DayLaneItem[];
    dayKey?: string;
    foldQuietMinutes: number;
    nowMinute?: number;
    label: string;
  },
) {
  return page.evaluateHandle(async ({ label, ...props }) => {
    const [{ mountReactive }, { default: DayLane }, { createRawSnippet }] = await Promise.all([
      import("/tests/browser/fixtures/mount-reactive.svelte.ts"),
      import("/src/lib/components/DayLane.svelte"),
      import("/node_modules/.vite/deps/svelte.js"),
    ]);
    document.body.replaceChildren();
    const host = document.createElement("div");
    host.style.height = "300px";
    document.body.appendChild(host);
    return mountReactive(DayLane, host, {
      ...props,
      item: createRawSnippet(() => ({ render: () => `<span>${label}</span>` })),
    });
  }, options);
}

test("a fold closes when its old quiet span returns", async ({ page }) => {
  const fixture = await mountDayLane(page, {
    items: [
      { id: "morning", startMinute: 600 },
      { id: "afternoon", startMinute: 840 },
    ],
    dayKey: "a",
    foldQuietMinutes: 120,
    label: "Item",
  });
  const fold = page.getByRole("button", { name: /11:00 AM.*2:00 PM/ });
  await fold.click();
  await expect(page.getByRole("button", { name: "Fold 3 quiet hours" })).toBeVisible();
  await fixture.evaluate((component) =>
    component.update({
      items: [
        { id: "morning", startMinute: 600 },
        { id: "midday", startMinute: 720 },
        { id: "afternoon", startMinute: 840 },
      ],
    }),
  );
  await expect(page.getByRole("button", { name: "Fold 3 quiet hours" })).toHaveCount(0);
  await fixture.evaluate((component) =>
    component.update({
      items: [
        { id: "morning", startMinute: 600 },
        { id: "afternoon", startMinute: 840 },
      ],
    }),
  );
  await expect(fold).toBeVisible();
});

test("point cards mark their own exact start at the top edge", async ({ page }) => {
  const dock = lane(page).getByRole("button", { name: /Dock schedule/ });
  const interval = lane(page).getByRole("button", { name: /Container BRKU/ });
  await expect(dock).toHaveCSS("border-top-width", "2px");
  const colors = await dock.evaluate((el) => {
    const sample = document.createElement("span");
    sample.style.color = "var(--accent-red)";
    el.appendChild(sample);
    const result = [getComputedStyle(el).borderTopColor, getComputedStyle(sample).color];
    sample.remove();
    return result;
  });
  expect(colors[0]).toBe(colors[1]);
  await expect(interval).toHaveCSS("border-top-width", "1px");
  const hour = lane(page).locator(".kit-day-lane__hour-label", { hasText: /^\s*8 AM\s*$/ });
  const nextHour = lane(page).locator(".kit-day-lane__hour-label", { hasText: /^\s*9 AM\s*$/ });
  const [label, nextLabel, card] = await Promise.all([
    hour.boundingBox(),
    nextHour.boundingBox(),
    dock.boundingBox(),
  ]);
  const firstY = label!.y + label!.height / 2;
  const nextY = nextLabel!.y + nextLabel!.height / 2;
  expect((card!.y - firstY) / (nextY - firstY)).toBeCloseTo(47 / 60, 2);
});

for (const foldQuietMinutes of [0, 120]) {
  test(`preserves scroll across a temporary empty state with folding ${foldQuietMinutes}`, async ({
    page,
  }) => {
    const items = [
      { id: "first", startMinute: 540, endMinute: 1200 },
      { id: "last", startMinute: 1200 },
    ];
    const fixture = await mountDayLane(page, {
      items,
      dayKey: "a",
      foldQuietMinutes,
      label: "Item",
    });
    const scroller = page.locator(".kit-day-lane");
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await scroller.evaluate((el) => (el.scrollTop = 100));
    await fixture.evaluate((component) => component.update({ items: [] }));
    await expect(page.getByRole("button", { name: /Item/ })).toHaveCount(0);
    await fixture.evaluate((component, items) => component.update({ items }), items);
    await expect(page.getByRole("button", { name: /Item/ })).toHaveCount(2);
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(100);
  });

  test(`resets scroll for a day without timed items with folding ${foldQuietMinutes}`, async ({
    page,
  }) => {
    const fixture = await mountDayLane(page, {
      items: [
        { id: "first", startMinute: 540 },
        { id: "last", startMinute: 1200 },
      ],
      dayKey: "a",
      foldQuietMinutes,
      label: "Item",
    });
    const scroller = page.locator(".kit-day-lane");
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await scroller.evaluate((el) => (el.scrollTop = 100));
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await fixture.evaluate((component) =>
      component.update({
        dayKey: "b",
        items: Array.from({ length: 60 }, (_, i) => ({ id: `date-${i}`, dateOnly: true })),
      }),
    );
    await expect(page.getByRole("button", { name: /Item/ })).toHaveCount(60);
    expect(await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
    await fixture.evaluate((component) =>
      component.update({
        dayKey: "a",
        items: [
          { id: "first", startMinute: 540 },
          { id: "last", startMinute: 1200 },
        ],
      }),
    );
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('[data-day-lane-key="item:first"]')).toBeInViewport();
    await fixture.evaluate((component) =>
      component.update({
        dayKey: "b",
        items: Array.from({ length: 60 }, (_, i) => ({ id: `date-${i}`, dateOnly: true })),
      }),
    );
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
    await fixture.evaluate((component) =>
      component.update({
        items: [
          { id: "later", startMinute: 540 },
          { id: "last", startMinute: 1200 },
        ],
      }),
    );
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('[data-day-lane-key="item:later"]')).toBeInViewport();
  });
}

test("the first timed card is visible below a tall date-only strip", async ({ page }) => {
  const fixture = await mountDayLane(page, {
    items: [],
    dayKey: "a",
    foldQuietMinutes: 0,
    label: "Item",
  });
  await fixture.evaluate((component) =>
    component.update({
      dayKey: "b",
      items: [
        ...Array.from({ length: 60 }, (_, i) => ({ id: `date-${i}`, dateOnly: true })),
        { id: "midnight", startMinute: 0 },
      ],
    }),
  );
  const scroller = page.locator(".kit-day-lane");
  const card = page.locator('[data-day-lane-key="item:midnight"]');
  await expect
    .poll(async () => {
      const [frame, item] = await Promise.all([scroller.boundingBox(), card.boundingBox()]);
      return item!.y >= frame!.y && item!.y + item!.height <= frame!.y + frame!.height;
    })
    .toBe(true);
  await fixture.evaluate((component) =>
    component.update({
      dayKey: "c",
      items: [
        { id: "date", dateOnly: true },
        { id: "midnight", startMinute: 0 },
      ],
    }),
  );
  await expect(page.locator('[data-day-lane-key="item:date"]')).toHaveCount(1);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
});

test("short intervals keep their minimum height while taller intervals have a gap", async ({
  page,
}) => {
  await mountDayLane(page, {
    items: [
      { id: "short", startMinute: 540, endMinute: 550 },
      { id: "near", startMinute: 570, endMinute: 598 },
      { id: "tall", startMinute: 600, endMinute: 660 },
    ],
    foldQuietMinutes: 0,
    label: "Item",
  });
  expect((await page.locator('[data-day-lane-key="item:short"]').boundingBox())!.height).toBe(44);
  expect((await page.locator('[data-day-lane-key="item:near"]').boundingBox())!.height).toBe(44);
  expect((await page.locator('[data-day-lane-key="item:tall"]').boundingBox())!.height).toBe(94);
});

test("overflow shows its label and reports a click", async ({ page }) => {
  const more = lane(page).getByRole("button", { name: /\+3 more from 9:30 AM/ });
  await more.click();
  await expect(lastEvent(page)).toHaveText("overflow 3 from 9:30 AM");
});

test("Tab returns to the selected card after focus leaves the lane", async ({ page }) => {
  const standup = lane(page).getByRole("button", { name: /Shipment status standup/ });
  const call = lane(page).getByRole("button", { name: /Call: Jory and Dev/ });
  await expect(standup).toHaveAttribute("aria-pressed", "true");
  await expect(standup).toHaveAttribute("tabindex", "0");
  await page.getByRole("checkbox", { name: "Dim chats" }).focus();
  await page.keyboard.press("Tab");
  await expect(standup).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(call).toBeFocused();
  await lane(page).evaluate((frame) => {
    const after = document.createElement("button");
    after.textContent = "After lane";
    frame.after(after);
  });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "After lane" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(standup).toBeFocused();
  await expect(standup).toHaveAttribute("tabindex", "0");
  await expect(call).toHaveAttribute("tabindex", "-1");
});

test("keyboard navigation selects a card and reaches both ends", async ({ page }) => {
  await lane(page)
    .getByRole("button", { name: /Shipment status standup/ })
    .focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(lastEvent(page)).toHaveText("select call");
  await page.keyboard.press("Home");
  await expect(lane(page).getByRole("button", { name: /Signed delivery receipt/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(lane(page).getByRole("button", { name: /Late note/ })).toBeFocused();
});

test("an interval card's accessible name ends with its time range", async ({ page }) => {
  await expect(lane(page).getByRole("button", { name: /Container BRKU/ })).toHaveAccessibleName(
    /, 8:30 AM – 8:52 AM$/,
  );
});

test("keyboard focus follows a fold as it opens and closes", async ({ page }) => {
  const fold = lane(page).getByRole("button", { name: /11:00 AM – 2:00 PM · 3 quiet hours/ });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.focus();
  await page.keyboard.press("Enter");
  await expect(lastEvent(page)).toHaveText("open 11:00 AM – 2:00 PM");
  const refold = lane(page).getByRole("button", { name: "Fold 3 quiet hours" });
  await expect(refold).toHaveAttribute("aria-expanded", "true");
  await expect(refold).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(fold).toBeFocused();
});

test("a 23-hour day labels its hours from the app's ticks", async ({ page }) => {
  await page.getByText("23 h (spring)").click();
  await page.getByRole("checkbox", { name: "Fold quiet hours" }).uncheck();
  const hourLabels = lane(page).locator(".kit-day-lane__hour-label");
  await expect(hourLabels).toHaveCount(23);
  const labels = (await hourLabels.allTextContents()).map((s) => s.trim());
  await page.getByRole("checkbox", { name: "Fold quiet hours" }).check();
  // The 1 AM to 7 AM band names its own start, so no "1 AM" label sits beside it.
  await expect(
    lane(page).locator(".kit-day-lane__hour-label", { hasText: /^\s*1 AM\s*$/ }),
  ).toHaveCount(0);
  expect(labels.slice(0, 3)).toEqual(["12 AM", "1 AM", "3 AM"]);
});

test("changing days closes folds even when returning to the original day", async ({ page }) => {
  const fold = lane(page).getByRole("button", { name: /11:00 AM – 2:00 PM · 3 quiet hours/ });
  await fold.click();
  await page.getByText("23 h (spring)").click();
  await page.getByText("24 h", { exact: true }).click();
  await expect(fold).toHaveAttribute("aria-expanded", "false");
});

test("the now line stays inside a fold and moves to its hour when opened", async ({ page }) => {
  const fixture = await mountDayLane(page, {
    items: [
      { id: "morning", startMinute: 600, endMinute: 630 },
      { id: "afternoon", startMinute: 840 },
    ],
    foldQuietMinutes: 120,
    nowMinute: 750,
    label: "Item",
  });
  const fold = page.getByRole("button", { name: /11:00 AM.*2:00 PM/ });
  const now = page.locator(".kit-day-lane__now");
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
  await fixture.evaluate((component) => component.update({ nowMinute: 839 }));
  await expect.poll(async () => (await now.boundingBox())!.y).toBeGreaterThan(line!.y);
  const endLine = (await now.boundingBox())!;
  expect(endLine.y + endLine.height).toBeLessThanOrEqual(band!.y + band!.height);
  await fold.click();
  const refold = page.getByRole("button", { name: "Fold 3 quiet hours" });
  const [button, openedLine] = await Promise.all([refold.boundingBox(), now.boundingBox()]);
  expect(openedLine!.y).toBeGreaterThan(button!.y + button!.height);
});
