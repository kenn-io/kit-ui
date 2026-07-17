import { expect, test, type Page } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

// Mermaid post-processor acceptance against real mermaid in Chromium
// (docs/components/mermaid.md): fence → themed pan/zoom viewer, copy /
// expand / reset controls, failure fallback, theme re-render.

const FLOWCHART_SOURCE = "graph LR"; // first line of the demo's first diagram

function firstViewer(page: Page) {
  return page.locator("pre.mermaid.kit-mermaid-viewer").first();
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "mermaid");
  // mermaid chunk-loads on first render; the viewer class lands last.
  await firstViewer(page).waitFor({ timeout: 15_000 });
});

test("renders mermaid fences into pan/zoom viewers", async ({ page }) => {
  const viewer = firstViewer(page);
  await expect(viewer).toHaveAttribute("data-mermaid-rendered", "true");
  await expect(viewer.locator(".kit-mermaid-viewer__viewport svg")).toBeVisible();
  await expect(viewer.locator(".kit-mermaid-viewer__button")).toHaveCount(3);
  await expect(viewer.getByRole("button", { name: "Reset diagram view" })).toBeVisible();
  // Controls render lucide icons (svg), not the legacy text glyphs.
  await expect(viewer.locator(".kit-mermaid-viewer__button svg.lucide")).toHaveCount(3);
});

test("repeated wheel zoom and drag pan are reset together", async ({ page }) => {
  const viewer = firstViewer(page);
  const viewport = viewer.locator(".kit-mermaid-viewer__viewport");
  const pan = viewer.locator(".kit-mermaid-viewer__pan");
  const transform = () =>
    pan.evaluate((node) => {
      const matrix = new DOMMatrix((node as HTMLElement).style.transform);
      return { scale: matrix.a, x: matrix.e, y: matrix.f };
    });
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();

  const cursor = {
    x: viewportBox!.x + viewportBox!.width * 0.25,
    y: viewportBox!.y + viewportBox!.height * 0.25,
  };
  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.wheel(0, -100);
  await page.mouse.wheel(0, -100);
  const zoomed = await transform();
  expect(zoomed.scale).toBeGreaterThan(1);
  expect(Math.abs(zoomed.x) + Math.abs(zoomed.y)).toBeGreaterThan(0);

  await page.mouse.down();
  await page.mouse.move(cursor.x + 30, cursor.y + 20);
  await page.mouse.up();
  const panned = await transform();
  expect(panned.scale).toBe(zoomed.scale);
  expect(panned.x).toBeCloseTo(zoomed.x + 30);
  expect(panned.y).toBeCloseTo(zoomed.y + 20);

  await viewer.getByRole("button", { name: "Reset diagram view" }).click();
  await expect.poll(transform).toEqual({ scale: 1, x: 0, y: 0 });
});

test("wheel zoom keeps the live diagram vector-backed", async ({ page }) => {
  // If fixed-layer compositing returns, Chromium enlarges the SVG's original
  // raster and zoomed Mermaid labels become blurry for consuming apps.
  const viewer = firstViewer(page);
  const viewport = viewer.locator(".kit-mermaid-viewer__viewport");
  const pan = viewer.locator(".kit-mermaid-viewer__pan");
  const svg = pan.locator(":scope > svg");
  const originalSvg = await svg.elementHandle();

  await viewport.hover();
  await page.mouse.wheel(0, -300);
  await expect(pan).not.toHaveCSS("transform", /matrix\(1,/);

  expect(await svg.evaluate((node, original) => node === original, originalSvg)).toBe(true);
  await expect(pan).toHaveCSS("will-change", "auto");
});

test("copy control copies the original fence source", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const viewer = firstViewer(page);
  await viewer.getByRole("button", { name: "Copy Mermaid source" }).click();
  await expect(viewer.getByRole("button", { name: "Copied Mermaid source" })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(FLOWCHART_SOURCE);
});

test("expand opens a lightbox dialog; Escape closes and restores focus", async ({ page }) => {
  const expand = firstViewer(page).getByRole("button", { name: "Open diagram in expanded view" });
  await expand.click();

  const lightbox = page.locator(".kit-mermaid-lightbox");
  const panel = lightbox.locator(".kit-mermaid-lightbox__panel");
  await expect(lightbox).toHaveAttribute("role", "dialog");
  await expect(lightbox.locator(".kit-mermaid-viewer__pan svg")).toBeVisible();
  await expect(lightbox.getByRole("button", { name: "Close expanded diagram" })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest(".kit-mermaid-lightbox__panel") !== null,
      ),
    ).toBe(true);
  }
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest(".kit-mermaid-lightbox__panel") !== null,
      ),
    ).toBe(true);
  }
  await expect(panel).toHaveAttribute("tabindex", "-1");

  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("backdrop click closes the lightbox", async ({ page }) => {
  await firstViewer(page).getByRole("button", { name: "Open diagram in expanded view" }).click();
  const lightbox = page.locator(".kit-mermaid-lightbox");
  await lightbox.click({ position: { x: 5, y: 5 } });
  await expect(lightbox).toHaveCount(0);
});

