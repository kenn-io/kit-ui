import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Typeahead acceptance (docs/components/typeahead.md): the ry18 extensions
// (clear row, custom values, meta search, veto/error, header snippet,
// loading row, forced placement) and the t662 grouped-option tree.

test("filters, highlights matches, and selects", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter repositories…" }).click();

  const input = page.getByRole("combobox", { name: "Filter repositories…" });
  await expect(input).toBeFocused();
  await input.fill("agents");
  await expect(page.locator(".kit-typeahead__match")).toHaveText("agents");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="repo-value"]')).toHaveText("kenn-io/agentsview");
});

test("remote mode reports queries without filtering caller-supplied options", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Search remote options…" }).click();

  const input = page.getByRole("combobox", { name: "Search remote options…" });
  await expect(page.locator('[data-demo="remote-query"]')).toHaveText("(empty)");
  await input.fill("does not match the result");
  await expect(page.locator('[data-demo="remote-query"]')).toHaveText("does not match the result");
  await expect(page.getByRole("option", { name: "Server result" })).toBeVisible();

  await page.getByRole("option", { name: "Server result" }).click();
  await expect(page.locator('[data-demo="remote-value"]')).toHaveText("server-result");
  await expect(page.locator('[data-demo="remote-query"]')).toHaveText("(empty)");
});

test("clear row selects the empty value and meta text is searched", async ({ page }) => {
  await gotoPage(page, "typeahead");
  const trigger = page.getByRole("button", { name: /^owner:/ });
  await trigger.click();

  // Meta ("on leave") is searched; the matching row is dana's.
  await page.getByRole("combobox", { name: "Filter owners…" }).fill("leave");
  const options = page.locator(".kit-typeahead__option");
  // The clear row stays put above the single meta match.
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveText("None");
  await options.nth(1).click();
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("dana");

  await trigger.click();
  await page.locator(".kit-typeahead__option", { hasText: "None" }).click();
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("(none)");
});

test("a custom value renders as a real row that Enter commits", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: /^owner:/ }).click();
  const input = page.getByRole("combobox", { name: "Filter owners…" });
  await input.fill("someone-new");

  // The custom value is a highlighted row named by aria-activedescendant —
  // Enter commits exactly what a screen reader hears as active, never a
  // hidden fallback.
  const customRow = page.locator(".kit-typeahead__option", { hasText: 'Use "someone-new"' });
  await expect(customRow).toBeVisible();
  const activeId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${activeId}"]`)).toContainText('Use "someone-new"');
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("someone-new");
});

test("Enter honors a deliberately highlighted clear row while filtering", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: /^owner:/ }).click();
  const input = page.getByRole("combobox", { name: "Filter owners…" });
  await input.fill("dana");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("dana");

  // ArrowUp from the first match onto the clear row: the active descendant
  // says "None", so Enter must clear — not select the match below it.
  await page.getByRole("button", { name: /^owner:/ }).click();
  await input.fill("dana");
  await page.keyboard.press("ArrowUp");
  const activeId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${activeId}"]`)).toHaveText("None");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("(none)");
});

test("a vetoed selection keeps the list open and shows the error row", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter branches…" }).click();
  await page.locator(".kit-typeahead__option", { hasText: "locked/prod" }).click();

  await expect(page.locator(".kit-typeahead__status--error")).toHaveText("That branch is locked");
  await expect(page.getByRole("combobox", { name: "Filter branches…" })).toBeVisible();
  await expect(page.locator('[data-demo="branch-value"]')).toHaveText("main");

  // The error row is announced (role=alert) but does not stand in for the
  // options: they stay selectable so the user can retry, which is where the
  // caller clears the error.
  await expect(page.locator(".kit-typeahead__status--error")).toHaveAttribute("role", "alert");
  const release = page.locator(".kit-typeahead__option", { hasText: "release" });
  await expect(release).toBeVisible();
  await release.click();
  await expect(page.locator('[data-demo="branch-value"]')).toHaveText("release");
  await expect(page.locator(".kit-typeahead__status--error")).toHaveCount(0);
});

