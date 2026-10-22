import { expect, test, type Locator, type Page } from "@playwright/test";
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

// Shiki marks a diff hunk header bold, which adds font hints beside its
// colors. The colors must survive both sanitization and the CSSOM pass.
test("a bold token keeps its color under a strict policy", async ({ page }) => {
  const section = page.getByTestId("markdown");
  const hunk = section.locator("pre.shiki span:not(.line)").filter({ hasText: /^@@ -1 \+1 @@$/ });
  await expect(hunk).toBeVisible({ timeout: 15_000 });
  // The line around it has the block's plain text color.
  const line = hunk.locator("xpath=parent::span");
  expect(await color(hunk)).not.toBe(await color(line));
});

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

// VideoPlayer's look comes from its stylesheet, not from styles on its
// elements, so the policy blocks none of it and the bar lays out on the
// picture.
test("a video player lays out its controls under a strict policy", async ({ page }) => {
  const player = page.getByTestId("video").locator(".kit-video-player");
  const play = player.getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeVisible();
  // The picture takes its size from the clip's metadata.
  await expect
    .poll(() => player.locator("video").evaluate((node) => (node as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  // Read both rectangles in one task: content above the player can shift
  // while the fixture's Markdown and diagrams render.
  const { bar, picture } = await player.evaluate((node) => ({
    bar: node.querySelector(".kit-video-player__bar")!.getBoundingClientRect().toJSON(),
    picture: node.querySelector("video")!.getBoundingClientRect().toJSON(),
  }));
  // On the picture, at its bottom edge, not in the flow below it.
  expect(bar.y).toBeGreaterThan(picture.y);
  expect(Math.abs(bar.y + bar.height - (picture.y + picture.height))).toBeLessThanOrEqual(1);
  expect(await play.boundingBox()).toMatchObject({ width: 32, height: 32 });
  await expect(player.getByRole("button", { name: "Open video in expanded view" })).toBeVisible();
});

type ControllerWindow = typeof window & {
  mermaidControllers?: Record<string, { disconnect: () => void }>;
};

// Renders `source` in its own host under <main>, with its own controller.
async function mountDiagram(page: Page, id: string, source: string): Promise<Locator> {
  await page.evaluate(
    async ({ id, source }) => {
      const { initMarkdownMermaidRendering } = await import("/src/lib/utils/markdown-mermaid.ts");
      const host = document.createElement("div");
      host.id = id;
      const pre = document.createElement("pre");
      pre.className = "mermaid";
      pre.textContent = source;
      host.append(pre);
      document.querySelector("main")!.append(host);
      const controllers = ((window as ControllerWindow).mermaidControllers ??= {});
      controllers[id] = initMarkdownMermaidRendering(host);
    },
    { id, source },
  );
  const host = page.locator(`#${id}`);
  await expect(host.locator(".kit-mermaid-viewer__pan > svg")).toBeVisible({ timeout: 15_000 });
  return host;
}

// The adopted-sheet count once the fixture's own diagram has rendered.
async function settledSheetCount(page: Page): Promise<number> {
  await expect(page.getByTestId("markdown").locator(".kit-mermaid-viewer__pan > svg")).toBeVisible({
    timeout: 15_000,
  });
  return page.evaluate(() => document.adoptedStyleSheets.length);
}

const sheetCount = (page: Page) => page.evaluate(() => document.adoptedStyleSheets.length);

test("replacing every diagram with text releases its styles", async ({ page }) => {
  const before = await settledSheetCount(page);
  await mountDiagram(page, "replaced", "graph LR\n  A --> B");
  expect(await sheetCount(page)).toBe(before + 1);

  await page.evaluate(() => {
    document.querySelector("#replaced")!.textContent = "Plain text";
  });
  await expect.poll(() => sheetCount(page)).toBe(before);
});

test("disconnecting a controller releases its diagrams' styles", async ({ page }) => {
  const before = await settledSheetCount(page);
  await mountDiagram(page, "disconnected", "graph LR\n  A --> B");
  expect(await sheetCount(page)).toBe(before + 1);

  // Disconnect first, then remove the content, as a host tearing down might.
  await page.evaluate(() => {
    (window as ControllerWindow).mermaidControllers!["disconnected"]!.disconnect();
    document.querySelector("#disconnected")!.remove();
  });
  expect(await sheetCount(page)).toBe(before);
});

test("labels fit their shapes when the host styles pre with another font", async ({ page }) => {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/tests/browser/fixtures/narrow-pre.css";
        link.onload = resolve;
        link.onerror = reject;
        document.head.append(link);
      }),
  );
  const host = await mountDiagram(
    page,
    "labels",
    [
      "graph TD",
      "  A[Reconcile settlement nightly] --> B[Collect pending invoices]",
      "  B --> C[Notify finance reviewers]",
      "  C --> D[Archive closed statements]",
    ].join("\n"),
  );

  const nodes = await host
    .locator(".kit-mermaid-viewer__pan > svg g.node")
    .evaluateAll((elements) =>
      elements.map((node) => {
        const text = node.querySelector<SVGTextElement>("text")!;
        const shape = node.querySelector<SVGGraphicsElement>(".label-container")!;
        return {
          label: text.textContent,
          text: text.getBBox().width,
          shape: shape.getBBox().width,
        };
      }),
    );
  expect(nodes).toHaveLength(4);
  for (const node of nodes) {
    expect(node.text, node.label ?? "").toBeLessThanOrEqual(node.shape + 1);
  }
});

test("a diagram that fails to render shows its source in the host's pre font", async ({ page }) => {
  await page.evaluate(async () => {
    const { initMarkdownMermaidRendering } = await import("/src/lib/utils/markdown-mermaid.ts");
    const host = document.createElement("div");
    host.id = "failed";
    host.innerHTML = '<pre class="mermaid">not mermaid</pre><pre class="plain">plain</pre>';
    document.querySelector("main")!.append(host);
    initMarkdownMermaidRendering(host);
  });
  const failed = page.locator('#failed pre[data-mermaid-rendered="failed"]');
  await expect(failed).toHaveCount(1, { timeout: 15_000 });
  const font = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).font);
  expect(await font(failed)).toBe(await font(page.locator("#failed pre.plain")));
});
