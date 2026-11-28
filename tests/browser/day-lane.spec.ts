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
    lanes?: { key: string; label: string }[];
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

test("shared cards select in every lane", async ({ page }) => {
  const lanes = page.getByTestId("day-lane-lanes");
  const standup = lanes.getByRole("button", { name: /Shipment status standup/ });
  const call = lanes.getByRole("button", { name: /Call: Jory and Dev/ });
  await expect(standup).toHaveCount(4);
  await expect(call).toHaveCount(2);
  await call.first().click();
  await expect(page.getByTestId("day-lane-lanes-event")).toHaveText("select call");
  for (let i = 0; i < 2; i++) await expect(call.nth(i)).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 4; i++) await expect(standup.nth(i)).toHaveAttribute("aria-pressed", "false");
});

test("lanes keep their minimum width and scroll sideways", async ({ page }) => {
  const scroller = page.getByTestId("day-lane-lanes").locator(".kit-day-lane");
  const [scrollWidth, clientWidth] = await scroller.evaluate((el) => [
    el.scrollWidth,
    el.clientWidth,
  ]);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
});

test("lane headers line up with their lanes without a border-box reset", async ({ page }) => {
  const lanes = page.getByTestId("day-lane-lanes");
  await page.addStyleTag({ content: "*, *::before, *::after { box-sizing: content-box; }" });
  const head = await lanes
    .locator(".kit-day-lane__lane-head", { hasText: "Dev Rao" })
    .boundingBox();
  const column = await lanes.getByRole("group", { name: "Dev Rao" }).boundingBox();
  expect(Math.abs(head!.x - column!.x)).toBeLessThanOrEqual(1);
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

test("focus scrolls a card clear of the pinned headers", async ({ page }) => {
  const lanes = page.getByTestId("day-lane-lanes");
  const dev = lanes.getByRole("group", { name: "Dev Rao" });
  const scroller = lanes.locator(".kit-day-lane");
  const card = dev.getByRole("button", { name: /Call: Jory and Dev/ });
  await scroller.scrollIntoViewIfNeeded();
  await scroller.evaluate((el) => {
    const card = el.querySelector<HTMLElement>(
      "[aria-label='Dev Rao'] .kit-day-lane__item[data-day-lane-key*=call]",
    )!;
    const header = el.querySelector<HTMLElement>(".kit-day-lane__lane-heads")!;
    el.scrollTop +=
      card.getBoundingClientRect().top - el.getBoundingClientRect().top - header.clientHeight / 2;
  });
  await card.focus();
  const heads = await lanes.locator(".kit-day-lane__lane-heads").boundingBox();
  const box = await card.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(heads!.y + heads!.height);
});

test("pinned lane headers paint above overlapping fold labels", async ({ page }) => {
  const lanes = page.getByTestId("day-lane-lanes");
  const scroller = lanes.locator(".kit-day-lane");
  const label = lanes.locator(".kit-day-lane__fold-label").first();
  await scroller.scrollIntoViewIfNeeded();
  await scroller.evaluate((el) => {
    const header = el.querySelector(".kit-day-lane__lane-heads")!.getBoundingClientRect();
    const fold = el.querySelector(".kit-day-lane__fold-label")!.getBoundingClientRect();
    el.scrollTop +=
      fold.top + fold.height / 2 - (el.getBoundingClientRect().top + header.height / 2);
  });
  const overlap = await label.evaluate((el) => {
    const fold = el.getBoundingClientRect();
    const header = el
      .closest(".kit-day-lane")!
      .querySelector(".kit-day-lane__lane-heads")!
      .getBoundingClientRect();
    const x = fold.left + fold.width / 2;
    const y = fold.top + fold.height / 2;
    return {
      withinHeader: x >= header.left && x <= header.right && y >= header.top && y <= header.bottom,
      topIsHeader: !!document.elementFromPoint(x, y)?.closest(".kit-day-lane__lane-heads"),
    };
  });
  expect(overlap.withinHeader).toBe(true);
  expect(overlap.topIsHeader).toBe(true);
});

test("lane keys and item IDs cannot collide in keyboard navigation", async ({ page }) => {
  await mountDayLane(page, {
    items: [
      { id: "x|item:y", lane: "a", startMinute: 540 },
      { id: "y", lane: "a|item:x", startMinute: 540 },
    ],
    lanes: [
      { key: "a", label: "First" },
      { key: "a|item:x", label: "Second" },
    ],
    foldQuietMinutes: 0,
    label: "Item",
  });
  const first = page.getByRole("group", { name: "First" }).getByRole("button", { name: /Item/ });
  const second = page.getByRole("group", { name: "Second" }).getByRole("button", { name: /Item/ });
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(second).toBeFocused();
});

for (const edge of ["left", "right"] as const) {
  test(`fold controls keep the ${edge} lane visible at 640px`, async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    const lanes = page.getByTestId("day-lane-lanes");
    const scroller = lanes.locator(".kit-day-lane");
    await scroller.scrollIntoViewIfNeeded();
    await scroller.evaluate((el, edge) => {
      el.scrollTop = 0;
      el.scrollLeft = edge === "left" ? 0 : el.scrollWidth;
    }, edge);
    const fold = lanes.getByRole("button", { name: /1:00 AM – 7:00 AM/ });
    const before = await scroller.evaluate((el) => el.scrollLeft);
    const [frame, band] = await Promise.all([scroller.boundingBox(), fold.boundingBox()]);
    // The frozen hour gutter covers the band's scrolled-past start.
    const gutter = await scroller.evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue("--kit-day-lane-gutter")),
    );
    const x = Math.max(frame!.x + gutter, band!.x) + 20;
    const y = band!.y + band!.height / 2;
    await page.mouse.click(x, y);
    const refold = lanes.getByRole("button", { name: "Fold 6 quiet hours" });
    await expect(refold).toBeFocused();
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBe(before);
    const button = await refold.boundingBox();
    expect(button!.x).toBeGreaterThanOrEqual(frame!.x + gutter);
    expect(button!.x + button!.width).toBeLessThanOrEqual(frame!.x + frame!.width);
    await refold.click();
    await expect(fold).toBeFocused();
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBe(before);
    const label = await fold.locator(".kit-day-lane__fold-label").boundingBox();
    expect(label!.x).toBeGreaterThanOrEqual(frame!.x + gutter);
    expect(label!.x + label!.width).toBeLessThanOrEqual(frame!.x + frame!.width);
  });
}

