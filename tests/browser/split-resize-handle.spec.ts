import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("resizes horizontal and vertical panes on their active axes", async ({ page }) => {
  await gotoPage(page, "split-resize");

  const horizontal = page.getByRole("separator", { name: "Resize left pane" });
  await expect(horizontal).toHaveAttribute("aria-orientation", "vertical");
  await expect(horizontal).toHaveCSS("cursor", "col-resize");
  await expect(horizontal).toHaveCSS("touch-action", "pan-y");
  await horizontal.focus();
  await page.keyboard.press("ArrowRight");
  await expect(horizontal).toHaveAttribute("aria-valuenow", "224");
  await page.keyboard.press("ArrowDown");
  await expect(horizontal).toHaveAttribute("aria-valuenow", "224");

  const horizontalBox = await horizontal.boundingBox();
  if (!horizontalBox) throw new Error("Horizontal split handle is not visible");
  await page.mouse.move(
    horizontalBox.x + horizontalBox.width / 2,
    horizontalBox.y + horizontalBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    horizontalBox.x + horizontalBox.width / 2 + 24,
    horizontalBox.y + horizontalBox.height / 2,
  );
  await page.mouse.up();
  await expect(horizontal).toHaveAttribute("aria-valuenow", "248");

  const vertical = page.getByRole("separator", { name: "Resize top pane" });
  await expect(vertical).toHaveAttribute("aria-orientation", "horizontal");
  await expect(vertical).toHaveCSS("cursor", "row-resize");
  await expect(vertical).toHaveCSS("touch-action", "pan-x");
  await vertical.focus();
  await page.keyboard.press("ArrowDown");
  await expect(vertical).toHaveAttribute("aria-valuenow", "112");
  await page.keyboard.press("ArrowRight");
  await expect(vertical).toHaveAttribute("aria-valuenow", "112");

  await vertical.hover();
  const box = await vertical.boundingBox();
  if (!box) throw new Error("Vertical split handle is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 24);
  await page.mouse.up();
  await expect(vertical).toHaveAttribute("aria-valuenow", "136");
});

test("ignores non-primary pointer buttons", async ({ page }) => {
  await gotoPage(page, "split-resize");

  const vertical = page.getByRole("separator", { name: "Resize top pane" });
  const box = await vertical.boundingBox();
  if (!box) throw new Error("Vertical split handle is not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  for (const button of ["right", "middle"] as const) {
    await page.mouse.move(x, y);
    await page.mouse.down({ button });
    await page.mouse.move(x, y + 24);
    await page.mouse.up({ button });
    await expect(vertical).toHaveAttribute("aria-valuenow", "88");
  }
});

test("keeps one active pointer and commits the last valid delta on cancellation", async ({
  page,
}) => {
  await gotoPage(page, "split-resize");

  const vertical = page.getByRole("separator", { name: "Resize top pane" });
  const box = await vertical.boundingBox();
  if (!box) throw new Error("Vertical split handle is not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await vertical.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    isPrimary: false,
    clientX: x,
    clientY: y,
  });
  await page.mouse.move(x, y + 24);
  await vertical.dispatchEvent("pointercancel", {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    clientX: x,
    clientY: y + 96,
  });
  await page.mouse.up();

  await expect(vertical).toHaveAttribute("aria-valuenow", "112");
});

test("ends the active resize when pointer capture is lost", async ({ page }) => {
  await gotoPage(page, "split-resize");

  const vertical = page.getByRole("separator", { name: "Resize top pane" });
  const box = await vertical.boundingBox();
  if (!box) throw new Error("Vertical split handle is not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 24);
  await vertical.evaluate((element) => {
    const handle = element as HTMLButtonElement;
    if (!handle.hasPointerCapture(1)) throw new Error("Expected pointer capture");
    handle.releasePointerCapture(1);
  });
  await page.mouse.move(x + 100, y + 100);
  await page.mouse.up();
  await expect(vertical).toHaveAttribute("aria-valuenow", "112");

  const resizedBox = await vertical.boundingBox();
  if (!resizedBox) throw new Error("Vertical split handle is not visible after capture loss");
  await page.mouse.move(resizedBox.x + resizedBox.width / 2, resizedBox.y + resizedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    resizedBox.x + resizedBox.width / 2,
    resizedBox.y + resizedBox.height / 2 + 24,
  );
  await page.mouse.up();
  await expect(vertical).toHaveAttribute("aria-valuenow", "136");
});
