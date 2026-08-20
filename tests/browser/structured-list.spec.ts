import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.describe("StructuredList", () => {
  test("renders compact aligned rows and expands details", async ({ page }) => {
    await gotoPage(page, "structured-list");

    const list = page.getByRole("list", { name: "Publishing targets" });
    await expect(list).toBeVisible();

    const rows = list.getByRole("listitem");
    await expect(rows).toHaveCount(3);

    const collapsedHeight = await rows
      .first()
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(collapsedHeight).toBeGreaterThanOrEqual(36);
    expect(collapsedHeight).toBeLessThanOrEqual(48);

    await expect(page.getByText("Last checked 2 minutes ago")).toBeHidden();
    await rows.first().locator("summary").click();
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
});
