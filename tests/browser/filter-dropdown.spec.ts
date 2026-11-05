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
  // A submenu row is navigation, not an unselected option, so it is never dimmed.
  await expect(row).toHaveCSS("opacity", "1");

  await row.click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  await expect(flyout).toBeVisible();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(flyout.getByRole("button", { name: "bug" })).toBeFocused();

  const panel = page.locator(".kit-filter-dropdown__panel");
  const panelBox = (await panel.boundingBox())!;
  const flyoutBox = (await flyout.boundingBox())!;
  // The flyout's border overlaps the panel's, and its top lines up with the row.
  expect(flyoutBox.x).toBe(panelBox.x + panelBox.width - 1);
  const rowBox = (await row.boundingBox())!;
  expect(Math.abs(flyoutBox.y - (rowBox.y - 4))).toBeLessThanOrEqual(1);
  // With the pointer away from the row, the open row keeps its fill.
  await page.mouse.move(flyoutBox.x + 20, flyoutBox.y + 40);
  await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await flyout.getByRole("button", { name: "docs" }).click();
  await expect(page.getByTestId("filter-submenu-picked")).toHaveText("picked: docs");
  await expect(flyout).toBeVisible();
  await expect(row).toContainText("1 selected");

  // Content that claims Escape first (a search field clearing itself) keeps the flyout open.
  await flyout.getByRole("button", { name: "bug" }).evaluate((el) => {
    el.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
  });
  await flyout.getByRole("button", { name: "bug" }).press("Escape");
  await expect(flyout).toBeVisible();

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
  expect(flyoutBox.x + flyoutBox.width).toBe(panelBox.x + 1);
});
