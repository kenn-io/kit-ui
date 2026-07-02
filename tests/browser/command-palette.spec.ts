import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// CommandPalette acceptance (docs/components/command-palette.md):
// combobox ARIA state, disabled-skip highlighting, Escape semantics,
// scope suspension, all-disabled inertness.

test("combobox wiring announces the highlighted option", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();

  const input = page.locator(".kit-command-palette input");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("role", "combobox");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  const listboxId = await input.getAttribute("aria-controls");
  expect(listboxId).toBeTruthy();
  await expect(page.locator(`[id="${listboxId}"]`)).toHaveAttribute("role", "listbox");

  // Arrow navigation moves aria-activedescendant to the selected option.
  const before = await input.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  const after = await input.getAttribute("aria-activedescendant");
  expect(after).not.toBe(before);
  await expect(page.locator(`[id="${after}"]`)).toHaveAttribute("aria-selected", "true");
});

test("filtering skips a disabled first result and Enter runs the highlight", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.locator(".kit-command-palette input");

  // "arch" matches disabled "Archive session" (prefix) then "Find session…".
  await input.fill("arch");
  const options = page.locator(".kit-command-palette__option");
  await expect(options.first()).toHaveAttribute("aria-disabled", "true");
  await expect(options.first()).toHaveAttribute("aria-selected", "false");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-command-palette")).not.toBeVisible();
  await expect(page.locator(".kit-flash-banner")).toContainText("Find session");
});

test("Escape clears the query first, then closes; page shortcuts are suspended while open", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  const readout = page.locator(".readout code").nth(1);

  // Page-level "g" shortcut works while the palette is closed.
  await page.keyboard.press("g");
  await expect(readout).toHaveText("1");

  // "mod+k" resolves to ⌘ on Mac and Ctrl elsewhere — mirror it.
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.locator(".kit-command-palette");
  await expect(palette).toBeVisible();

  // While open, "g" goes to the query, not the page shortcut.
  await page.keyboard.press("g");
  await expect(readout).toHaveText("1");

  const input = page.locator(".kit-command-palette input");
  await expect(input).toHaveValue("g");

  await page.keyboard.press("Escape"); // clears
  await expect(input).toHaveValue("");
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape"); // closes
  await expect(palette).not.toBeVisible();

  // Scope popped — the page shortcut resumes.
  await page.keyboard.press("g");
  await expect(readout).toHaveText("2");
});

test("no matches leaves Enter inert and shows the empty label", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.locator(".kit-command-palette input");
  await input.fill("zzzzz");
  await expect(page.locator(".kit-command-palette__empty")).toBeVisible();
  await expect(input).not.toHaveAttribute("aria-activedescendant", /./);
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-command-palette")).toBeVisible(); // nothing ran
});

test("an all-disabled result set leaves Enter inert with no active descendant", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.locator(".kit-command-palette input");

  // "archive" matches only the disabled "Archive session" command.
  await input.fill("archive");
  const options = page.locator(".kit-command-palette__option");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAttribute("aria-disabled", "true");
  await expect(input).not.toHaveAttribute("aria-activedescendant", /./);

  // Enter and arrows have no runnable target — the palette stays open
  // and nothing runs.
  await page.keyboard.press("ArrowDown");
  await expect(input).not.toHaveAttribute("aria-activedescendant", /./);
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-command-palette")).toBeVisible();
  await expect(page.locator(".kit-flash-banner")).toHaveCount(0);
});
