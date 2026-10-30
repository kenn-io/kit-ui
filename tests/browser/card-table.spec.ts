import { expect, test, type Locator } from "@playwright/test";
import { gotoPage } from "./helpers.js";

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
