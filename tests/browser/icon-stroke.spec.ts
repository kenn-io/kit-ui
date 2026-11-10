import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage, useTheme } from "./helpers.js";

// The default pair draws every icon with one fixed line, whatever its
// size. That is a property of the rendered pixels, not of a computed
// style, so these tests measure ink in a screenshot.

/** The icon's ink area in CSS px²: every pixel's coverage between the
 * background and the icon's color, summed. Area, not a line's cross
 * section, because browsers snap axis-aligned edges to a fraction of a
 * pixel, which moves a single straight line's measured width by 0.2px. */
async function inkArea(page: Page, icon: Locator): Promise<number> {
  const png = (await icon.screenshot()).toString("base64");
  const ink = await icon.evaluate((svg) => getComputedStyle(svg).color);
  return page.evaluate(
    async ([data, color]) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const inkRed = Number(color.match(/[\d.]+/)![0]);
      const background = pixels[0]!;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        total += (background - pixels[i]!) / (background - inkRed);
      }
      return total;
    },
    [png, ink] as const,
  );
}

/** Line weight of the circle icon, a ring of radius 10 in a 24-unit box:
 * its ink area over its circumference. */
async function ringLine(page: Page, size: number): Promise<number> {
  const ring = page.locator(`[data-icon-size="${size}"] svg.lucide-circle`);
  await expect(ring).toHaveCSS("width", `${size}px`);
  return (await inkArea(page, ring)) / ((2 * Math.PI * 10 * size) / 24);
}

/** Diameter of one overflow dot: the ellipsis is three equal discs. */
async function dotDiameter(page: Page, size: number): Promise<number> {
  const dots = page.locator(`[data-icon-size="${size}"] svg.lucide-ellipsis`);
  return 2 * Math.sqrt((await inkArea(page, dots)) / 3 / Math.PI);
}

const rows = (page: Page) => page.getByTestId("icon-weights").locator(".icon-weight-row");

test("icons draw the same line at every size, listed or not", async ({ page }) => {
  await gotoPage(page, "theme");
  const sizes = await rows(page).evaluateAll((all) =>
    all.map((row) => Number((row as HTMLElement).dataset.iconSize)),
  );
  // 15px sits between the usual steps; 18px is a 24px icon resized in CSS.
  expect(sizes).toEqual(expect.arrayContaining([12, 14, 15, 16, 18, 24]));

  for (const size of sizes) {
    const line = await ringLine(page, size);
    expect(line, `${size}px icon line`).toBeGreaterThan(1.05);
    expect(line, `${size}px icon line`).toBeLessThan(1.35);
  }
});

test("overflow dots grow with the icon and stay heavier than its line", async ({ page }) => {
  await gotoPage(page, "theme");
  // Diameter is size / 12 + 1.6px: 2.6px at 12px and 3.6px at 24px.
  const small = await dotDiameter(page, 12);
  const large = await dotDiameter(page, 24);
  expect(small).toBeGreaterThan(2.3);
  expect(small).toBeLessThan(2.9);
  expect(large).toBeGreaterThan(3.3);
  expect(large).toBeLessThan(3.9);
});

test("a filled mark stays unstroked", async ({ page }) => {
  await gotoPage(page, "theme");
  const icon = rows(page).first().locator("svg.lucide").first();
  await icon.evaluate((svg) => svg.setAttribute("stroke-width", "0"));
  expect(Number.parseFloat(await icon.evaluate((svg) => getComputedStyle(svg).strokeWidth))).toBe(
    0,
  );
});

test("an identity theme's --icon-stroke still wins and scales with the icon", async ({ page }) => {
  await gotoPage(page, "theme");
  await useTheme(page, "gallery");
  await expect(page.locator('[data-icon-size="24"] svg.lucide-circle')).toHaveCSS(
    "stroke-width",
    "1.5px",
  );
  // 1.5 units of a 24-unit box: 1.5px at 24px, half that at 12px.
  const large = await ringLine(page, 24);
  const small = await ringLine(page, 12);
  expect(large).toBeGreaterThan(1.3);
  expect(large).toBeLessThan(1.7);
  expect(small).toBeGreaterThan(0.55);
  expect(small).toBeLessThan(0.95);
});

test("the checkbox glyph keeps its own stroke", async ({ page }) => {
  await gotoPage(page, "checkbox");
  await expect(page.locator(".kit-checkbox__glyph").first()).toHaveCSS("stroke-width", "2px");
});
