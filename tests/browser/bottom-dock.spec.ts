import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

async function renderedHeight(locator: Locator): Promise<number> {
  return locator.evaluate((element) => Math.round(element.getBoundingClientRect().height));
}

async function dragSeparator(page: Page, separator: Locator, deltaY: number): Promise<void> {
  const box = await separator.boundingBox();
  if (!box) throw new Error("Bottom dock resize handle is not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + deltaY);
  await page.mouse.up();
}

test("renders and resizes a controlled inline bottom dock", async ({ page }) => {
  await gotoPage(page, "bottom-dock");

  const dock = page.getByRole("region", { name: "Review details" });
  const separator = page.getByRole("separator", { name: "Review details" });
  const body = dock.locator(".kit-bottom-dock__body");

  await expect(dock).toBeVisible();
  await expect(dock).toHaveCSS("position", "static");
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  await expect(separator).toHaveAttribute("aria-valuenow", "260");
  await expect(page.getByText("Workspace content")).toBeVisible();
  await expect(page.getByText("Review body item 20")).toBeAttached();
  await expect(page.getByText("Ready to merge")).toBeVisible();

  await separator.focus();
  await page.keyboard.press("ArrowUp");
  await expect(separator).toHaveAttribute("aria-valuenow", "284");
  await page.keyboard.press("ArrowDown");
  await expect(separator).toHaveAttribute("aria-valuenow", "260");

  await page.keyboard.press("Escape");
  await expect(dock).toBeVisible();

  await dragSeparator(page, separator, -40);
  await expect.poll(() => renderedHeight(dock)).toBe(300);

  await dragSeparator(page, separator, -200);
  await expect.poll(() => renderedHeight(dock)).toBe(360);

  await dragSeparator(page, separator, 400);
  await expect.poll(() => renderedHeight(dock)).toBe(180);

  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(dock).not.toBeAttached();
  await page.getByRole("button", { name: "Open dock" }).click();
  await expect(dock).toBeVisible();
  await expect.poll(() => renderedHeight(dock)).toBe(180);
});
