import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers";

test("action menu manages focus, disabled items, selection, and dismissal", async ({ page }) => {
  await gotoPage(page, "menu");

  const trigger = page.getByRole("button", { name: "Task actions" });
  await expect(trigger).toHaveClass(/task-actions-trigger/);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const move = page.getByRole("menuitem", { name: "Move issue" });
  const archive = page.getByRole("menuitem", { name: "Archive issue" });
  const remove = page.getByRole("menuitem", { name: "Delete issue" });
  await expect(move).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(archive).toBeFocused();
  await expect(archive).toHaveCSS("cursor", "not-allowed");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Task actions" })).toBeVisible();
  await expect(page.getByTestId("menu-last-action")).toHaveText("last action: none");

  await page.keyboard.press("End");
  await expect(remove).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Task actions" })).toBeHidden();
  await expect(page.getByTestId("menu-last-action")).toHaveText("last action: delete");
  await expect(trigger).toBeFocused();

  await page.keyboard.press("ArrowUp");
  await expect(remove).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("move i");
  await expect(move).toBeFocused();
  await expect(page.getByRole("menu", { name: "Task actions" })).toBeVisible();
  await page.keyboard.press("Home");
  await expect(move).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("menu", { name: "Task actions" })).toBeHidden();
  await expect(page.locator("summary").first()).toBeFocused();
});

test("radio menu exposes and updates a single checked item", async ({ page }) => {
  await gotoPage(page, "menu");

  const trigger = page.getByRole("button", { name: "Switch daemon: local" });
  await trigger.click();
  const local = page.getByRole("menuitemradio", { name: "Local daemon" });
  const remote = page.getByRole("menuitemradio", { name: "Remote daemon" });
  await expect(local).toHaveAttribute("aria-checked", "true");

  await remote.click();
  await expect(page.getByTestId("menu-daemon")).toHaveText("selected: remote");
  await expect(page.getByRole("menu", { name: "Configured daemons" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Switch daemon: remote" })).toBeFocused();
});

async function labelGeometry(page: Page, menuName: string) {
  await page.getByRole("button", { name: menuName }).click();
  const items = page.getByRole("menu", { name: menuName }).getByRole("menuitem");
  return items.evaluateAll((elements) =>
    elements.map((element) => {
      const text = [...element.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (!text) throw new Error("Missing menu label");
      const range = document.createRange();
      range.selectNodeContents(text);
      return {
        labelLeft: range.getBoundingClientRect().left,
        itemLeft: element.getBoundingClientRect().left,
        paddingLeft: parseFloat(getComputedStyle(element).paddingLeft),
      };
    }),
  );
}

test("one icon indents every label in the menu", async ({ page }) => {
  await gotoPage(page, "menu");
  const geometry = await labelGeometry(page, "Task actions");
  expect(geometry[0].labelLeft - geometry[0].itemLeft).toBeGreaterThan(geometry[0].paddingLeft);
  for (const item of geometry) expect(item.labelLeft).toBe(geometry[0].labelLeft);
});

test("a menu without icons starts labels at the item padding", async ({ page }) => {
  await gotoPage(page, "menu");
  const geometry = await labelGeometry(page, "Photo actions");
  for (const item of geometry) expect(item.labelLeft - item.itemLeft).toBe(item.paddingLeft);
});
