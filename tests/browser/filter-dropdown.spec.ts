import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers";

test("a submenu row opens a flyout beside the panel and peels one layer per Escape", async ({
  page,
}) => {
  await gotoPage(page, "filter-dropdown");
  await page.getByRole("button", { name: "Filters" }).click();

  const row = page.getByRole("button", { name: /Labels/ });
  await expect(row).toHaveAttribute("aria-haspopup", "dialog");
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(row).toContainText("Any");

  await row.click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  await expect(flyout).toBeVisible();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(flyout.getByRole("button", { name: "bug" })).toBeFocused();

  const panel = page.locator(".kit-filter-dropdown__panel");
  const panelBox = (await panel.boundingBox())!;
  const flyoutBox = (await flyout.boundingBox())!;
  expect(flyoutBox.x).toBeGreaterThanOrEqual(panelBox.x + panelBox.width);

  await flyout.getByRole("button", { name: "docs" }).click();
  await expect(page.getByTestId("filter-submenu-picked")).toHaveText("picked: docs");
  await expect(flyout).toBeVisible();
  await expect(row).toContainText("1 selected");

  await page.keyboard.press("Escape");
  await expect(flyout).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(row).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(flyout).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(flyout).toBeHidden();
  await expect(row).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("a submenu flyout flips left when the right side is too narrow", async ({ page }) => {
  await gotoPage(page, "filter-dropdown");
  const trigger = page.getByRole("button", { name: "Filters" });
  await trigger.evaluate((el) => {
    const host = el.closest<HTMLElement>(".kit-filter-dropdown")!;
    host.style.position = "fixed";
    host.style.right = "8px";
    host.style.top = "80px";
  });
  await trigger.click();
  await page.getByRole("button", { name: /Labels/ }).click();

  const panelBox = (await page.locator(".kit-filter-dropdown__panel").boundingBox())!;
  const flyoutBox = (await page.getByRole("dialog", { name: "Labels" }).boundingBox())!;
  expect(flyoutBox.x + flyoutBox.width).toBeLessThanOrEqual(panelBox.x);
});
