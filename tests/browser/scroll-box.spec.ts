import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// ScrollBox acceptance (docs/components/scroll-box.md): labelled keyboard
// scroll region, overlay thumb that appears while scrolling and fades after
// the 700ms idle timeout, no thumb when content fits.

test("scrolling shows the overlay thumb, then it fades out", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const box = page.locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Demo log"])');
  const viewport = box.locator(".kit-scrollbox__viewport");
  const indicator = box.locator(".kit-scrollbox__indicator");

  await expect(indicator).not.toHaveClass(/kit-scrollbox__indicator--visible/);

  await viewport.evaluate((el) => {
    el.scrollTop = 150;
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(indicator).toHaveClass(/kit-scrollbox__indicator--visible/);

  // The demo forwards scroll events to its onscroll prop.
  await expect(page.locator('[data-test="scrolltop"]')).toHaveText("150");

  // Idle for the 700ms hide timeout.
  await expect(indicator).not.toHaveClass(/kit-scrollbox__indicator--visible/);

  // Thumb geometry reflects the visible fraction (viewport² / content).
  const heights = await viewport.evaluate((el) => ({
    viewport: el.clientHeight,
    content: (el.firstElementChild as HTMLElement).offsetHeight,
  }));
  const thumb = await box.locator(".kit-scrollbox__thumb").boundingBox();
  const expected = Math.max(24, (heights.viewport * heights.viewport) / heights.content);
  expect(thumb!.height).toBeCloseTo(expected, 0);
});

test("viewport is a labelled focusable region and keyboard-scrollable", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const viewport = page.locator('.kit-scrollbox__viewport[aria-label="Demo log"]');
  await expect(viewport).toHaveAttribute("role", "region");
  await expect(viewport).toHaveAttribute("tabindex", "0");

  await viewport.focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("no thumb when content fits the viewport", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const box = page.locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Short list"])');
  await box.locator(".kit-scrollbox__viewport").evaluate((el) => {
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(box.locator(".kit-scrollbox__indicator")).not.toHaveClass(
    /kit-scrollbox__indicator--visible/,
  );
});
