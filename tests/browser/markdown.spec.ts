import { expect, test } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

// Markdown pipeline security + rendering acceptance
// (docs/components/code-block.md). The sanitizer runs against real
// DOMPurify in the page; the pipeline is imported through the Vite dev
// server.

async function render(page: import("@playwright/test").Page, source: string): Promise<string> {
  return page.evaluate(async (raw) => {
    const mod = await import("/src/lib/utils/markdown.ts");
    return mod.renderMarkdown(raw) as Promise<string>;
  }, source);
}

test.describe("sanitization", () => {
  test.beforeEach(async ({ page }) => gotoPage(page, "markdown"));

  test("strips script vectors, style tags, and non-shiki inline styles", async ({ page }) => {
    const html = await render(
      page,
      [
        '<img src=x onerror="alert(1)">',
        "<style>body{display:none}</style>",
        '<div style="position:fixed">styled</div>',
        "<script>alert(2)</script>",
      ].join("\n\n"),
    );
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("position:fixed");
  });

  test("keeps shiki dual-theme styles but strips the trust marker", async ({ page }) => {
    const html = await render(page, "```js\nconst a = 1;\n```");
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-light:");
    expect(html).toContain("--shiki-dark:");
    expect(html).not.toContain("data-kit-shiki");
  });

  test("faked shiki markup cannot smuggle styles (no nonce)", async ({ page }) => {
    const html = await render(
      page,
      '<pre class="shiki"><span style="--shiki-light:#123456">x</span></pre>',
    );
    expect(html).not.toContain("--shiki-light");
  });

  test("target-bearing links get rel noopener", async ({ page }) => {
    const html = await render(page, 'x: <a href="https://x.com" target="_blank">x</a>');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

test("gallery markdown switches code colors with the theme", async ({ page }) => {
  await gotoPage(page, "markdown");
  const span = page.locator(".kit-markdown pre.shiki span[style]").first();
  await span.waitFor();

  await setTheme(page, { dark: false });
  const light = await span.evaluate((el) => getComputedStyle(el).color);
  await setTheme(page, { dark: true });
  const dark = await span.evaluate((el) => getComputedStyle(el).color);
  expect(light).not.toBe(dark);
});

test.describe("CodeBlock", () => {
  test.beforeEach(async ({ page }) => gotoPage(page, "code-block"));

  test("highlights async and numbers lines", async ({ page }) => {
    const numbered = page.locator(".kit-code-block--line-numbers").first();
    await expect(numbered.locator("pre.shiki")).toBeVisible();
    const lines = numbered.locator(".line");
    expect(await lines.count()).toBeGreaterThan(1);
  });

  test("wrap toggle is an aria-pressed toggle that soft-wraps", async ({ page }) => {
    const block = page.locator(".kit-code-block").first();
    const toggle = block.getByRole("button", { name: "Toggle line wrap" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(block.locator("pre").first()).toHaveCSS("white-space", "pre-wrap");
  });

  test("copy button announces the copied state", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const block = page.locator(".kit-code-block").first();
    const copy = block.getByRole("button", { name: "Copy code" });
    await copy.click();
    await expect(block.getByRole("button", { name: "Copied" })).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("interface Session");
  });
});