test("init directives cannot override the locked theme config", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const mod = await import("/src/lib/utils/markdown-mermaid.ts");
    const host = document.createElement("div");
    const pre = document.createElement("pre");
    pre.className = "mermaid";
    pre.textContent =
      '%%{init: {"theme":"forest","themeVariables":{"primaryColor":"#ff0000"}}}%%\ngraph TD\nA-->B';
    host.append(pre);
    document.body.append(host);
    try {
      const rendered = await mod.renderMarkdownMermaidDiagrams(host);
      const node = host.querySelector<SVGElement>(".node rect, .node path, .node polygon");
      // Normalize the --mermaid-node-bg hex through a computed color.
      const probe = document.createElement("div");
      probe.style.color = getComputedStyle(document.documentElement)
        .getPropertyValue("--mermaid-node-bg")
        .trim();
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return {
        rendered,
        fill: node ? getComputedStyle(node).fill : "missing",
        expected,
      };
    } finally {
      host.remove();
    }
  });
  expect(result.rendered).toBe(1);
  expect(result.fill).not.toBe("rgb(255, 0, 0)");
  expect(result.fill).toBe(result.expected);
});

test("a failed mermaid load clears pending state and retries on the next pass", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const mod = await import("/src/lib/utils/markdown-mermaid.ts");
    const host = document.createElement("div");
    const pre = document.createElement("pre");
    pre.className = "mermaid";
    pre.textContent = "graph TD\nX-->Y";
    host.append(pre);
    document.body.append(host);
    try {
      let loadError = null;
      try {
        await mod.renderMarkdownMermaidDiagrams(host, {
          load: () => Promise.reject(new Error("offline")),
        });
      } catch (error) {
        loadError = String(error);
      }
      const afterFailure = {
        state: pre.dataset.mermaidRendered ?? null,
        source: pre.textContent,
      };
      const retried = await mod.renderMarkdownMermaidDiagrams(host);
      return {
        loadError,
        afterFailure,
        retried,
        viewer: pre.classList.contains("kit-mermaid-viewer"),
      };
    } finally {
      host.remove();
    }
  });
  expect(result.loadError).toContain("offline");
  // Infrastructure failure: no failure-hold, source restored, next pass renders.
  expect(result.afterFailure.state).toBeNull();
  expect(result.afterFailure.source).toBe("graph TD\nX-->Y");
  expect(result.retried).toBe(1);
  expect(result.viewer).toBe(true);
});

