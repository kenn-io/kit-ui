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

test("wheel zoom is cursor-anchored and reset restores it", async ({ page }) => {
  const viewer = firstViewer(page);
  const pan = viewer.locator(".kit-mermaid-viewer__pan");
  await expect(pan).toHaveCSS("transform", /matrix\(1,/);

  await viewer.locator(".kit-mermaid-viewer__viewport").hover();
  await page.mouse.wheel(0, -100);
  await expect(pan).not.toHaveCSS("transform", /matrix\(1,/);

  await viewer.getByRole("button", { name: "Reset diagram view" }).click();
  await expect(pan).toHaveCSS("transform", /matrix\(1,/);
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
  await expect(lightbox).toHaveAttribute("role", "dialog");
  await expect(lightbox.locator(".kit-mermaid-viewer__pan svg")).toBeVisible();
  await expect(lightbox.getByRole("button", { name: "Close expanded diagram" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
  await expect(expand).toBeFocused();
});

test("backdrop click closes the lightbox", async ({ page }) => {
  await firstViewer(page).getByRole("button", { name: "Open diagram in expanded view" }).click();
  const lightbox = page.locator(".kit-mermaid-lightbox");
  await lightbox.click({ position: { x: 5, y: 5 } });
  await expect(lightbox).toHaveCount(0);
});

test("invalid diagrams keep their escaped source visible", async ({ page }) => {
  const failed = page.locator('pre.mermaid[data-mermaid-rendered="failed"]');
  await expect(failed).toHaveCount(1, { timeout: 15_000 });
  await expect(failed).toContainText("not mermaid");
  await expect(failed.locator("svg")).toHaveCount(0);
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
