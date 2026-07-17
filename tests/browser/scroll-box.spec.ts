import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// ScrollBox acceptance (docs/components/scroll-box.md): native scrollbar,
// no custom overlay, labelled keyboard scroll region, onscroll forwarding,
// and a bindable viewport.

test("keeps native scrollbar styles and renders no custom overlay", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const box = page.locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Demo log"])');
  const viewport = box.locator(".kit-scrollbox__viewport");
  const scrollbarStyles = await viewport.evaluate((el) => {
    const style = getComputedStyle(el);
    const webkitScrollbar = getComputedStyle(el, "::-webkit-scrollbar");
    return {
      scrollbarColor: style.scrollbarColor,
      scrollbarWidth: style.scrollbarWidth,
      webkitDisplay: webkitScrollbar.display,
      webkitHeight: webkitScrollbar.height,
      webkitWidth: webkitScrollbar.width,
    };
  });

  expect(scrollbarStyles).toEqual({
    scrollbarColor: "auto",
    scrollbarWidth: "auto",
    webkitDisplay: "inline",
    webkitHeight: "auto",
    webkitWidth: "auto",
  });
  await expect(box.locator(".kit-scrollbox__indicator, .kit-scrollbox__thumb")).toHaveCount(0);
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

test("forwards scroll events with the bound viewport", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const viewport = page.locator('.kit-scrollbox__viewport[aria-label="Demo log"]');

  await viewport.evaluate((el) => {
    el.scrollTop = 150;
    el.dispatchEvent(new Event("scroll"));
  });

  // The callback reads scrollTop through bind:viewport, so this assertion
  // covers both contracts with the actual scrolling element.
  await expect(page.locator('[data-test="scrolltop"]')).toHaveText("150");
});