test("lightbox traps Tab and locks body scroll while open", async ({ page }) => {
  await firstViewer(page).getByRole("button", { name: "Open diagram in expanded view" }).click();
  const lightbox = page.locator(".kit-mermaid-lightbox");
  await expect(lightbox.getByRole("button", { name: "Close expanded diagram" })).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toBe("hidden");

  // Two tabbables (close, reset) — Tab cycles inside the dialog.
  await page.keyboard.press("Tab");
  await expect(lightbox.getByRole("button", { name: "Reset diagram view" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(lightbox.getByRole("button", { name: "Close expanded diagram" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(lightbox.getByRole("button", { name: "Reset diagram view" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe("hidden");
});

test("disconnect closes an open lightbox owned by that controller", async ({ page }) => {
  await page.evaluate(async () => {
    const { initMarkdownMermaidRendering } = await import("/src/lib/utils/markdown-mermaid.ts");
    const host = document.createElement("div");
    host.id = "disconnect-lightbox-host";
    host.innerHTML = '<pre class="mermaid">graph LR\nA-->B</pre>';
    document.body.append(host);
    const controller = initMarkdownMermaidRendering(host);
    Object.assign(window, { __disconnectMermaidController: controller });
  });

  const host = page.locator("#disconnect-lightbox-host");
  await expect(host.locator("pre.mermaid.kit-mermaid-viewer")).toBeVisible({
    timeout: 15_000,
  });
  await host.getByRole("button", { name: "Open diagram in expanded view" }).click();
  const lightbox = page.locator(".kit-mermaid-lightbox");
  await expect(lightbox).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.evaluate(() => {
    const controller = (
      window as typeof window & {
        __disconnectMermaidController?: { disconnect: () => void };
      }
    ).__disconnectMermaidController;
    controller?.disconnect();
    document.querySelector("#disconnect-lightbox-host")?.remove();
    delete (
      window as typeof window & {
        __disconnectMermaidController?: { disconnect: () => void };
      }
    ).__disconnectMermaidController;
  });

  await expect(lightbox).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("invalid diagrams keep their escaped source visible", async ({ page }) => {
  const failed = page.locator('pre.mermaid[data-mermaid-rendered="failed"]');
  await expect(failed).toHaveCount(1, { timeout: 15_000 });
  await expect(failed).toContainText("not mermaid");
  await expect(failed.locator("svg")).toHaveCount(0);
});

test("skips mermaid.run when the runtime version is below the supported floor", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { renderMarkdownMermaidDiagrams } = await import("/src/lib/utils/markdown-mermaid.ts");
    const root = document.createElement("div");
    root.innerHTML = '<pre class="mermaid">graph LR\nA-->B</pre>';
    const node = root.querySelector<HTMLElement>("pre.mermaid")!;
    let runCalls = 0;
    let message = "";

    try {
      await renderMarkdownMermaidDiagrams(root, {
        load: async () => ({
          version: "11.14.0",
          initialize() {},
          async run() {
            runCalls += 1;
          },
        }),
      });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }

    return {
      message,
      rendered: node.dataset.mermaidRendered ?? null,
      runCalls,
      source: node.textContent,
    };
  });

  expect(result.message).toContain(">=11.15.0 <12");
  expect(result.rendered).toBeNull();
  expect(result.runCalls).toBe(0);
  expect(result.source).toBe("graph LR\nA-->B");
});

test("loader-level failures leave diagrams retryable", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { renderMarkdownMermaidDiagrams } = await import("/src/lib/utils/markdown-mermaid.ts");
    const root = document.createElement("div");
    root.innerHTML = '<pre class="mermaid">graph LR\nA-->B</pre>';
    const node = root.querySelector<HTMLElement>("pre.mermaid")!;
    let loadCalls = 0;
    let runCalls = 0;

    try {
      await renderMarkdownMermaidDiagrams(root, {
        load: async () => {
          loadCalls += 1;
          throw new Error("chunk unavailable");
        },
      });
    } catch {
      // Expected: transient loader failure.
    }

    const afterFailure = {
      rendered: node.dataset.mermaidRendered ?? null,
      source: node.textContent,
    };
    const renderedCount = await renderMarkdownMermaidDiagrams(root, {
      load: async () => ({
        version: "11.15.0",
        initialize() {},
        async run({ nodes }: { nodes: ArrayLike<HTMLElement> }) {
          runCalls += 1;
          for (const item of Array.from(nodes)) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            item.textContent = "";
            item.append(svg);
            item.dataset.processed = "true";
          }
        },
      }),
    });

    return {
      afterFailure,
      loadCalls,
      rendered: node.dataset.mermaidRendered ?? null,
      renderedCount,
      runCalls,
      viewer: node.classList.contains("kit-mermaid-viewer"),
    };
  });

  expect(result.afterFailure).toEqual({
    rendered: null,
    source: "graph LR\nA-->B",
  });
  expect(result.loadCalls).toBe(1);
  expect(result.rendered).toBe("true");
  expect(result.renderedCount).toBe(1);
  expect(result.runCalls).toBe(1);
  expect(result.viewer).toBe(true);
});

test("retry budget uses same-node source changes after transient failures", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { renderMarkdownMermaidDiagrams } = await import("/src/lib/utils/markdown-mermaid.ts");
    const root = document.createElement("div");
    root.innerHTML = '<pre class="mermaid">graph LR\nA-->B</pre>';
    const node = root.querySelector<HTMLElement>("pre.mermaid")!;
    let runCalls = 0;

    try {
      await renderMarkdownMermaidDiagrams(root, {
        load: async () => {
          throw new Error("chunk unavailable");
        },
      });
    } catch {
      // Expected: transient loader failure.
    }

    node.textContent = `graph LR\nA["${"x".repeat(200_001)}"]`;
    const renderedCount = await renderMarkdownMermaidDiagrams(root, {
      load: async () => ({
        version: "11.15.0",
        initialize() {},
        async run({ nodes }: { nodes: ArrayLike<HTMLElement> }) {
          runCalls += 1;
          for (const item of Array.from(nodes)) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            item.textContent = "";
            item.append(svg);
            item.dataset.processed = "true";
          }
        },
      }),
    });

    return {
      rendered: node.dataset.mermaidRendered ?? null,
      renderedCount,
      runCalls,
      stillMermaid: node.classList.contains("mermaid"),
      viewer: node.classList.contains("kit-mermaid-viewer"),
    };
  });

  expect(result.rendered).toBe("skipped");
  expect(result.renderedCount).toBe(0);
  expect(result.runCalls).toBe(0);
  expect(result.stillMermaid).toBe(false);
  expect(result.viewer).toBe(false);
});

