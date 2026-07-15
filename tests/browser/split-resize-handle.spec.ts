import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("resizes horizontal and vertical panes on their active axes", async ({ page }) => {
  await gotoPage(page, "split-resize");

  const horizontal = page.getByRole("separator", { name: "Resize left pane" });
  await expect(horizontal).toHaveAttribute("aria-orientation", "vertical");
  await expect(horizontal).toHaveCSS("cursor", "col-resize");
  await horizontal.focus();
  await page.keyboard.press("ArrowRight");
  await expect(horizontal).toHaveAttribute("aria-valuenow", "224");
  await page.keyboard.press("ArrowDown");
  await expect(horizontal).toHaveAttribute("aria-valuenow", "224");

  const vertical = page.getByRole("separator", { name: "Resize top pane" });
  await expect(vertical).toHaveAttribute("aria-orientation", "horizontal");
  await expect(vertical).toHaveCSS("cursor", "row-resize");
  await vertical.focus();
  await page.keyboard.press("ArrowDown");
  await expect(vertical).toHaveAttribute("aria-valuenow", "112");
  await page.keyboard.press("ArrowRight");
  await expect(vertical).toHaveAttribute("aria-valuenow", "112");

  const box = await vertical.boundingBox();
  if (!box) throw new Error("Vertical split handle is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 24);
  await page.mouse.up();
  await expect(vertical).toHaveAttribute("aria-valuenow", "136");
});
