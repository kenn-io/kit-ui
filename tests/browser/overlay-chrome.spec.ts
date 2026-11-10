import { expect, test } from "@playwright/test";
import { gotoPage, luminanceOf, resolvedStyle, setTheme } from "./helpers.js";

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

// The page's dark hover fill is darker than the popover surface, so a
// popover takes its own hover fill. Hover lightens everywhere in dark.
for (const highContrast of [false, true]) {
  test(`a hovered row in a dark popover is lighter than the popover${
    highContrast ? " in high contrast" : ""
  }`, async ({ page }) => {
    await gotoPage(page, "select-dropdown");
    await setTheme(page, { dark: true, highContrast });
    await page.locator(".kit-select-dropdown__trigger").first().click();
    const panel = page.locator(".kit-popover-card").first();
    await expect(panel).toBeVisible();
    const row = panel.locator(".kit-select-dropdown__option:not(.selected)").first();
    const resting = (await luminanceOf(row)).background;
    expect(resting).toBe((await luminanceOf(panel)).background);

    await row.hover();
    await expect
      .poll(async () => (await luminanceOf(row)).background)
      .toBeGreaterThan(resting + 0.01);

    // A well inside the popover stays darker than the popover.
    await panel.evaluate((el) => {
      const well = document.createElement("span");
      well.dataset.testWellProbe = "";
      well.style.background = "var(--bg-inset)";
      el.append(well);
    });
    const well = (await luminanceOf(panel.locator("[data-test-well-probe]"))).background;
    expect(well).toBeLessThan((await luminanceOf(panel)).background);
  });
}

test("a dark modal sits on the popover surface with the popover edge", async ({ page }) => {
  await gotoPage(page, "modal");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Open modal", exact: true }).click();
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();

  const popover = await resolvedStyle(page, "background-color", "var(--bg-popover)");
  expect(popover).not.toBe(await resolvedStyle(page, "background-color", "var(--bg-surface)"));
  await expect(panel).toHaveCSS("background-color", popover);
  const edge = await resolvedStyle(page, "border-top-color", "var(--border-popover)");
  await expect(panel).toHaveCSS("border-top-color", edge);
  // The header band draws over the panel's border, so it carries the same edge.
  await expect(panel.locator(".kit-modal-header")).toHaveCSS("border-top-color", edge);
});

test("a toned header band tints a dark modal's surface, not the darker page surface", async ({
  page,
}) => {
  await gotoPage(page, "modal");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Delete…", exact: true }).click();
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();
  const band = (await luminanceOf(panel.locator(".kit-modal-header"))).background;
  expect(band).toBeGreaterThan((await luminanceOf(panel)).background);
});

test("a hovered control in a dark modal is lighter than the modal", async ({ page }) => {
  await gotoPage(page, "modal");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Open modal", exact: true }).click();
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();
  await panel.evaluate((el) => {
    const hover = document.createElement("span");
    hover.dataset.testHoverProbe = "";
    hover.style.background = "var(--bg-surface-hover)";
    el.append(hover);
  });
  const hover = (await luminanceOf(panel.locator("[data-test-hover-probe]"))).background;
  expect(hover).toBeGreaterThan((await luminanceOf(panel)).background);
});