test("run-level failures leave diagrams retryable", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { renderMarkdownMermaidDiagrams } = await import("/src/lib/utils/markdown-mermaid.ts");
    const root = document.createElement("div");
    root.innerHTML = '<pre class="mermaid">graph LR\nA-->B</pre>';
    const node = root.querySelector<HTMLElement>("pre.mermaid")!;
    let runCalls = 0;

    try {
      await renderMarkdownMermaidDiagrams(root, {
        load: async () => ({
          version: "11.15.0",
          initialize() {},
          async run() {
            runCalls += 1;
            throw new Error("worker unavailable");
          },
        }),
      });
    } catch {
      // Expected: transient mermaid.run failure.
    }

    const afterFailure = {
      rendered: node.dataset.mermaidRendered ?? null,
      source: node.textContent,
    };
    const renderedCount = await renderMarkdownMermaidDiagrams(root, {
      load: async () => ({
        version: "11.15.0",
        initialize() {},
        async run({ nodes }: { nodes: ArrayLike<HTMLElement> }) {
          runCalls += 1;
          for (const item of Array.from(nodes)) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            item.textContent = "";
            item.append(svg);
            item.dataset.processed = "true";
          }
        },
      }),
    });

    return {
      afterFailure,
      rendered: node.dataset.mermaidRendered ?? null,
      renderedCount,
      runCalls,
      viewer: node.classList.contains("kit-mermaid-viewer"),
    };
  });

  expect(result.afterFailure).toEqual({
    rendered: null,
    source: "graph LR\nA-->B",
  });
  expect(result.rendered).toBe("true");
  expect(result.renderedCount).toBe(1);
  expect(result.runCalls).toBe(2);
  expect(result.viewer).toBe(true);
});

test("budget caps: excess diagrams and over-budget sources stay plain blocks", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { renderMarkdownMermaidDiagrams } = await import("/src/lib/utils/markdown-mermaid.ts");
    const root = document.createElement("div");
    // 25-diagram cap: 27 small diagrams — the last two must be skipped
    // without reaching mermaid.run.
    for (let i = 0; i < 27; i += 1) {
      const pre = document.createElement("pre");
      pre.className = "mermaid";
      pre.textContent = `graph LR\nA${i}-->B${i}`;
      root.append(pre);
    }
    let runNodeCounts: number[] = [];
    const fakeLoad = async () => ({
      version: "11.15.0",
      initialize() {},
      async run({ nodes }: { nodes: ArrayLike<HTMLElement> }) {
        runNodeCounts.push(nodes.length);
        for (const item of Array.from(nodes)) {
          item.textContent = "";
          item.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
          item.dataset.processed = "true";
        }
      },
    });
    const countRendered = await renderMarkdownMermaidDiagrams(root, { load: fakeLoad });
    const countSkipped = root.querySelectorAll('pre[data-mermaid-rendered="skipped"]').length;

    // 200 KB byte cap is cumulative: a diagram that would overflow the
    // remaining budget is skipped, but later diagrams that still fit
    // are rendered.
    const byteRoot = document.createElement("div");
    const sources = [
      `graph LR\nA["${"x".repeat(150_000)}"]`,
      `graph LR\nB["${"x".repeat(60_000)}"]`,
      "graph LR\nC-->D",
    ];
    for (const source of sources) {
      const pre = document.createElement("pre");
      pre.className = "mermaid";
      pre.textContent = source;
      byteRoot.append(pre);
    }
    runNodeCounts = [];
    const bytesRendered = await renderMarkdownMermaidDiagrams(byteRoot, { load: fakeLoad });
    const byteStates = Array.from(byteRoot.querySelectorAll("pre")).map(
      (pre) => pre.dataset.mermaidRendered ?? null,
    );

    return { countRendered, countSkipped, bytesRendered, byteStates, runNodeCounts };
  });
  expect(result.countRendered).toBe(25);
  expect(result.countSkipped).toBe(2);
  expect(result.bytesRendered).toBe(2);
  expect(result.byteStates).toEqual(["true", "skipped", "true"]);
  expect(result.runNodeCounts).toEqual([2]);
});

