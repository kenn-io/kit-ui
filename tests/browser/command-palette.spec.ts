import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// CommandPalette acceptance (docs/components/command-palette.md):
// combobox ARIA state, disabled-skip highlighting, Escape semantics,
// scope suspension, all-disabled inertness.

test("a resting pointer does not highlight a command", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.locator(".kit-command-palette");
  const later = page.getByRole("option", { name: "Find session…", exact: true });
  const bounds = await later.boundingBox();
  expect(bounds).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(palette).not.toBeVisible();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("option", { name: /^New session/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(later).toHaveAttribute("aria-selected", "false");
});

test("pointer movement highlights a command and reopening resets the highlight", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  await page.keyboard.press("ControlOrMeta+k");
  const later = page.getByRole("option", { name: "Find session…", exact: true });
  await later.hover();
  await expect(later).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".kit-command-palette")).not.toBeVisible();
  await page.mouse.move(0, 0);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("option", { name: /^New session/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

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

test("a no-match fallback is active and runs with trimmed text", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("checkbox", { name: "Fallback commands" }).check();
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.getByRole("combobox", { name: "Command palette" });
  await input.fill("  zzzxxyy  ");
  const fallback = page.getByRole("option", { name: 'Search for "zzzxxyy" ↵' });
  await expect(fallback).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    (await fallback.getAttribute("id"))!,
  );
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-flash-banner")).toHaveText('Searched for "zzzxxyy"');
  await page.getByRole("button", { name: /Open palette/ }).click();
  await expect(input).toHaveValue("");
});

test("matches are bold and trailing fallback rows stay plain and navigable", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("checkbox", { name: "Fallback commands" }).check();
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.getByRole("combobox", { name: "Command palette" });
  await input.fill("  tHeMe  ");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.first().locator("mark")).toHaveText("theme");
  await expect(options.last()).toContainText('Search for "tHeMe"');
  await expect(options.last().locator("mark")).toHaveCount(0);
  await expect(page.locator(".kit-command-palette__section")).toHaveText(["View", "Search"]);
  await page.keyboard.press("ArrowDown");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await input.fill("metrics");
  await expect(options.first()).toHaveText("Go to Usage");
  await expect(options.first().locator("mark")).toHaveCount(0);
});

test("a preset query filters on open and clear keeps focus", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: "Search theme" }).click();
  const input = page.getByRole("combobox", { name: "Command palette" });
  await expect(input).toHaveValue("theme");
  await expect(input).toBeFocused();
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toContainText("Toggle theme");
  await page.locator(".kit-command-palette").getByRole("button", { name: "Clear search" }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(page.getByRole("option")).toHaveCount(8);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Open palette/ }).click();
  await expect(input).toHaveValue("");
});

test("fallbacks skip matched ids, follow every section, and skip disabled rows", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  await page.evaluate(async () => {
    const [{ mount }, { default: CommandPalette }] = await Promise.all([
      import("/node_modules/.vite/deps/svelte.js"),
      import("/src/lib/components/CommandPalette.svelte"),
    ]);
    const target = document.createElement("div");
    document.body.append(target);
    mount(CommandPalette, {
      target,
      props: {
        open: true,
        initialQuery: "theme",
        commands: [
          { id: "one", label: "Theme one", section: "First" },
          { id: "two", label: "Theme two", section: "Second" },
        ],
        fallbacks: () => [
          { id: "one", label: "Duplicate" },
          { id: "disabled", label: "Disabled fallback", section: "First", disabled: true },
          { id: "search", label: "Search theme", section: "First" },
        ],
        onrun: (command, query) => {
          target.dataset.ran = `${command.id}:${query}`;
        },
      },
    });
    target.dataset.testid = "mounted-palette";
  });
  const options = page.getByRole("option");
  await expect(options).toHaveText(["Theme one", "Theme two", "Disabled fallback", "Search theme"]);
  await expect(page.locator(".kit-command-palette__section")).toHaveText([
    "First",
    "Second",
    "First",
  ]);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("mounted-palette")).toHaveAttribute("data-ran", "search:theme");
});
