import { expect, test, type Locator } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Icon alignment in Chip: svgs composed into the label span must stay
// visually centered (not baseline-aligned) without growing the pill, and
// the trailing snippet (dropdown chevrons) must center exactly and survive
// label truncation.

async function centerOffset(chip: Locator, svg: Locator): Promise<number> {
  const chipBox = await chip.boundingBox();
  const svgBox = await svg.boundingBox();
  if (!chipBox || !svgBox) throw new Error("element not rendered");
  return Math.abs(chipBox.y + chipBox.height / 2 - (svgBox.y + svgBox.height / 2));
}

// The label fix: vertical-align: middle for layout, a negative block margin
// so tall icons can't grow the line box, and an ex/cap transform correcting
// x-height keying to the cap-height midline (uppercase optical center).
// Measured offsets are ~0.6px; the tolerance leaves headroom for platform
// font-metric differences while still catching baseline sag (~2px+).
for (const [name, testid, maxHeight] of [
  ["md", "chip-label-icon", 23],
  ["sm", "chip-label-icon-sm", 19],
] as const) {
  test(`svg composed into the ${name} label centers without growing the chip`, async ({ page }) => {
    await gotoPage(page, "chip");
    const chip = page.getByTestId(testid);
    expect(await centerOffset(chip, chip.locator(".kit-chip__label svg"))).toBeLessThanOrEqual(
      1.25,
    );
    const box = await chip.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(maxHeight);
  });
}

test("trailing snippet centers exactly and does not grow the chip", async ({ page }) => {
  await gotoPage(page, "chip");
  const chip = page.getByTestId("chip-trailing");
  expect(await centerOffset(chip, chip.locator(".kit-chip__trailing svg"))).toBeLessThanOrEqual(1);
  // md chips are 22px tall; a 12px icon must not stretch the pill.
  const box = await chip.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(23);
});

test("trailing indicator survives label truncation", async ({ page }) => {
  await gotoPage(page, "chip");
  const chip = page.getByTestId("chip-truncated");
  const label = chip.locator(".kit-chip__label");

  // The label actually truncates…
  const overflows = await label.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflows).toBe(true);

  // …while the chevron stays fully visible inside the chip bounds.
  const chipBox = await chip.boundingBox();
  const svgBox = await chip.locator(".kit-chip__trailing svg").boundingBox();
  expect(svgBox!.width).toBeGreaterThan(0);
  expect(svgBox!.x + svgBox!.width).toBeLessThanOrEqual(chipBox!.x + chipBox!.width + 0.5);
});