test("a controller settles after a persistent load failure instead of retry-looping", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { initMarkdownMermaidRendering } = await import("/src/lib/utils/markdown-mermaid.ts");
    const host = document.createElement("div");
    host.innerHTML = '<pre class="mermaid">graph LR\nA-->B</pre>';
    const node = host.querySelector<HTMLElement>("pre.mermaid")!;
    document.body.append(host);
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let loadCalls = 0;
    const controller = initMarkdownMermaidRendering(host, {
      load: async () => {
        loadCalls += 1;
        throw new Error("mermaid infrastructure unavailable");
      },
    });
    try {
      // The failure restores the source, which wakes the controller's
      // own MutationObserver — a loop would rack up calls here.
      await wait(300);
      const settledCalls = loadCalls;
      const settledSource = node.textContent;

      controller.renderNow();
      await wait(300);
      const afterRenderNow = loadCalls;

      node.textContent = "graph LR\nB-->C";
      await wait(300);
      const afterSourceChange = loadCalls;

      return { settledCalls, settledSource, afterRenderNow, afterSourceChange };
    } finally {
      controller.disconnect();
      host.remove();
    }
  });
  expect(result.settledCalls).toBe(1);
  expect(result.settledSource).toBe("graph LR\nA-->B");
  // Explicit renderNow() and a real source change each retry exactly once.
  expect(result.afterRenderNow).toBe(2);
  expect(result.afterSourceChange).toBe(3);
});

test("a controller settles after a run failure that mutated the node", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { initMarkdownMermaidRendering } = await import("/src/lib/utils/markdown-mermaid.ts");
    const host = document.createElement("div");
    host.innerHTML = '<pre class="mermaid">graph LR\nA-->B</pre>';
    const node = host.querySelector<HTMLElement>("pre.mermaid")!;
    document.body.append(host);
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let runCalls = 0;
    const controller = initMarkdownMermaidRendering(host, {
      load: async () => ({
        version: "11.15.0",
        initialize() {},
        async run({ nodes }: { nodes: ArrayLike<HTMLElement> }) {
          runCalls += 1;
          for (const item of Array.from(nodes)) {
            item.textContent = "partial render output";
          }
          throw new Error("worker unavailable");
        },
      }),
    });
    try {
      await wait(300);
      const settledCalls = runCalls;
      const settledSource = node.textContent;

      controller.renderNow();
      await wait(300);
      const afterRenderNow = runCalls;

      return { settledCalls, settledSource, afterRenderNow };
    } finally {
      controller.disconnect();
      host.remove();
    }
  });
  expect(result.settledCalls).toBe(1);
  expect(result.settledSource).toBe("graph LR\nA-->B");
  expect(result.afterRenderNow).toBe(2);
});

test("theme flip re-renders diagrams with the other palette", async ({ page }) => {
  await setTheme(page, { dark: false });
  await firstViewer(page).waitFor({ timeout: 15_000 });
  const lightBg = await firstViewer(page).evaluate((el) => getComputedStyle(el).backgroundColor);

  await setTheme(page, { dark: true });
  // The theme observer tears every viewer down and re-renders.
  await firstViewer(page).waitFor({ timeout: 15_000 });
  await expect
    .poll(async () => firstViewer(page).evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(lightBg);
  await expect(firstViewer(page).locator(".kit-mermaid-viewer__pan svg")).toBeVisible();
});
