import { expect, test, type Locator } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme } from "./helpers.js";

const bottomRule = (cell: Locator) =>
  cell.evaluate((element) => getComputedStyle(element).borderBottomWidth);

test.describe("Card with a table", () => {
  for (const width of [1440, 390]) {
    test(`a table ending a flush card's body draws no line above the card's edge at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoPage(page, "card");
      const [flush, withNote] = [0, 1].map((index) =>
        page.getByTestId("flush-table-cards").locator(".kit-card").nth(index),
      );

      await expect(flush.getByRole("cell", { name: "Running" })).toBeVisible();
      expect(await bottomRule(flush.getByRole("cell", { name: "Running" }))).toBe("0px");
      expect(await bottomRule(flush.getByRole("cell", { name: "Passed" }))).toBe("1px");

      // Content after the table needs the last-row rule as its divider.
      expect(await bottomRule(withNote!.getByRole("cell", { name: "Running" }))).toBe("1px");
    });
  }
});

/** Mean sRGB channel (0..1) of a computed color, in either form Chromium
 * serializes: rgb() or, for a color-mix() result, color(srgb …). */
function lightness(color: string): number {
  const mixed = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  const channels = mixed
    ? mixed.slice(1, 4).map(Number)
    : (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => Number(value) / 255);
  expect(channels).toHaveLength(3);
  return (channels[0]! + channels[1]! + channels[2]!) / 3;
}

const edgeOf = (card: Locator) =>
  card.evaluate((element) => getComputedStyle(element).borderTopColor);

for (const highContrast of [false, true]) {
  test(`a light default card's edge sits between the muted border and a raised card's${
    highContrast ? " · high contrast" : ""
  }`, async ({ page }) => {
    await gotoPage(page, "card");
    await setTheme(page, { dark: false, highContrast });
    const muted = lightness(await resolvedStyle(page, "border-top-color", "var(--border-muted)"));
    const edge = lightness(await edgeOf(page.locator(".kit-card--default").first()));
    const raised = lightness(await edgeOf(page.locator(".kit-card--raised").first()));

    // Darker than the muted border, which vanished on the page; lighter
    // than the raised card's, so the two levels stay apart.
    expect(edge).toBeLessThan(muted);
    expect(edge).toBeGreaterThan(raised);
  });
}

test("a dark default card keeps the muted edge", async ({ page }) => {
  await gotoPage(page, "card");
  await setTheme(page, { dark: true });
  await expect(page.locator(".kit-card--default").first()).toHaveCSS(
    "border-top-color",
    await resolvedStyle(page, "border-top-color", "var(--border-muted)"),
  );
});
