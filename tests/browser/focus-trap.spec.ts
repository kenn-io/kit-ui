import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// trapFocus behaviors only a real browser exercises: initial focus,
// Tab-cycle containment in both directions, and restore-on-close.

test.describe("Modal focus trap", () => {
  test("focus enters, Tab cycles inside, Escape restores the trigger", async ({ page }) => {
    await gotoPage(page, "modal");
    const trigger = page.getByRole("button", { name: "Open modal" });
    await trigger.click();

    const panel = page.locator(".kit-modal-panel");
    await expect(panel).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest(".kit-modal-panel") !== null))
      .toBe(true);

    // Tab repeatedly — focus must never escape the panel.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => document.activeElement?.closest(".kit-modal-panel") !== null),
      ).toBe(true);
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(() => document.activeElement?.closest(".kit-modal-panel") !== null),
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe("DetailDrawer focus trap", () => {
  test("focus enters, stays trapped, Escape restores the trigger", async ({ page }) => {
    await gotoPage(page, "detail-drawer");
    const trigger = page.getByRole("button", { name: "Open drawer" });
    await trigger.click();

    const drawer = page.locator(".kit-detail-drawer");
    await expect(drawer).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest(".kit-detail-drawer") !== null))
      .toBe(true);

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => document.activeElement?.closest(".kit-detail-drawer") !== null),
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});
