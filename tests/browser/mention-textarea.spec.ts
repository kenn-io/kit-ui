import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// MentionTextarea acceptance (docs/components/mention-textarea.md): trigger
// detection at word boundaries, async search states, the keyboard protocol,
// insert-on-select with caret placement, and custom trigger/row rendering.

test("# at a word boundary opens the menu and Enter inserts the reference", async ({ page }) => {
  await gotoPage(page, "mention-textarea");
  const textarea = page.getByRole("textbox", { name: "Task description" });

  await textarea.pressSequentially("see #");
  const menu = page.locator(".kit-mention__menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".kit-mention__option")).toHaveCount(5);

  await textarea.pressSequentially("ry");
  const options = menu.locator(".kit-mention__option");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("#ry18");
  await page.keyboard.press("Enter");

  await expect(menu).not.toBeVisible();
  await expect(page.locator('[data-demo="mention-value"]')).toHaveText("see #ry18 ");
  // Caret sits right after the inserted reference.
  expect(await textarea.evaluate((el) => (el as HTMLTextAreaElement).selectionStart)).toBe(
    "see #ry18 ".length,
  );
});

test("keyboard protocol: arrows cycle, Tab inserts, Escape dismisses", async ({ page }) => {
  await gotoPage(page, "mention-textarea");
  const textarea = page.getByRole("textbox", { name: "Task description" });

  await textarea.pressSequentially("#");
  const options = page.locator(".kit-mention__option");
  await expect(options).toHaveCount(5);
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  // Cycles: ArrowUp from the top wraps to the last row.
  await expect(options.nth(4)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Escape");
  await expect(page.locator(".kit-mention__menu")).not.toBeVisible();

  // "y1" matches #y1v0 and #ry18; the first (and highlighted) row is y1v0.
  await textarea.pressSequentially("y1");
  await expect(page.locator(".kit-mention__option")).toHaveCount(2);
  await expect(page.locator(".kit-mention__option").first()).toContainText("#y1v0");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-demo="mention-value"]')).toHaveText("#y1v0 ");
});

test("vertical caret movement keeps the menu in sync in multiline text", async ({ page }) => {
  await gotoPage(page, "mention-textarea");
  const textarea = page.getByRole("textbox", { name: "Task description" });
  const menu = page.locator(".kit-mention__menu");

  // Line 1 holds a mention query; Escape dismisses the menu so Enter can type
  // a newline and leave the caret on a plain second line.
  await textarea.pressSequentially("#ry");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await textarea.pressSequentially("\nplain");
  await expect(menu).not.toBeVisible();

  // ArrowUp moves the caret to the end of "#ry": the menu must reopen there.
  await page.keyboard.press("ArrowUp");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".kit-mention__option")).toContainText(["#ry18"]);

  // With no matches the menu doesn't consume ArrowUp, so the caret leaves the
  // query line and the popup must close instead of tracking a dead position.
  await page.keyboard.press("Escape");
  await textarea.fill("");
  await textarea.pressSequentially("x\n#zz");
  await expect(menu.locator(".kit-mention__status")).toHaveText("No matches");
  await page.keyboard.press("ArrowUp");
  await expect(menu).not.toBeVisible();
});

test("a trigger inside a word does not open the menu", async ({ page }) => {
  await gotoPage(page, "mention-textarea");
  const textarea = page.getByRole("textbox", { name: "Task description" });

  await textarea.pressSequentially("issue#12");
  await expect(page.locator(".kit-mention__menu")).toHaveCount(0);
});

test("a pending search cannot insert a stale option", async ({ page }) => {
  await gotoPage(page, "mention-textarea");
  const textarea = page.getByRole("textbox", { name: "Task description" });

  // Load results for "#", then change the query. The previous results must be
  // dropped up front so a fast Enter during the (150ms) pending window can't
  // insert a reference from the prior query.
  await textarea.pressSequentially("#");
  await expect(page.locator(".kit-mention__option")).toHaveCount(5);
  await page.keyboard.type("zzz");
  await expect(page.locator(".kit-mention__status")).toHaveText("Searching…");
  await expect(page.locator(".kit-mention__option")).toHaveCount(0);
  await page.keyboard.press("Enter");

  const value = page.locator('[data-demo="mention-value"]');
  await expect(value).toContainText("#zzz");
  // No stale reference from the "#" query was inserted (Enter fell through to
  // the textarea instead, since there was nothing to select).
  await expect(value).not.toContainText("j9cr");
});

test("custom trigger and row snippet", async ({ page }) => {
  await gotoPage(page, "mention-textarea");
  const textarea = page.getByRole("textbox", { name: "Comment" });

  await textarea.pressSequentially("@ma");
  const option = page.locator(".kit-mention__option");
  await expect(option).toHaveCount(1);
  await expect(option).toContainText("@marius");
  await expect(option).toContainText("Marius van Niekerk");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="user-mention-value"]')).toHaveText("@marius ");
});