test("tabbing out of a focusable header control dismisses the panel", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter refs…" }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();

  // Focus the header tab (inside the panel) then tab away — focusout on the
  // container must close the panel even though blur was on the header button.
  await page.locator('[data-demo="ref-tabs"] button', { hasText: "Branches" }).focus();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect(page.locator(".kit-typeahead__panel")).toHaveCount(0);
});

test("Escape inside a header control closes the panel and refocuses the trigger", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter refs…" }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();

  // Escape must work from any focused descendant, not just the input, and
  // must hand focus back to the trigger instead of dropping it on <body>.
  await page.locator('[data-demo="ref-tabs"] button', { hasText: "Branches" }).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".kit-typeahead__panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filter refs…" })).toBeFocused();
});

test("groups expand and collapse by mouse and keyboard", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter grouped repos…" }).click();

  const input = page.getByRole("combobox", { name: "Filter grouped repos…" });
  const listId = await input.getAttribute("aria-controls");
  await expect(page.locator(`[id="${listId}"]`)).toHaveAttribute("role", "tree");

  // gitlab.com starts collapsed (expanded: false); its leaf is hidden.
  const mirror = page.locator(".kit-typeahead__option", { hasText: "kenn-io/mirror" });
  await expect(mirror).toHaveCount(0);
  const gitlab = page.locator(".kit-typeahead__option--group", { hasText: "gitlab.com" });
  await expect(gitlab).toHaveAttribute("aria-expanded", "false");
  await gitlab.click();
  await expect(gitlab).toHaveAttribute("aria-expanded", "true");
  await expect(mirror).toBeVisible();

  // Keyboard: hovering moves the highlight (the click above parked it on
  // gitlab.com), so point it at github.com first. ArrowLeft collapses the
  // expanded group, ArrowRight reopens it, ArrowDown then ArrowLeft from a
  // leaf jumps back to the parent group.
  const github = page.locator(".kit-typeahead__option--group", { hasText: "github.com" });
  await expect(github).toHaveAttribute("aria-expanded", "true");
  await github.hover();
  await page.keyboard.press("ArrowLeft");
  await expect(github).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.locator(".kit-typeahead__option", { hasText: "kenn-io/middleman" }),
  ).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(github).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("ArrowDown");
  const leafId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${leafId}"]`)).toContainText("kenn-io/middleman");
  await page.keyboard.press("ArrowLeft");
  const parentId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${parentId}"]`)).toContainText("github.com");

  // Selecting a leaf closes and reports the value.
  await mirror.click();
  await expect(page.locator('[data-demo="grouped-value"]')).toHaveText("gitlab.com/kenn-io/mirror");
});

test("filtering forces groups open and keeps matching subtrees", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter grouped repos…" }).click();
  await page.getByRole("combobox", { name: "Filter grouped repos…" }).fill("mirror");

  const options = page.locator(".kit-typeahead__option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toContainText("gitlab.com");
  await expect(options.nth(1)).toContainText("kenn-io/mirror");
});

test("header snippet drives the option source through the loading row", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter refs…" }).click();

  // placement="top": the panel sits above the trigger.
  const input = page.getByRole("combobox", { name: "Filter refs…" });
  const panel = page.locator(".kit-typeahead__panel");
  const inputBox = (await input.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(inputBox.y + 1);

  await expect(page.locator(".kit-typeahead__option", { hasText: "main" })).toBeVisible();
  await page.locator('[data-demo="ref-tabs"] button', { hasText: "Tags" }).click();
  await expect(page.locator(".kit-typeahead__status")).toHaveText("Loading…");
  const tag = page.locator(".kit-typeahead__option", { hasText: "v1.0.0" });
  await expect(tag).toBeVisible();
  await tag.click();
  await expect(page.locator('[data-demo="ref-value"]')).toHaveText("v1.0.0");
});
