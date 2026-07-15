import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("forced overlay styles do not leak into nested sidebars", async ({ page }) => {
  await gotoPage(page, "sidebar");

  await page.getByLabel(/Force overlay/).check();
  const overlayLayout = page.locator(".sidebar-host--overlay .kit-sidebar-layout").first();
  await expect(overlayLayout).toHaveClass(/kit-sidebar-layout--overlay/);

  await page.evaluate(() => {
    const source = document.querySelector(
      ".sidebar-host:not(.sidebar-host--overlay) .kit-sidebar-layout",
    );
    const overlaySidebar = document.querySelector(
      ".sidebar-host--overlay .kit-sidebar-layout--overlay > .kit-sidebar-layout__sidebar",
    );
    if (!(source instanceof HTMLElement) || !(overlaySidebar instanceof HTMLElement)) {
      throw new Error("Sidebar demo markup not found");
    }

    const nested = source.cloneNode(true) as HTMLElement;
    nested.dataset.testid = "nested-sidebar";
    nested.style.width = "500px";
    overlaySidebar.appendChild(nested);
  });

  const outerSidebar = page
    .locator(".sidebar-host--overlay .kit-sidebar-layout--overlay > .kit-sidebar-layout__sidebar")
    .first();
  const nestedSidebar = page
    .locator('[data-testid="nested-sidebar"] > .kit-sidebar-layout__sidebar')
    .first();

  await expect(outerSidebar).toHaveCSS("position", "absolute");
  await expect(outerSidebar).toHaveCSS("width", "390px");
  await expect(nestedSidebar).toHaveCSS("position", "static");
  await expect(nestedSidebar).toHaveCSS("width", "220px");
});

test("resize separator reports the sidebar width and bounds", async ({ page }) => {
  await gotoPage(page, "sidebar");

  const separator = page.getByRole("separator", { name: "Resize sidebar" }).first();
  await expect(separator).toHaveAttribute("aria-valuemin", "160");
  await expect(separator).toHaveAttribute("aria-valuemax", "360");
  await expect(separator).toHaveAttribute("aria-valuenow", "220");
});
