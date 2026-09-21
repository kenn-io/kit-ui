import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

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
