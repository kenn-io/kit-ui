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

function caption(page: Page) {
  return page.locator(".kit-media-viewer__caption");
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

test("double-click zooms in on the point, and again resets", async ({ page }) => {
  // The dblclick path: iOS Safari sends a double tap's second tap only as
  // clicks and a dblclick, and a mouse double-click lands here too.
  await page.getByRole("button", { name: "Open viewer" }).click();
  const box = (await page.locator(".kit-media-viewer__viewport").boundingBox())!;
  const transform = () =>
    page.locator(".kit-media-viewer__pan").evaluate((node) => {
      const matrix = new DOMMatrix((node as HTMLElement).style.transform);
      return [matrix.a, Math.round(matrix.e), Math.round(matrix.f)];
    });
  await page.mouse.dblclick(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20);
  await expect.poll(transform).toEqual([2.5, -60, -30]);
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(transform).toEqual([1, 0, 0]);
});

test("slow wheel steps accumulate into zoom", async ({ page }) => {
  await page.getByRole("button", { name: "Open viewer" }).click();
  const viewport = page.locator(".kit-media-viewer__viewport");
  // Each step alone is under 0.1% of zoom.
  await viewport.evaluate((element) => {
    const r = element.getBoundingClientRect();
    for (let i = 0; i < 40; i += 1) {
      element.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -0.5,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  });
  const scale = await page
    .locator(".kit-media-viewer__pan")
    .evaluate((node) => new DOMMatrix((node as HTMLElement).style.transform).a);
  expect(scale).toBeGreaterThan(1.02);
  await expect(viewport).toHaveAttribute("data-zoomed", "true");
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
  await expect(caption(page)).toHaveText("Screenshot A");
  await page.keyboard.press("ArrowRight");
  await expect(viewer(page)).toHaveAccessibleName("Mermaid diagram (2 of 4)");
  await expect(viewer(page).locator(".kit-mermaid-content svg")).toBeVisible();
  // A diagram's label is generic, so it gets no caption.
  await expect(caption(page)).toHaveCount(0);
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

test("alt text shows as a caption, and a blank alt shows none", async ({ page }) => {
  await page.evaluate(async (itemsSource) => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    mountMediaViewer(new Function(`return ${itemsSource}`)(), 0);
  }, swatchItems);
  await expect(caption(page)).toHaveText("First");
  await expect(caption(page)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("2 / 3");
  await expect(caption(page)).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(caption(page)).toHaveText("Third");
});

test("a tall image starts below its caption", async ({ page }) => {
  await page.evaluate(async () => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    const tall =
      "data:image/svg+xml," +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="4000"/>');
    mountMediaViewer([{ kind: "image", src: tall, alt: "A long page screenshot" }], 0);
  });
  const image = viewer(page).getByRole("img");
  await expect(image).toBeVisible();
  const captionBox = (await caption(page).boundingBox())!;
  const imageBox = (await image.boundingBox())!;
  expect(imageBox.y).toBeGreaterThanOrEqual(captionBox.y + captionBox.height);
});

test("the position counter and accessible name are localizable", async ({ page }) => {
  await page.evaluate(async (itemsSource) => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    mountMediaViewer(new Function(`return ${itemsSource}`)(), 0, {
      formatCounter: (p: number, t: number) => `${p}/${t} Bilder`,
      formatLabel: (label: string, p: number, t: number) => `Bild ${p} von ${t}: ${label}`,
    });
  }, swatchItems);
  await expect(viewer(page)).toHaveAccessibleName("Bild 1 von 3: First");
  await expect(counter(page)).toHaveText("1/3 Bilder");
});

test("a different item at the same index resets pan and zoom", async ({ page }) => {
  await page.evaluate(async (itemsSource) => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    const items = new Function(`return ${itemsSource}`)();
    const host = mountMediaViewer(items, 0);
    (window as unknown as { __replace: () => void }).__replace = () =>
      host.replaceItems([{ ...items[1], alt: "Replacement" }, ...items.slice(1)]);
  }, swatchItems);
  const viewport = page.locator(".kit-media-viewer__viewport");
  // [scale, x, y]; engines differ in how they write an identity transform.
  const transform = () =>
    page.locator(".kit-media-viewer__pan").evaluate((node) => {
      const matrix = new DOMMatrix((node as HTMLElement).style.transform);
      return [matrix.a, matrix.e, matrix.f];
    });
  await viewport.hover();
  await page.mouse.wheel(0, -400);
  await expect.poll(transform).not.toEqual([1, 0, 0]);

  await page.evaluate(() => (window as unknown as { __replace: () => void }).__replace());
  await expect(viewer(page)).toHaveAccessibleName("Replacement (1 of 3)");
  await expect.poll(transform).toEqual([1, 0, 0]);
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

for (const [name, interrupt] of [
  ["is re-registered", "rerender"],
  ["is named in a targeted close", "close"],
] as const) {
  test(`an origin that ${name} while its viewer loads opens nothing`, async ({ page }) => {
    await page.evaluate(async (interrupt) => {
      const gallery = await import("/src/lib/utils/media-gallery.ts");
      const item = () => ({ kind: "image" as const, src: "data:,", alt: "Pending" });
      const origin = document.createElement("div");
      document.body.append(origin);
      gallery.registerMediaViewerItem(origin, item);

      // Same task: the viewer's dynamic import has not resolved yet.
      void gallery.openMediaViewerGallery(origin);
      if (interrupt === "rerender") {
        gallery.unregisterMediaViewerItem(origin);
        gallery.registerMediaViewerItem(origin, item);
      } else {
        gallery.closeMediaViewerGallery([origin]);
      }
    }, interrupt);
    await page.waitForTimeout(500);
    await expect(page.locator(".kit-media-viewer")).toHaveCount(0);
  });
}

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
