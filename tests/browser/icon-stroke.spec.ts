import { expect, test } from "@playwright/test";
import { gotoPage, useTheme } from "./helpers.js";

// Every icon size draws about the same rendered line in the default pair:
// stroke-width (in viewBox units of 24) times size / 24.
test("icons draw one line weight at every size", async ({ page }) => {
  await gotoPage(page, "theme");
  const icons = page.getByTestId("icon-weights").locator("svg.lucide:not(.lucide-ellipsis)");
  const lines = await icons.evaluateAll((svgs) =>
    svgs.map((svg) => {
      const size = Number(svg.getAttribute("width"));
      const stroke = Number.parseFloat(getComputedStyle(svg).strokeWidth);
      return { size, line: (stroke * size) / 24 };
    }),
  );
  expect(lines.length).toBeGreaterThan(0);
  for (const { size, line } of lines) {
    expect(line, `${size}px icon line`).toBeGreaterThanOrEqual(1.1);
    expect(line, `${size}px icon line`).toBeLessThanOrEqual(1.5);
  }
});

test("an identity theme's --icon-stroke still wins", async ({ page }) => {
  await gotoPage(page, "theme");
  await useTheme(page, "gallery");
  const stroke = await page
    .getByTestId("icon-weights")
    .locator("svg.lucide")
    .first()
    .evaluate((svg) => getComputedStyle(svg).strokeWidth);
  expect(stroke).toBe("1.5px");
});
