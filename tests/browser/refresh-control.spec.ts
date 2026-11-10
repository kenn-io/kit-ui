import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage, resolvedStyle } from "./helpers.js";

// Width reservation only exists under real layout: the box must measure the
// same across every variant while the visible text inside it does not.

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("element has no layout box");
  return box.width;
}

/** Width of the rendered glyphs, independent of the element box that may
 * be stretched or clipped around them. */
async function glyphWidthOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  });
}

async function leftOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("element has no layout box");
  return box.x;
}

function fixedWidthControl(page: Page) {
  const row = page.getByTestId("fixed-width-row");
  return {
    age: row.locator(".kit-refresh-control__age"),
    ageText: row.locator(".kit-refresh-control__age > .kit-refresh-control__text"),
    marker: page.getByTestId("fixed-width-marker"),
  };
}

test("onRefresh receives manual clicks and automatic ticks", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-01-15T08:00:00Z") });
  await gotoPage(page, "refresh-control");
  await page.clock.pauseAt(new Date("2026-01-15T08:01:00Z"));
  const reason = page.getByTestId("refresh-reason");

  await page.getByRole("button", { name: "Refresh usage data", exact: true }).click();
  await expect(reason).toHaveText("manual");
  await page.clock.fastForward(300_000);
  await expect(reason).toHaveText("auto");
});

test("age box keeps one width across the narrowest, widest, and overlong labels", async ({
  page,
}) => {
  await gotoPage(page, "refresh-control");
  const control = fixedWidthControl(page);

  await page.getByRole("button", { name: "Age: not updated" }).click();
  await expect(control.ageText).toHaveText("Not updated");
  const narrowBox = await widthOf(control.age);
  const narrowText = await glyphWidthOf(control.ageText);
  const markerAtNarrow = await leftOf(control.marker);

  await page.getByRole("button", { name: "Age: just now" }).click();
  await expect(control.ageText).toHaveText("Updated just now");
  const wideBox = await widthOf(control.age);
  const markerAtWide = await leftOf(control.marker);

  await page.getByRole("button", { name: "Age: 3m ago" }).click();
  await expect(control.ageText).toHaveText("Updated 3m ago");
  const midBox = await widthOf(control.age);

  await page.getByRole("button", { name: "Age: long status" }).click();
  await expect(control.ageText).toContainText("Processing activity");
  const overlongBox = await widthOf(control.age);
  const overlongText = await glyphWidthOf(control.ageText);
  const markerAtOverlong = await leftOf(control.marker);

  // The reservation is real: the narrowest label is visibly shorter than the
  // box it sits in, and the overlong label is clipped to the box.
  expect(narrowText).toBeLessThan(narrowBox);
  expect(overlongText).toBeGreaterThan(overlongBox);
  expect(await control.ageText.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  expect(wideBox).toBeCloseTo(narrowBox, 1);
  expect(midBox).toBeCloseTo(narrowBox, 1);
  expect(overlongBox).toBeCloseTo(narrowBox, 1);
  expect(markerAtWide).toBeCloseTo(markerAtNarrow, 1);
  expect(markerAtOverlong).toBeCloseTo(markerAtNarrow, 1);
});

test("age label opens its tooltip on hover and keeps the reserved layout", async ({ page }) => {
  await gotoPage(page, "refresh-control");
  const row = page.getByTestId("tooltip-row");
  const label = row.locator(".kit-refresh-control__age");
  const marker = page.getByTestId("fixed-width-marker");
  const markerBefore = await leftOf(marker);

  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await label.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Top sessions");
  await expect(tooltip).toContainText("2 s");
  expect(await leftOf(marker)).toBeCloseTo(markerBefore, 1);

  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("the small size sets a quiet glyph tight against the status", async ({ page }) => {
  await gotoPage(page, "refresh-control");
  const control = page.getByTestId("refresh-control-sm").locator(".kit-refresh-control");
  const button = control.locator(".kit-refresh-control__btn");
  await expect(button).toHaveCSS("width", "24px");
  await expect(button.locator("svg")).toHaveAttribute("width", "12");
  await expect(control).toHaveCSS("column-gap", "2px");
  await expect(button).toHaveCSS("color", await resolvedStyle(page, "color", "var(--text-muted)"));
});
