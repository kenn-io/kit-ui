import { expect, test } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme } from "./helpers.js";

// Transient surfaces share one chrome: the --shadow-lg lift, and in dark a
// lighter raised popover surface with a lighter edge, since a shadow alone
// barely shows on the near-black page.

test("dark popovers sit on a lighter surface with a lighter edge", async ({ page }) => {
  await gotoPage(page, "date-range-picker");
  await setTheme(page, { dark: true });
  await page.locator(".kit-date-range-picker__trigger").first().click();
  const panel = page.locator(".kit-popover-card").first();
  await expect(panel).toBeVisible();

  const surface = await resolvedStyle(page, "background-color", "var(--bg-surface)");
  const popover = await resolvedStyle(page, "background-color", "var(--bg-popover)");
  expect(popover).not.toBe(surface);
  await expect(panel).toHaveCSS("background-color", popover);
  await expect(panel).toHaveCSS(
    "border-top-color",
    await resolvedStyle(page, "border-top-color", "var(--border-popover)"),
  );
  await expect(panel).toHaveCSS(
    "box-shadow",
    await resolvedStyle(page, "box-shadow", "var(--shadow-lg)"),
  );
});

test("light popovers stay on the plain surface", async ({ page }) => {
  await gotoPage(page, "date-range-picker");
  await setTheme(page, { dark: false });
  await page.locator(".kit-date-range-picker__trigger").first().click();
  const panel = page.locator(".kit-popover-card").first();
  await expect(panel).toHaveCSS(
    "background-color",
    await resolvedStyle(page, "background-color", "var(--bg-surface)"),
  );
});

test("a modal lifts like a popover and its panel shows no focus ring", async ({ page }) => {
  await gotoPage(page, "modal");
  await page.getByRole("button", { name: "Open modal", exact: true }).focus();
  await page.keyboard.press("Enter");
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS(
    "box-shadow",
    await resolvedStyle(page, "box-shadow", "var(--shadow-lg)"),
  );
  await panel.focus();
  await expect(panel).toHaveCSS("outline-style", "none");
});
