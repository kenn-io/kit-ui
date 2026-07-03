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

test("Enter submits a custom value when nothing matches", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: /^owner:/ }).click();
  await page.getByRole("combobox", { name: "Filter owners…" }).fill("someone-new");
  await expect(page.locator(".kit-typeahead__empty")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("someone-new");
});

test("a vetoed selection keeps the list open and shows the error row", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter branches…" }).click();
  await page.locator(".kit-typeahead__option", { hasText: "locked/prod" }).click();

  await expect(page.locator(".kit-typeahead__status--error")).toHaveText("That branch is locked");
  await expect(page.getByRole("combobox", { name: "Filter branches…" })).toBeVisible();
  await expect(page.locator('[data-demo="branch-value"]')).toHaveText("main");
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
