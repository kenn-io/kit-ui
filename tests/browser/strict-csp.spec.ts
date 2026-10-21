import { expect, test, type Locator } from "@playwright/test";
import { setTheme } from "./helpers.js";

// Apps often serve a Content Security Policy without 'unsafe-inline' in
// style-src or 'wasm-unsafe-eval' in script-src. The browser then ignores
// style attributes and <style> elements in rendered markup and refuses to
// compile WebAssembly. The dev server tags its own injected styles with
// this nonce (vite.config.ts), so the policy blocks only kit-ui's output.
const NONCE = "kit-ui-dev";
const POLICY = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${NONCE}'`,
  `style-src 'self' 'nonce-${NONCE}'`,
  "img-src 'self' data:",
].join("; ");

const color = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).color);

test.beforeEach(async ({ page }) => {
  await page.route("**/tests/browser/fixtures/strict-csp.html", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": POLICY },
    });
  });
  await page.goto("/tests/browser/fixtures/strict-csp.html");
});

for (const testid of ["markdown", "code-block"]) {
  test(`${testid} highlights code under a strict policy`, async ({ page }) => {
    const section = page.getByTestId(testid);
    const keyword = section.locator("pre.shiki span").filter({ hasText: /^const$/ });
    await expect(keyword).toBeVisible({ timeout: 15_000 });
    const name = section.locator("pre.shiki span").filter({ hasText: /^ ?total/ });
    expect(await color(keyword)).not.toBe(await color(name));
  });
}

test("Mermaid diagrams keep their theme under a strict policy", async ({ page }) => {
  const node = page.locator(".kit-mermaid-viewer svg .node rect").first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  const fill = await node.evaluate((rect) => getComputedStyle(rect).fill);
  expect(fill).not.toBe("rgb(0, 0, 0)");
});

test("a theme change restyles diagrams and releases the old styles", async ({ page }) => {
  const node = page.locator(".kit-mermaid-viewer svg .node rect").first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  const fill = () => node.evaluate((rect) => getComputedStyle(rect).fill);
  const light = await fill();
  const sheets = await page.evaluate(() => document.adoptedStyleSheets.length);
  await setTheme(page, { dark: true });
  await expect.poll(fill).not.toBe(light);
  expect(await fill()).not.toBe("rgb(0, 0, 0)");
  expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBe(sheets);
});
