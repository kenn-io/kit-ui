import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.describe("StructuredList", () => {
  test("renders compact aligned rows and expands details", async ({ page }) => {
    await gotoPage(page, "structured-list");

    const list = page.getByRole("list", { name: "Publishing targets" });
    await expect(list).toBeVisible();

    const rows = list.getByRole("listitem");
    await expect(rows).toHaveCount(3);

    const headerCells = page.locator(".kit-structured-list__header > span");
    const rowCells = rows.first().locator(".kit-structured-list-row__summary > span");
    await expect(headerCells).toHaveCount(5);
    await expect(rowCells).toHaveCount(5);
    const headerStarts = await headerCells.evaluateAll((cells) =>
      cells.map((cell) => Math.round(cell.getBoundingClientRect().left)),
    );
    const rowStarts = await rowCells.evaluateAll((cells) =>
      cells.map((cell) => Math.round(cell.getBoundingClientRect().left)),
    );
    expect(rowStarts).toEqual(headerStarts);

    const collapsedHeight = await rows
      .first()
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(collapsedHeight).toBeGreaterThanOrEqual(36);
    expect(collapsedHeight).toBeLessThanOrEqual(48);

    const disclosure = rows.first().locator("summary");
    await expect(disclosure).toHaveAccessibleName(
      /Show details for Package registry.*Target.*Package registry.*Identity.*example-project.*Observation.*1.4.2 is current.*Status.*Current/,
    );
    await expect(page.getByText("Last checked 2 minutes ago")).toBeHidden();
    await disclosure.click();
    await expect(page.getByText("Last checked 2 minutes ago")).toBeVisible();
  });

  test("stacks without horizontal overflow on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPage(page, "structured-list");

    const list = page.getByRole("list", { name: "Publishing targets" });
    await expect(list).toBeVisible();
    await expect(page.locator(".kit-structured-list__header")).toBeHidden();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("stacks inside a narrow container on a wide viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPage(page, "structured-list");

    const host = page.locator(".demo-list");
    await host.evaluate((element) => {
      (element as HTMLElement).style.width = "360px";
    });
    const list = page.getByRole("list", { name: "Publishing targets" });
    await expect(page.locator(".kit-structured-list__header")).toBeHidden();

    const bounds = await list.evaluate((element) => {
      const listBox = element.getBoundingClientRect();
      const cells = Array.from(
        element.querySelectorAll(".kit-structured-list-row__summary > span"),
      );
      return {
        left: Math.min(...cells.map((cell) => cell.getBoundingClientRect().left)),
        right: Math.max(...cells.map((cell) => cell.getBoundingClientRect().right)),
        listLeft: listBox.left,
        listRight: listBox.right,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.listLeft);
    expect(bounds.right).toBeLessThanOrEqual(bounds.listRight);
  });
});
