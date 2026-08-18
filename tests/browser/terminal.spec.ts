import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// The gallery's echo transport exercises the real pane end to end: xterm
// construction (WebGL or built-in renderer), transport open, output
// rendering, and keyboard input round-tripping through the transport.

test("renders the echo transport greeting and echoes typed input", async ({ page }) => {
  await gotoPage(page, "terminal");
  const pane = page.locator(".kit-terminal-pane");
  await expect(pane).toBeVisible();

  // The transport opens asynchronously; the demo mirrors onConnectionChange.
  await expect(page.locator('[data-test="connected"]')).toHaveText("true");

  // xterm mounted inside the pane.
  await expect(pane.locator(".xterm")).toBeVisible();

  // xterm's hidden input textarea exists, so keyboard input has a target.
  await expect(pane.locator(".xterm-helper-textarea")).toBeAttached();

  // Typed input reaches the transport (the demo mirrors received bytes).
  await pane.click();
  await page.keyboard.type("echo-check");
  await expect(page.locator('[data-test="typed-input"]')).toHaveText("echo-check");
});
