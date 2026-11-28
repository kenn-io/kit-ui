import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Overlays and popovers share one stack: Escape reaches only the layer that
// opened last, whatever kind it is and wherever it sits in the markup.

async function openDrawer(page: Page) {
  await gotoPage(page, "detail-drawer");
  await page.getByRole("button", { name: "Open stacked drawer" }).click();
  const drawer = page.getByRole("dialog", { name: "Stacked layers" });
  await expect(drawer).toBeVisible();
  return drawer;
}

// An Escape that an input method uses to cancel its candidate list. Chrome
// marks it isComposing; Safari ends composition first and sends it with
// isComposing false and the IME keyCode 229.
async function imeEscape(page: Page, kind: "composing" | "keyCode229") {
  await page.evaluate(async (kind) => {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
      isComposing: kind === "composing",
    });
    if (kind === "keyCode229") Object.defineProperty(event, "keyCode", { value: 229 });
    (document.activeElement ?? document.body).dispatchEvent(event);
    // Let a close render before the caller checks the layer is still there.
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }, kind);
}

test("a modal opened over a drawer closes before the drawer", async ({ page }) => {
  const drawer = await openDrawer(page);
  await page.getByRole("button", { name: "Confirm over drawer" }).click();
  const modal = page.getByRole("dialog", { name: "Outer confirm" });
  await expect(modal).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(drawer).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("a modal rendered inside a drawer closes on its own", async ({ page }) => {
  const drawer = await openDrawer(page);
  await page.getByRole("button", { name: "Confirm inside drawer" }).click();
  const modal = page.getByRole("dialog", { name: "Inner confirm" });
  await expect(modal).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(drawer).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("a modal that mounts with its drawer still closes first", async ({ page }) => {
  // Svelte mounts the modal before the drawer around it.
  await gotoPage(page, "detail-drawer");
  await page.getByRole("button", { name: "Open confirm in a new drawer" }).click();
  const drawer = page.getByRole("dialog", { name: "Stacked layers" });
  const modal = page.getByRole("dialog", { name: "Inner confirm" });
  await expect(modal).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(drawer).toBeVisible();
});

test("a modal opened over an open menu closes before the menu", async ({ page }) => {
  const drawer = await openDrawer(page);
  await drawer.getByRole("button", { name: "Actions" }).click();
  const menu = page.getByRole("menu", { name: "Drawer actions" });
  await expect(menu).toBeVisible();

  // Opened without a press, as a keyboard shortcut would, so the menu has
  // no outside press to close on.
  await page.getByRole("button", { name: "Confirm over drawer" }).dispatchEvent("click");
  const modal = page.getByRole("dialog", { name: "Outer confirm" });
  await expect(modal).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(drawer).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

for (const kind of ["composing", "keyCode229"] as const) {
  test(`an input method's Escape (${kind}) closes no layer`, async ({ page }) => {
    const drawer = await openDrawer(page);
    await drawer.getByRole("button", { name: "Actions" }).click();
    const menu = page.getByRole("menu", { name: "Drawer actions" });
    await expect(menu).toBeVisible();

    await imeEscape(page, kind);
    await expect(menu).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await imeEscape(page, kind);
    await expect(drawer).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
}
