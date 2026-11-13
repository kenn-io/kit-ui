import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers";

// The shortcut manager listens on window, so component handlers (Svelte's
// delegated onkeydown on the app root, popover listeners on document) run
// first. A key a component claimed with preventDefault must not also fire
// an app-level shortcut.

type Fires = Record<string, number>;

async function registerCounters(page: Page, combos: string[], repeat: string[] = []) {
  await page.evaluate(
    async ({ combos, repeat }) => {
      const { appShortcuts, initShortcuts } = await import("/src/lib/utils/shortcuts.ts");
      initShortcuts();
      const fires: Record<string, number> = {};
      Object.assign(window, { __shortcutFires: fires });
      for (const combo of combos) {
        fires[combo] = 0;
        appShortcuts.register(combo, () => (fires[combo] = (fires[combo] ?? 0) + 1), {
          repeat: repeat.includes(combo),
        });
      }
    },
    { combos, repeat },
  );
  return () =>
    page.evaluate(() => (window as unknown as { __shortcutFires: Fires }).__shortcutFires);
}

test("keys a menu claims do not also fire app shortcuts", async ({ page }) => {
  await gotoPage(page, "menu");
  const fires = await registerCounters(page, ["escape", "down"]);

  const trigger = page.getByRole("button", { name: "Task actions" });
  const menu = page.getByRole("menu", { name: "Task actions" });
  await trigger.click();
  await expect(page.getByRole("menuitem", { name: "Move issue" })).toBeFocused();

  // MenuContent's delegated onkeydown moves focus and claims ArrowDown.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Archive issue" })).toBeFocused();
  // The popover's document listener closes the menu and claims Escape.
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  expect(await fires()).toEqual({ escape: 0, down: 0 });

  // With nothing open and nothing focused, both shortcuts fire.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowDown");
  expect(await fires()).toEqual({ escape: 1, down: 1 });
});

test("a held key fires once unless its shortcut opts into repeat", async ({ page }) => {
  await gotoPage(page, "menu");
  const fires = await registerCounters(page, ["t", "j"], ["j"]);

  // Playwright marks a keydown for an already-pressed key as a repeat.
  for (const key of ["t", "j"]) {
    await page.keyboard.down(key);
    await page.keyboard.down(key);
    await page.keyboard.down(key);
    await page.keyboard.up(key);
  }
  expect(await fires()).toEqual({ t: 1, j: 3 });
});
