import { expect, test } from "@playwright/test";
import { clipboardReader, gotoPage, setTheme } from "./helpers.js";

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

test.describe("render cache", () => {
  test.beforeEach(async ({ page }) => gotoPage(page, "markdown"));

  test("reuses 1000 sources of 5 KiB and shares concurrent renders", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      let parses = 0;
      const renderer = createMarkdownRenderer({
        tokenizer: {
          paragraph() {
            parses++;
            return false;
          },
        },
      });
      await Promise.all([renderer.render("Hello"), renderer.render("Hello")]);
      const sources = Array.from({ length: 1000 }, (_, i) => `Message ${i} `.padEnd(5 * 1024, "x"));
      for (const source of sources) await renderer.render(source);
      const before = parses;
      for (const source of sources) await renderer.render(source);
      return { before, after: parses };
    });
    expect(result).toEqual({
      before: 1001,
      after: 1001,
    });
  });

  test("evicts only the least recently used sources at the character limit", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      let parses = 0;
      const renderer = createMarkdownRenderer({
        tokenizer: {
          html() {
            parses++;
            return false;
          },
        },
      });
      // Four sources of 2 * 1024 * 1024 characters fill the budget exactly.
      const sources = ["a", "b", "c", "d"].map(
        (id) => `<!--${id}${"文".repeat(2 * 1024 * 1024 - 8)}-->`,
      );
      for (const source of sources) await renderer.render(source);
      await renderer.render(sources[0]);
      const atLimit = parses;
      await renderer.render("<!--new-->");
      for (const i of [0, 2, 3]) await renderer.render(sources[i]);
      const retained = parses;
      await renderer.render(sources[1]);
      return { atLimit, retained, afterEvicted: parses };
    });
    expect(result).toEqual({ atLimit: 4, retained: 5, afterEvicted: 6 });
  });

  test("renders oversized sources without evicting cached messages", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      let parses = 0;
      const renderer = createMarkdownRenderer({
        tokenizer: {
          html() {
            parses++;
            return false;
          },
        },
      });
      await renderer.render("<!--keep-->");
      const oversized = `<!--${"x".repeat(8 * 1024 * 1024)}-->`;
      const html = await renderer.render(oversized);
      await renderer.render(oversized);
      await renderer.render("<!--keep-->");
      return { html, parses };
    });
    expect(result).toEqual({ html: "", parses: 3 });
  });

  test("retries failed renders and releases their source budget", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      let fail = true;
      let parses = 0;
      const renderer = createMarkdownRenderer({
        tokenizer: {
          html() {
            parses++;
            if (fail) throw new Error("try again");
            return false;
          },
        },
      });
      const source = `<!--${"x".repeat(4 * 1024 * 1024)}-->`;
      const error = await renderer.render(source).catch((error: Error) => error.message);
      fail = false;
      const html = await renderer.render(source);
      await renderer.render(source);
      return { error, html, parses };
    });
    expect(result).toEqual({ error: "try again", html: "", parses: 2 });
  });

  test("an evicted rejection preserves a newer render of the same source", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      let parses = 0;
      const renderer = createMarkdownRenderer({
        tokenizer: {
          html() {
            if (++parses === 1) throw new Error("first attempt failed");
            return false;
          },
        },
      });
      // Queue eviction and replacement before the rejection cleanup runs.
      const first = renderer.render("<!--retry-->").catch((error: Error) => error.message);
      const a = renderer.render(`<!--a${"x".repeat(4 * 1024 * 1024 - 8)}-->`);
      const b = renderer.render(`<!--b${"x".repeat(4 * 1024 * 1024 - 8)}-->`);
      const replacement = renderer.render("<!--retry-->");
      const results = await Promise.all([first, a, b, replacement]);
      await renderer.render("<!--retry-->");
      return { results, parses };
    });
    expect(result).toEqual({ results: ["first attempt failed", "", "", ""], parses: 4 });
  });
});

