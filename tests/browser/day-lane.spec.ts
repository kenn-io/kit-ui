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

test("returning to a day after an empty day scrolls once to its first card", async ({ page }) => {
  const fixture = await mountDayLane(page, {
    items: [{ id: "first", startMinute: 540 }],
    dayKey: "a",
    foldQuietMinutes: 0,
    label: "First",
  });
  const scroller = page.locator(".kit-day-lane");
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await fixture.evaluate((component) => component.update({ items: [] }));
  await expect(page.getByRole("button", { name: /First/ })).toHaveCount(0);
  await scroller.evaluate((el) => (el.scrollTop = 100));
  await fixture.evaluate((component) =>
    component.update({ items: [{ id: "first", startMinute: 540 }] }),
  );
  await expect(page.getByRole("button", { name: /First/ })).toBeVisible();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(100);
  await fixture.evaluate((component) => component.update({ items: [], dayKey: "b" }));
  await expect(page.getByRole("button", { name: /First/ })).toHaveCount(0);
  await scroller.evaluate((el) => (el.scrollTop = 0));
  await fixture.evaluate((component) =>
    component.update({ items: [{ id: "first", startMinute: 540 }], dayKey: "a" }),
  );
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /First/ })).toBeInViewport();
});

test("a late interval stays within the day axis", async ({ page }) => {
  await mountDayLane(page, {
    items: [{ id: "late", startMinute: 1439, endMinute: 1500 }],
    foldQuietMinutes: 0,
    label: "Late",
  });
  const card = page.getByRole("button", { name: /Late/ });
  const axis = page.locator(".kit-day-lane__axis");
  const [cardBox, axisBox] = await Promise.all([card.boundingBox(), axis.boundingBox()]);
  expect(cardBox!.height).toBeGreaterThan(0);
  expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(axisBox!.y + axisBox!.height);
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

test("overlapping items sit side by side and the rest go to +N more", async ({ page }) => {
  const standup = lane(page).getByRole("button", { name: /Shipment status standup/ });
  const call = lane(page).getByRole("button", { name: /Call: Jory and Dev/ });
  const more = lane(page).getByRole("button", { name: /\+3 more from 9:30 AM/ });
  const [a, b, c] = await Promise.all([standup, call, more].map((l) => l.boundingBox()));
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
  expect(b!.x + b!.width).toBeLessThanOrEqual(c!.x);
  expect(c!.height).toBe(44);
  await more.click();
  await expect(lastEvent(page)).toHaveText("overflow 3 from 9:30 AM");
});

test("the selected card is the tab stop and arrows move in time order", async ({ page }) => {
  const standup = lane(page).getByRole("button", { name: /Shipment status standup/ });
  const call = lane(page).getByRole("button", { name: /Call: Jory and Dev/ });
  await expect(standup).toHaveAttribute("aria-pressed", "true");
  await expect(standup).toHaveAttribute("tabindex", "0");
  await page.getByRole("checkbox", { name: "Dim chats" }).focus();
  await page.keyboard.press("Tab");
  await expect(standup).toBeFocused();
  await lane(page).evaluate((frame) => {
    const after = document.createElement("button");
    after.textContent = "After lane";
    frame.after(after);
  });
  await page.getByRole("button", { name: "After lane" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(standup).toBeFocused();
  const fold = lane(page).getByRole("button", { name: /11:00 AM – 2:00 PM · 3 quiet hours/ });
  await expect(fold).toHaveAttribute("tabindex", "-1");
  await lane(page)
    .getByRole("button", { name: /Pallet count v3/ })
    .focus();
  await page.keyboard.press("ArrowDown");
  await expect(fold).toBeFocused();
  await page.keyboard.press("Enter");
  const refold = lane(page).getByRole("button", { name: "Fold 3 quiet hours" });
  await standup.focus();
  await expect(refold).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("ArrowDown");
  await expect(call).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(standup).toBeFocused();
  await expect(standup).toHaveAttribute("tabindex", "0");
  await expect(call).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(lastEvent(page)).toHaveText("select call");
  await page.keyboard.press("Home");
  await expect(lane(page).getByRole("button", { name: /Signed delivery receipt/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(lane(page).getByRole("button", { name: /Late note/ })).toBeFocused();
});

test("a point in the last minute renders at full height on 24-hour and 23-hour days", async ({
  page,
}) => {
  const late = lane(page).getByRole("button", { name: /Late note/ });
  expect((await late.boundingBox())!.height).toBe(44);
  await page.getByText("23 h (spring)").click();
  expect((await late.boundingBox())!.height).toBe(44);
});

test("a card's accessible name ends with its time range", async ({ page }) => {
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
  const labels = (await lane(page).locator(".kit-day-lane__hour-label").allTextContents()).map(
    (s) => s.trim(),
  );
  expect(labels).toHaveLength(23);
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
