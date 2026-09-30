import { expect, test, type Page } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

// MediaViewer (docs/components/media-viewer.md): the shared expanded view
// for images, Mermaid diagrams, and other elements, and the page gallery
// that lets any expandable item page through the others on display.

function viewer(page: Page) {
  return page.getByRole("dialog");
}

function counter(page: Page) {
  return page.locator(".kit-media-viewer__counter");
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "media-viewer");
});

test("pages with buttons and arrow keys, wrapping at the ends", async ({ page }) => {
  const open = page.getByRole("button", { name: "Open viewer" });
  await open.click();

  await expect(viewer(page)).toHaveAccessibleName("First swatch (1 of 3)");
  await expect(counter(page)).toHaveText("1 / 3");

  await page.getByRole("button", { name: "Next item" }).click();
  await expect(viewer(page)).toHaveAccessibleName("Second swatch (2 of 3)");
  await expect(viewer(page).getByRole("img")).toHaveAttribute("alt", "Second swatch");

  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("3 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("1 / 3");
  await page.keyboard.press("ArrowLeft");
  await expect(counter(page)).toHaveText("3 / 3");
  await page.getByRole("button", { name: "Previous item" }).click();
  await expect(counter(page)).toHaveText("2 / 3");

  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  await expect(open).toBeFocused();
});

test("paging resets pan and zoom", async ({ page }) => {
  await page.getByRole("button", { name: "Open viewer" }).click();
  const pan = page.locator(".kit-media-viewer__pan");
  const scale = () => pan.evaluate((node) => new DOMMatrix(node.style.transform).a);

  await page.locator(".kit-media-viewer__viewport").hover();
  await page.mouse.wheel(0, -300);
  await expect.poll(scale).toBeGreaterThan(1);

  await page.getByRole("button", { name: "Reset view" }).click();
  await expect.poll(scale).toBe(1);

  await page.locator(".kit-media-viewer__viewport").hover();
  await page.mouse.wheel(0, -300);
  await expect.poll(scale).toBeGreaterThan(1);
  await page.keyboard.press("ArrowRight");
  await expect.poll(scale).toBe(1);
});

test("images keep their natural size instead of upscaling", async ({ page }) => {
  await page.getByRole("button", { name: "Open viewer" }).click();
  const size = await viewer(page)
    .getByRole("img")
    .evaluate((img) => {
      const rect = img.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
  expect(size).toEqual({ width: 480, height: 280 });
});

test("a markdown image pages through every displayed item on the page", async ({ page }) => {
  // Mermaid renders asynchronously; wait for the diagram viewer.
  await page.locator("pre.mermaid.kit-mermaid-viewer").waitFor({ timeout: 15_000 });

  await page.getByRole("img", { name: "Screenshot A" }).hover();
  await page.getByRole("button", { name: "Open image in expanded view: Screenshot A" }).click();

  // Screenshot A, the diagram, Screenshot B, the ImagePreview — not the
  // image in the inactive tab.
  await expect(viewer(page)).toHaveAccessibleName("Screenshot A (1 of 4)");
  await page.keyboard.press("ArrowRight");
  await expect(viewer(page)).toHaveAccessibleName("Mermaid diagram (2 of 4)");
  await expect(viewer(page).locator(".kit-mermaid-content svg")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer(page)).toHaveAccessibleName("Screenshot B (3 of 4)");
  await page.keyboard.press("ArrowRight");
  await expect(viewer(page)).toHaveAccessibleName("ImagePreview swatch (4 of 4)");
  await page.keyboard.press("Escape");

  // Showing the other tab makes its image eligible.
  await page.getByRole("radio", { name: "Other tab" }).click();
  await page
    .getByRole("button", { name: "Open image in expanded view: ImagePreview swatch" })
    .click();
  await expect(viewer(page)).toHaveAccessibleName("ImagePreview swatch (4 of 5)");
  await page.keyboard.press("ArrowRight");
  await expect(viewer(page)).toHaveAccessibleName("Hidden tab image (5 of 5)");
});

test("an item inside a modal pages only within that modal", async ({ page }) => {
  await gotoPage(page, "image-preview");
  await page.getByRole("button", { name: "Open image modal" }).click();
  await page.getByRole("button", { name: "Expand nested image" }).click();

  // The Modal is a dialog too; the viewer's name has no "(n of m)" suffix
  // because it holds only the nested image.
  await expect(page.getByRole("dialog", { name: "Nested demo shapes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next item" })).toHaveCount(0);
  await expect(counter(page)).toHaveCount(0);
});

test("a small diagram grows to fill the expanded view", async ({ page }) => {
  const diagram = page.locator("pre.mermaid.kit-mermaid-viewer");
  await diagram.waitFor({ timeout: 15_000 });
  await diagram.getByRole("button", { name: "Open diagram in expanded view" }).click();

  // Mermaid writes an inline max-width (the diagram's natural width) on
  // its svg; the viewer must still scale it up to the available space.
  const widths = await viewer(page)
    .locator(".kit-mermaid-content svg")
    .evaluate((svg) => ({
      svg: svg.getBoundingClientRect().width,
      natural: Number.parseFloat((svg as SVGSVGElement).style.maxWidth),
      pan: svg.closest(".kit-media-viewer__pan")!.getBoundingClientRect().width,
    }));
  expect(widths.svg).toBeGreaterThan(widths.natural);
  expect(widths.svg).toBeCloseTo(widths.pan, 0);
});

test("markdown image expansion handles links and suspends app shortcuts", async ({ page }) => {
  await page.evaluate(async () => {
    const { initMarkdownImageViewer } = await import("/src/lib/utils/markdown-images.ts");
    const pixel =
      "data:image/svg+xml," +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"/>');
    const host = document.createElement("div");
    host.id = "markdown-images-host";
    host.innerHTML = `
      <a id="image-link" href="#linked"><img alt="Linked" src="${pixel}"></a>
      <a id="text-link" href="#text"><img alt="In text link" src="${pixel}"> read more</a>`;
    document.body.append(host);
    const calls: string[] = [];
    Object.assign(window, { __viewerCalls: calls });
    initMarkdownImageViewer(host, {
      selector: "img",
      onViewerOpen: () => {
        calls.push("open");
        return () => calls.push("restore");
      },
    });
  });
  const host = page.locator("#markdown-images-host");
  const calls = () =>
    page.evaluate(() => (window as unknown as { __viewerCalls: string[] }).__viewerCalls);

  // A link wrapping only the image keeps working; the button sits beside it.
  const linkedButton = host.getByRole("button", { name: "Open image in expanded view: Linked" });
  await expect(linkedButton).toHaveCount(1);
  expect(await linkedButton.evaluate((button) => button.closest("a"))).toBeNull();
  await expect(host.locator("#image-link")).toHaveAttribute("href", "#linked");
  // An image inside a link with other content is left alone.
  await expect(host.getByRole("button", { name: /In text link/ })).toHaveCount(0);

  await host.locator("#image-link").hover({ position: { x: 20, y: 100 } });
  await linkedButton.click();
  // The demo page's own media join the gallery too.
  await expect(viewer(page)).toHaveAccessibleName(/^Linked \(\d+ of \d+\)$/);
  expect(await calls()).toEqual(["open"]);
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  expect(await calls()).toEqual(["open", "restore"]);
});

test("unmounting an ImagePreview closes the viewer it opened", async ({ page }) => {
  await page.evaluate(async () => {
    const { mountImagePreview } = await import("/tests/browser/fixtures/mount-image-preview.ts");
    Object.assign(window, { __unmountPreview: mountImagePreview("Mounted preview") });
  });
  await page.getByRole("button", { name: "Open image in expanded view: Mounted preview" }).click();
  await expect(viewer(page)).toBeVisible();

  await page.evaluate(() =>
    (window as unknown as { __unmountPreview: () => void }).__unmountPreview(),
  );
  await expect(viewer(page)).toHaveCount(0);
});

test("an onViewerOpen hook that updates app state leaves the viewer working", async ({ page }) => {
  await page.locator("pre.mermaid.kit-mermaid-viewer").waitFor({ timeout: 15_000 });
  await page.evaluate(async () => {
    const { pushFrame, depth } = await import("/tests/browser/fixtures/modal-stack.svelte.ts");
    const { openMediaViewerGallery } = await import("/src/lib/utils/media-gallery.ts");
    Object.assign(window, { __depth: depth });
    const origin = document.querySelector(".kit-markdown-image")!;
    await openMediaViewerGallery(origin, { onViewerOpen: pushFrame });
  });
  const depth = () =>
    page.evaluate(() => (window as unknown as { __depth: () => number }).__depth());

  await expect(viewer(page)).toHaveAccessibleName("Screenshot A (1 of 4)");
  expect(await depth()).toBe(1);
  await page.keyboard.press("ArrowRight");
  await expect(viewer(page)).toHaveAccessibleName("Mermaid diagram (2 of 4)");
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  expect(await depth()).toBe(0);
});

const swatchItems = `[
  { kind: "image", src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'/%3E", alt: "First" },
  { kind: "image", src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'/%3E", alt: "  " },
  { kind: "image", src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'/%3E", alt: "Third" },
]`;

test("an out-of-range index wraps, and an empty alt falls back to a name", async ({ page }) => {
  await page.evaluate(async (itemsSource) => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    mountMediaViewer(new Function(`return ${itemsSource}`)(), 10);
  }, swatchItems);
  // 10 wraps to the second item, whose alt is blank.
  await expect(viewer(page)).toHaveAccessibleName("Expanded view (2 of 3)");
  await expect(counter(page)).toHaveText("2 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(viewer(page)).toHaveAccessibleName("Third (3 of 3)");
});

test("the position suffix is localizable", async ({ page }) => {
  await page.evaluate(async (itemsSource) => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    mountMediaViewer(
      new Function(`return ${itemsSource}`)(),
      0,
      (p: number, t: number) => `${p} von ${t}`,
    );
  }, swatchItems);
  await expect(viewer(page)).toHaveAccessibleName("First (1 von 3)");
});

test("replacing onViewerOpen restores the old hook and runs the new one", async ({ page }) => {
  await page.evaluate(async (itemsSource) => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    Object.assign(window, { __host: mountMediaViewer(new Function(`return ${itemsSource}`)(), 0) });
  }, swatchItems);
  await expect(viewer(page)).toBeVisible();
  const calls = () =>
    page.evaluate(() => [...(window as unknown as { __host: { calls: string[] } }).__host.calls]);
  expect(await calls()).toEqual(["open A"]);

  await page.evaluate(() =>
    (window as unknown as { __host: { replaceHook: () => void } }).__host.replaceHook(),
  );
  await expect.poll(calls).toEqual(["open A", "restore A", "open B"]);
});

test("a preview unmounted while its viewer loads opens nothing", async ({ page }) => {
  await page.evaluate(async () => {
    const { mountImagePreview } = await import("/tests/browser/fixtures/mount-image-preview.ts");
    const unmountPreview = mountImagePreview("Short-lived preview");
    document
      .querySelector<HTMLButtonElement>(
        '[aria-label="Open image in expanded view: Short-lived preview"]',
      )!
      .click();
    // Same task: the viewer's dynamic import has not resolved yet.
    unmountPreview();
  });
  await page.waitForTimeout(500);
  await expect(page.locator(".kit-media-viewer")).toHaveCount(0);
});

test("a markdown image controller disconnected while its viewer loads opens nothing", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const { initMarkdownImageViewer } = await import("/src/lib/utils/markdown-images.ts");
    const host = document.createElement("div");
    host.innerHTML = `<img alt="Pending" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'/%3E">`;
    document.body.append(host);
    const controller = initMarkdownImageViewer(host, { selector: "img" });
    host.querySelector<HTMLButtonElement>("button")!.click();
    controller.disconnect();
  });
  await page.waitForTimeout(500);
  await expect(page.locator(".kit-media-viewer")).toHaveCount(0);
});

