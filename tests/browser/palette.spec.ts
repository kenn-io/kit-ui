import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers";

test.describe("palette", () => {
  test("color-blind option swaps matplotlib for petroff", async ({ page }) => {
    await gotoPage(page, "palette");
    const swatches = page.getByTestId("family-swatches").locator(".swatch");
    await expect(swatches).toHaveCount(9);
    await expect(swatches.first()).toHaveCSS("background-color", "rgb(31, 119, 180)");

    await page.getByRole("switch", { name: "Color-blind safe" }).click();
    // petroff10 is the shortest Petroff sequence that fits nine series.
    await expect(swatches.first()).toHaveCSS("background-color", "rgb(63, 144, 218)");
  });

  test("patterned swatches are valid CSS that keep the series color", async ({ page }) => {
    await gotoPage(page, "palette");
    const swatches = page.getByTestId("pattern-swatches").locator(".swatch");
    await expect(swatches).toHaveCount(40);

    for (const fill of ["hatch", "crosshatch", "dots"]) {
      const swatch = swatches.and(page.locator(`[data-fill="${fill}"]`)).first();
      const { image, color, expected } = await swatch.evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.color = (el as HTMLElement).dataset.color!;
        document.body.append(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        const style = getComputedStyle(el);
        return { image: style.backgroundImage, color: style.backgroundColor, expected };
      });
      // An invalid background shorthand is dropped whole, leaving no image
      // and a transparent color.
      expect(image, fill).not.toBe("none");
      expect(color, fill).toBe(expected);
    }
  });
});
