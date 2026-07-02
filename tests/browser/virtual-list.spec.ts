import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// VirtualList acceptance (docs/components/virtual-list.md): windowing,
// container-owned keyboard nav with aria-activedescendant, Enter
// activation, and scrollToIndex over measured variable heights.

test("windows 10k rows and navigates from the container", async ({ page }) => {
  await gotoPage(page, "virtual-list");
  const list = page.locator(".kit-virtual-list");
  const rows = page.locator(".kit-virtual-list__row");

  // Only the window (plus overscan) is in the DOM.
  const rendered = await rows.count();
  expect(rendered).toBeGreaterThan(3);
  expect(rendered).toBeLessThan(60);

  await list.focus();
  await page.keyboard.press("ArrowDown");
  await expect(list).toHaveAttribute("aria-activedescendant", /-row-0$/);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const active = await list.getAttribute("aria-activedescendant");
  expect(active).toMatch(/-row-2$/);
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute("aria-selected", "true");

  // Enter activates the active row (demo flashes the title).
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-flash-banner")).toContainText("Opened Session #2");

  // End jumps to the last row and keeps it rendered + announced.
  await page.keyboard.press("End");
  await expect(list).toHaveAttribute("aria-activedescendant", /-row-9999$/);
  await expect(page.locator(".kit-virtual-list__row[aria-selected='true']")).toContainText(
    "Session #9999",
  );
});

test("scrollToIndex reaches deep rows with measured heights", async ({ page }) => {
  await gotoPage(page, "virtual-list");
  await page.locator('input[type="number"]').fill("5000");
  await page.getByRole("button", { name: "scrollToIndex" }).click();
  await expect(page.locator(".kit-virtual-list")).toContainText("Session #5000");
});

test("mount-time initial activeIndex renders and announces after measurement", async ({ page }) => {
  await gotoPage(page, "virtual-list");
  // The list mounts with activeIndex=500, far outside the first slice —
  // the scroll must defer until ResizeObserver measures the viewport,
  // then leave the row rendered, selected, and announced.
  await page.getByRole("button", { name: "Mount with active row #500" }).click();
  const list = page.locator('.kit-virtual-list[aria-label="Restored selection"]');
  await expect(list).toHaveAttribute("aria-activedescendant", /-row-500$/);
  const activeRow = list.locator(".kit-virtual-list__row[aria-selected='true']");
  await expect(activeRow).toContainText("Session #500");
  // Scrolled within the list's own scroll container (the page viewport
  // is irrelevant — the demo section may sit below the fold).
  await expect
    .poll(() =>
      activeRow.evaluate((row) => {
        const container = row.closest(".kit-virtual-list")!;
        const rowBox = row.getBoundingClientRect();
        const box = container.getBoundingClientRect();
        return rowBox.bottom > box.top && rowBox.top < box.bottom;
      }),
    )
    .toBe(true);
});

test("keys typed into nested demo controls are not stolen", async ({ page }) => {
  await gotoPage(page, "virtual-list");
  const jump = page.locator('input[type="number"]');
  await jump.fill("123");
  // Arrow keys in the number input must not move the list's active row.
  await jump.press("ArrowDown");
  await expect(page.locator(".kit-virtual-list")).not.toHaveAttribute("aria-activedescendant", /./);
});