test("a theme flip closes a viewer showing diagrams, not one showing only images", async ({
  page,
}) => {
  await page.locator("pre.mermaid.kit-mermaid-viewer").waitFor({ timeout: 15_000 });
  // The gallery takes every displayed item, so hide the diagrams to open
  // a viewer that shows only images.
  await page.getByRole("radio", { name: "Other tab" }).click();
  await page.evaluate(() => {
    for (const diagram of document.querySelectorAll<HTMLElement>("pre.mermaid"))
      diagram.hidden = true;
  });
  await page.getByRole("img", { name: "Hidden tab image" }).hover();
  await page.getByRole("button", { name: "Open image in expanded view: Hidden tab image" }).click();
  await expect(viewer(page)).toBeVisible();
  await setTheme(page, { dark: true });
  await page.waitForTimeout(300);
  await expect(viewer(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    for (const diagram of document.querySelectorAll<HTMLElement>("pre.mermaid"))
      diagram.hidden = false;
  });

  await page
    .locator("pre.mermaid.kit-mermaid-viewer")
    .getByRole("button", { name: "Open diagram in expanded view" })
    .click();
  await expect(viewer(page)).toBeVisible();
  await setTheme(page, { dark: false });
  await expect(viewer(page)).toHaveCount(0);
});

test("a two-finger pinch zooms around the fingers", async ({ page }) => {
  await page.getByRole("button", { name: "Open viewer" }).click();
  const viewport = page.locator(".kit-media-viewer__viewport");
  const scale = () =>
    page
      .locator(".kit-media-viewer__pan")
      .evaluate((node) => new DOMMatrix(node.style.transform).a);

  await viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const fire = (type: string, pointerId: number, x: number) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          pointerType: "touch",
          clientX: x,
          clientY: cy,
          bubbles: true,
        }),
      );
    fire("pointerdown", 1, cx - 50);
    fire("pointerdown", 2, cx + 50);
    // Fingers 100px apart spread to 200px: twice the scale.
    fire("pointermove", 2, cx + 150);
    fire("pointerup", 1, cx - 50);
    fire("pointerup", 2, cx + 150);
  });
  await expect.poll(scale).toBeCloseTo(2, 1);
});