test("switching to a single lane clears pinned-header scroll clearance", async ({ page }) => {
  const fixture = await mountDayLane(page, {
    items: [{ id: "first", lane: "a", startMinute: 540 }],
    lanes: [{ key: "a", label: "A" }],
    dayKey: "a",
    foldQuietMinutes: 0,
    label: "Item",
  });
  const scroller = page.locator(".kit-day-lane");
  await expect(page.locator(".kit-day-lane__lane-heads")).toBeVisible();
  await fixture.evaluate((component) =>
    component.update({ lanes: undefined, dayKey: "b", items: [{ id: "first", startMinute: 540 }] }),
  );
  const card = page.getByRole("button", { name: /Item/ });
  await expect
    .poll(async () => {
      const [frame, box] = await Promise.all([scroller.boundingBox(), card.boundingBox()]);
      return Math.round(box!.y - frame!.y);
    })
    .toBe(24);
});

async function scrolledRightLanes(page: Page) {
  await page.setViewportSize({ width: 640, height: 800 });
  const lanes = page.getByTestId("day-lane-lanes");
  const scroller = lanes.locator(".kit-day-lane");
  await scroller.scrollIntoViewIfNeeded();
  await scroller.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  const frame = (await scroller.boundingBox())!;
  const gutter = await scroller.evaluate((el) =>
    parseFloat(getComputedStyle(el).getPropertyValue("--kit-day-lane-gutter")),
  );
  return { lanes, scroller, frame, gutter };
}

test("hour labels remain hit-testable in the frozen gutter", async ({ page }) => {
  const { lanes, scroller, frame, gutter } = await scrolledRightLanes(page);
  const label = lanes.locator(".kit-day-lane__hour-label", { hasText: /^\s*9 AM\s*$/ });
  await scroller.evaluate(
    (el, top) => (el.scrollTop += top),
    (await label.boundingBox())!.y - frame.y - 120,
  );
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(
    await scroller.evaluate((el) => el.scrollWidth - el.clientWidth),
  );
  const box = (await label.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(frame.x);
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + gutter);
  expect(
    await label.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return !!document
        .elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        ?.closest(".kit-day-lane__gutter");
    }),
  ).toBe(true);
});

test("date-only strip and card remain visible at the far edge", async ({ page }) => {
  const { lanes, frame } = await scrolledRightLanes(page);
  const strip = (await lanes.locator(".kit-day-lane__date-only").boundingBox())!;
  expect(Math.round(strip.x)).toBe(Math.round(frame.x));
  const card = (await lanes.locator(".kit-day-lane__item--date-only").first().boundingBox())!;
  expect(card.x).toBeGreaterThanOrEqual(frame.x);
  expect(card.x + card.width).toBeLessThanOrEqual(frame.x + frame.width);
});

test("pinned header corner caps the gutter", async ({ page }) => {
  const { lanes, frame } = await scrolledRightLanes(page);
  const corner = await lanes.locator(".kit-day-lane__lane-heads").evaluate((el, x) => {
    const r = el.getBoundingClientRect();
    return !!document
      .elementFromPoint(x + 4, r.top + r.height / 2)
      ?.closest(".kit-day-lane__corner");
  }, frame.x);
  expect(corner).toBe(true);
});

test("last lane is whole beside the gutter", async ({ page }) => {
  const { lanes, frame, gutter } = await scrolledRightLanes(page);
  const box = (await lanes.locator(".kit-day-lane__lane").last().boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(frame.x + gutter - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
});

test("focus scrolls a card clear of the frozen gutter", async ({ page }) => {
  const { lanes, scroller, frame, gutter } = await scrolledRightLanes(page);
  const first = lanes
    .locator(".kit-day-lane__lane")
    .first()
    .getByRole("button", { name: /Shipment status standup/ });
  const card = (await first.boundingBox())!;
  await scroller.evaluate(
    (el, delta) => (el.scrollLeft += delta),
    card.x - (frame.x - card.width + 2),
  );
  await first.focus();
  await expect
    .poll(async () => (await first.boundingBox())!.x)
    .toBeGreaterThanOrEqual(frame.x + gutter);
  const hit = await first.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + 6, r.top + r.height / 2));
  });
  expect(hit).toBe(true);

  // Arrow navigation must reveal a target that is only partly behind the gutter.
  const next = lanes.getByRole("button", { name: /Shipment status standup/ }).nth(1);
  const nextBox = (await next.boundingBox())!;
  await scroller.evaluate(
    (el, delta) => (el.scrollLeft += delta),
    nextBox.x - (frame.x + gutter - nextBox.width / 2),
  );
  await page.keyboard.press("ArrowRight");
  await expect(next).toBeFocused();
  expect((await next.boundingBox())!.x).toBeGreaterThanOrEqual(frame.x + gutter);
});
