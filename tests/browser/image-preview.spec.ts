import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("expandable preview buttons include the image identity in their accessible names", async ({
  page,
}) => {
  await gotoPage(page, "image-preview");

  await expect(
    page.getByRole("button", { name: /^Open image in expanded view: Demo shapes$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Open image in expanded view: Demo shapes, small$/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open image in expanded view$/ })).toHaveCount(0);
});

// ImagePreview sizing (docs/components/image-preview.md): images keep their
// natural size, and an SVG that declares only a viewBox, which has no
// natural size, fills the panel instead of collapsing.

function svg(markup: string): string {
  return "data:image/svg+xml," + encodeURIComponent(markup);
}

async function renderedSize(page: Page, alt: string, src: string) {
  await page.evaluate(
    async ([previewAlt, previewSrc]) => {
      const { mountImagePreview } = await import("/tests/browser/fixtures/mount-image-preview.ts");
      mountImagePreview(previewAlt, previewSrc);
    },
    [alt, src] as const,
  );
  const image = page.getByRole("img", { name: alt });
  await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).complete)).toBe(true);
  return image.evaluate((img) => {
    const panel = img.closest(".kit-image-preview")!;
    const style = getComputedStyle(panel);
    // Border-box size, so a 1px image border counts toward the panel width.
    return {
      width: (img as HTMLImageElement).offsetWidth,
      height: (img as HTMLImageElement).offsetHeight,
      panelContent:
        panel.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight),
    };
  });
}

test("an SVG with only a viewBox fills the panel", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await gotoPage(page, "image-preview");
  const size = await renderedSize(
    page,
    "Viewbox only",
    svg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256"><rect width="512" height="256"/></svg>',
    ),
  );
  expect(size.width).toBeCloseTo(size.panelContent, 0);
  // 2px of border on each axis around a 2:1 image.
  expect(size.height - 2).toBeCloseTo((size.width - 2) / 2, 0);
});

test("a small sized image keeps its natural size", async ({ page }) => {
  await gotoPage(page, "image-preview");
  const size = await renderedSize(
    page,
    "Small icon",
    svg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>',
    ),
  );
  expect(size).toMatchObject({ width: 26, height: 26 });
});
