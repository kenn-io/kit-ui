import { expect, test, type Locator } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.describe("PageHeader content", () => {
  test("puts the trailing status on the title's line", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPage(page, "page-header");
    const host = page.getByTestId("page-with-status");
    const title = await host.getByRole("heading", { level: 1, name: "build-host-a" }).boundingBox();
    const status = await host.getByText("Online").boundingBox();
    expect(status!.y).toBeLessThan(title!.y + title!.height);
    expect(status!.y + status!.height).toBeGreaterThan(title!.y);
    expect(status!.x).toBeGreaterThan(title!.x + title!.width);
  });

  test("renders a snippet title and description inside the heading and description", async ({
    page,
  }) => {
    await gotoPage(page, "page-header");
    const host = page.getByTestId("page-with-markup");
    const heading = host.getByRole("heading", { level: 1, name: "Run a1b2c3d" });
    await expect(heading.locator("code")).toHaveText("a1b2c3d");
    await expect(host.locator(".kit-page-header__description code")).toHaveText("release.yml");
  });

  test("moves keyboard focus to a focusable title", async ({ page }) => {
    await gotoPage(page, "page-header");
    const host = page.getByTestId("page-with-focus");
    await host.getByRole("button", { name: "Next step" }).click();
    await expect(
      host.getByRole("heading", { level: 1, name: "Choose repositories" }),
    ).toBeFocused();
  });

  test("sizes the title by size, not by heading level", async ({ page }) => {
    await gotoPage(page, "page-header");
    const fontSize = (heading: Locator) =>
      heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    // The three sizes share heading level 1, so only the size prop can order them.
    const sizes = page.getByTestId("page-sizes");
    const size = (name: string) =>
      fontSize(sizes.getByRole("heading", { level: 1, name, exact: true }));
    const [large, medium, small] = [await size("Large"), await size("Medium"), await size("Small")];
    expect(large).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(small);
    // A level-2 header at the default size matches the level-1 large title.
    const paneTitle = page
      .getByTestId("pane-header")
      .getByRole("heading", { level: 2, name: "Settings" });
    expect(await fontSize(paneTitle)).toBe(large);
  });

  test("takes the title weight from the theme", async ({ page }) => {
    await gotoPage(page, "page-header");
    const heading = page
      .getByTestId("page-sizes")
      .getByRole("heading", { name: "Large", exact: true });
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--kit-page-header-title-weight", "600"),
    );
    await expect(heading).toHaveCSS("font-weight", "600");
  });
});
