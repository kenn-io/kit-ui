import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.describe("PageHeader", () => {
  for (const width of [1440, 390]) {
    test(`draws no line of its own above a table at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoPage(page, "page-header");
      const host = page.getByTestId("page-with-table");
      await expect(host.getByRole("heading", { level: 1, name: "Releases" })).toBeVisible();

      // Every element the component draws; slotted actions keep their own borders.
      const lines = await host
        .locator(".kit-page-header, .kit-page-header [class^='kit-page-header__']")
        .evaluateAll((nodes) =>
          nodes
            .map((node) => getComputedStyle(node))
            .filter((style) => style.borderBottomWidth !== "0px" || style.boxShadow !== "none")
            .map((style) => `${style.borderBottomWidth} ${style.boxShadow}`),
        );
      expect(lines).toEqual([]);
    });
  }

  test("actions share the title row on wide screens and wrap under it on narrow ones", async ({
    page,
  }) => {
    const rows = async () =>
      page.getByTestId("page-with-back-link").evaluate((element) => {
        const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
        const text = rect(".kit-page-header__text");
        const actions = rect(".kit-page-header__actions");
        return {
          actionsBelowText: actions.top >= text.bottom,
          actionsRight: actions.left > text.left,
        };
      });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPage(page, "page-header");
    expect(await rows()).toEqual({ actionsBelowText: false, actionsRight: true });

    await page.setViewportSize({ width: 390, height: 900 });
    expect(await rows()).toEqual({ actionsBelowText: true, actionsRight: false });
  });

  test("renders the back link above the title and honors the heading level", async ({ page }) => {
    await gotoPage(page, "page-header");
    const header = page.getByTestId("page-with-back-link");
    const link = header.getByRole("link", { name: "Releases" });
    const title = header.getByRole("heading", { level: 1, name: "Release 2.4.0" });
    const linkBox = await link.boundingBox();
    const titleBox = await title.boundingBox();
    expect(linkBox!.y + linkBox!.height).toBeLessThanOrEqual(titleBox!.y);

    await expect(
      page.getByTestId("pane-header").getByRole("heading", { level: 2, name: "Settings" }),
    ).toBeVisible();
  });
});
