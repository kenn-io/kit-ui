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

test("an aria-disabled child trigger does not open its menu", async ({ page }) => {
  await gotoPage(page, "menu");
  const trigger = page.getByRole("button", { name: "Task actions" });
  await trigger.evaluate((el) => el.setAttribute("aria-disabled", "true"));
  await trigger.click({ force: true });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("menuitem", { name: "Move issue" })).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
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

/** Scroll the context target into place and let the scroll event settle, so
 * it cannot land after the menu opens and dismiss it. */
async function placeContextTarget(page: Page, block: ScrollLogicalPosition) {
  const target = page.getByTestId("menu-context-target");
  await target.evaluate(async (el, position) => {
    el.scrollIntoView({ block: position, inline: "end" });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, block);
  const box = await target.boundingBox();
  if (!box) throw new Error("Missing context target");
  return { target, box };
}

test("context menu opens at the pointer and returns focus to its target", async ({ page }) => {
  await gotoPage(page, "menu");
  const { target, box } = await placeContextTarget(page, "start");
  const menu = page.getByRole("menu", { name: "File actions" });

  await page.mouse.click(box.x + 20, box.y + 30, { button: "right" });
  const menuBox = await menu.boundingBox();
  if (!menuBox) throw new Error("Missing menu");
  // clientX/clientY are whole pixels; the target box may sit on a fraction.
  expect(Math.abs(menuBox.x - (box.x + 20))).toBeLessThanOrEqual(1);
  expect(Math.abs(menuBox.y - (box.y + 30))).toBeLessThanOrEqual(1);
  await expect(page.getByRole("menuitem", { name: /Rename/ })).toBeFocused();
  // A right-click inside the menu must not open the browser's own menu over it.
  const nativeMenuAllowed = await menu.evaluate((el) =>
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
  );
  expect(nativeMenuAllowed).toBe(false);

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Copy path" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(target).toBeFocused();

  await page.mouse.click(box.x + 20, box.y + 30, { button: "right" });
  await page.keyboard.type("c");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(page.getByTestId("menu-last-action")).toHaveText("last action: copy");
  await expect(target).toBeFocused();
});

test("a second right-click moves an open context menu to the new pointer", async ({ page }) => {
  await gotoPage(page, "menu");
  const { box } = await placeContextTarget(page, "start");
  const menu = page.getByRole("menu", { name: "File actions" });
  await page.mouse.click(box.x + 20, box.y + 30, { button: "right" });
  await expect(menu).toBeVisible();

  await page.mouse.click(box.x + 6, box.y + 8, { button: "right" });
  await expect(menu).toBeVisible();
  await expect
    .poll(async () => {
      const menuBox = await menu.boundingBox();
      if (!menuBox) return false;
      return Math.abs(menuBox.x - (box.x + 6)) <= 1 && Math.abs(menuBox.y - (box.y + 8)) <= 1;
    })
    .toBe(true);
  await expect(page.getByRole("menuitem", { name: /Rename/ })).toBeFocused();
});

test("an item that moves focus keeps it after the menu closes", async ({ page }) => {
  await gotoPage(page, "menu");
  const { box } = await placeContextTarget(page, "start");
  await page.mouse.click(box.x + 20, box.y + 30, { button: "right" });
  await page.getByRole("menuitem", { name: /Rename/ }).click();
  await expect(page.getByRole("menu", { name: "File actions" })).toBeHidden();
  await expect(page.getByRole("textbox", { name: "File name" })).toBeFocused();
});

test("context menu shows trailing text at the item's right edge", async ({ page }) => {
  await gotoPage(page, "menu");
  const { box } = await placeContextTarget(page, "start");
  await page.mouse.click(box.x + 20, box.y + 30, { button: "right" });
  const rename = page.getByRole("menuitem", { name: /Rename/ });
  const item = await rename.boundingBox();
  const trailing = await rename.getByText("F2").boundingBox();
  const paddingRight = await rename.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight));
  if (!item || !trailing) throw new Error("Missing menu geometry");
  expect(
    Math.abs(trailing.x + trailing.width - (item.x + item.width - paddingRight)),
  ).toBeLessThanOrEqual(1);
});

test("a shortcut hint is announced as a key shortcut, not as part of the item's name", async ({
  page,
}) => {
  await gotoPage(page, "menu");
  const { box } = await placeContextTarget(page, "start");
  await page.mouse.click(box.x + 20, box.y + 30, { button: "right" });
  const rename = page.getByRole("menuitem", { name: "Rename", exact: true });
  await expect(rename).toHaveAttribute("aria-keyshortcuts", "F2");
  await expect(rename.getByText("F2")).toBeVisible();
});

test("context menu stays inside the viewport and closes when the page scrolls", async ({
  page,
}) => {
  await gotoPage(page, "menu");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing viewport");
  const { box } = await placeContextTarget(page, "end");
  await page.mouse.click(box.x + box.width - 2, box.y + box.height - 2, { button: "right" });
  const menu = page.getByRole("menu", { name: "File actions" });
  const menuBox = await menu.boundingBox();
  if (!menuBox) throw new Error("Missing menu");
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);

  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.wheel(0, -200);
  await expect(menu).toBeHidden();
});

test("a long menu grows to 80% of the viewport before it scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoPage(page, "menu");
  const menu = page.getByRole("menu", { name: "Workflows" });
  const size = () => menu.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));

  await page.getByRole("button", { name: "Run workflow" }).click();
  const tall = await size();
  expect(tall.client).toBeGreaterThan(360);
  expect(tall.scroll).toBeLessThanOrEqual(tall.client);
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1280, height: 400 });
  await page.getByRole("button", { name: "Run workflow" }).click();
  const short = await size();
  expect(short.client).toBeLessThanOrEqual(400 * 0.8);
  expect(short.scroll).toBeGreaterThan(short.client);
});

test("an app class rule can lift the menu height cap", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await gotoPage(page, "menu");
  await page.evaluate(async () => {
    const { mount } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: DetachedMenu } = await import("/tests/browser/fixtures/DetachedMenu.svelte");
    document.body.replaceChildren();
    mount(DetachedMenu, { target: document.body });
  });
  const menu = page.getByRole("menu", { name: "Detached" });
  await expect(menu.getByRole("menuitem", { name: "Item 30" })).toBeAttached();
  const size = await menu.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(size.client).toBeGreaterThan(400);
  expect(size.scroll).toBeLessThanOrEqual(size.client);
});

test("only the focused item is filled when the pointer rests on another", async ({ page }) => {
  await gotoPage(page, "menu");
  await page.getByRole("button", { name: "Task actions" }).click();
  const move = page.getByRole("menuitem", { name: "Move issue" });
  const remove = page.getByRole("menuitem", { name: "Delete issue" });
  await move.hover();
  await expect(move).toBeFocused();
  const fill = await move.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fill).not.toBe("rgba(0, 0, 0, 0)");

  await page.keyboard.press("End");
  await expect(remove).toBeFocused();
  await expect(remove).toHaveCSS("background-color", fill);
  await expect(move).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});