for (const method of ["render", "renderSync"] as const) {
  test(`${method} combines extensions and tokenizer overrides around a sanitized wrapped diff`, async ({
    page,
  }) => {
    await gotoPage(page, "markdown");
    const html = await page.evaluate(async (method) => {
      const { createMarkdownRenderer, escapeHtml } = await import("/src/lib/utils/markdown.ts");
      const renderer = createMarkdownRenderer({
        extensions: [
          {
            name: "itemRef",
            level: "inline",
            start(src) {
              return src.indexOf("@item");
            },
            tokenizer(src) {
              if (!src.startsWith("@item")) return;
              return { type: "itemRef", raw: "@item", text: "Item" };
            },
            renderer() {
              return '<a href="https://example.com/items/1">Item</a>';
            },
          },
        ],
        tokenizer: {
          paragraph(src) {
            const boundary = src.indexOf("\n<current_file_diff>");
            // Yield only when the diff ends the current paragraph.
            if (boundary < 0 || src.slice(0, boundary).includes("\n\n")) return false;
            const text = src.slice(0, boundary);
            return {
              type: "paragraph",
              raw: `${text}\n`,
              text,
              tokens: this.lexer.inline(text),
            };
          },
          html(src) {
            const match = /^<current_file_diff>[\s\S]*?<\/current_file_diff>/.exec(src);
            if (!match) return false;
            return {
              type: "html",
              raw: match[0],
              pre: false,
              block: true,
              text: `<pre onclick="alert(1)">${escapeHtml(match[0])}</pre>\n`,
            };
          },
        },
      });
      return renderer[method](
        "Intro.\n\nBefore **default** @item.\n<current_file_diff>\ndiff --git a/example.py b/example.py\n-    # FIXME: replace this\n+    new_value\n</current_file_diff>\nAfter **default** @item.",
      );
    }, method);
    expect(html).toBe(
      '<p>Intro.</p>\n<p>Before <strong>default</strong> <a href="https://example.com/items/1">Item</a>.</p>\n<pre>&lt;current_file_diff&gt;\ndiff --git a/example.py b/example.py\n-    # FIXME: replace this\n+    new_value\n&lt;/current_file_diff&gt;</pre>\n<p>After <strong>default</strong> <a href="https://example.com/items/1">Item</a>.</p>\n',
    );
  });

  test(`${method} propagates tokenizer callback errors`, async ({ page }) => {
    await gotoPage(page, "markdown");
    const message = await page.evaluate(async (method) => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      const renderer = createMarkdownRenderer({
        tokenizer: {
          paragraph() {
            throw new Error("tokenizer failed");
          },
        },
      });
      try {
        const result = renderer[method]("Paragraph.");
        if (method === "renderSync") return "renderSync returned";
        await result;
        return "render resolved";
      } catch (error) {
        return (error as Error).message;
      }
    }, method);
    expect(message).toBe("tokenizer failed");
  });

  test(`${method} preserves source line breaks by default`, async ({ page }) => {
    await gotoPage(page, "markdown");
    const html = await page.evaluate(async (method) => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      return createMarkdownRenderer()[method]("First line\nsecond line.");
    }, method);
    expect(html).toBe("<p>First line<br>second line.</p>\n");
  });

  test(`${method} allows soft breaks while keeping explicit breaks and code lines`, async ({
    page,
  }) => {
    await gotoPage(page, "markdown");
    const result = await page.evaluate(async (method) => {
      const { createMarkdownRenderer } = await import("/src/lib/utils/markdown.ts");
      const renderer = createMarkdownRenderer({ breaks: false });
      const html = await renderer[method](
        "First line\nsecond line.\n\nTwo spaces  \nnext line.\n\nBackslash\\\nnext line.\n\n```text\none\ntwo\n```",
      );
      const doc = new DOMParser().parseFromString(html, "text/html");
      return {
        paragraphs: [...doc.querySelectorAll("p")].map((p) => p.innerHTML),
        code: doc.querySelector("pre code")?.textContent,
      };
    }, method);
    expect(result).toEqual({
      paragraphs: [
        "First line\nsecond line.",
        "Two spaces<br>next line.",
        "Backslash<br>next line.",
      ],
      code: "one\ntwo",
    });
  });
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
    const readClipboard = await clipboardReader(page, context);
    const block = page.locator(".kit-code-block").first();
    const copy = block.getByRole("button", { name: "Copy code" });
    await copy.click();
    await expect(block.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await readClipboard()).toContain("interface Session");
  });
});
