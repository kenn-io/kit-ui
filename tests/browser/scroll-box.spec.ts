import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// ScrollBox acceptance (docs/components/scroll-box.md): zero-gutter overlay
// scrollbars, labelled keyboard scroll region, onscroll forwarding, bindable
// viewport, sticky header clearance, rounded-corner clearance, and pointer drag.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("hides native scrollbars (0px gutter) and renders floating overlay thumb on hover", async ({
  page,
}) => {
  await gotoPage(page, "scroll-box");
  const box = page.locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Demo log"])');
  const viewport = box.locator(".kit-scrollbox__viewport");
  const track = box.locator('[data-kit-scrollbar="y"]');
  const thumb = track.locator(".kit-scrollbar__thumb");

  const metrics = await viewport.evaluate((el) => ({
    scrollbarWidth: getComputedStyle(el).scrollbarWidth,
    gutter: (el as HTMLElement).offsetWidth - el.clientWidth,
    overflows: el.scrollHeight > el.clientHeight,
  }));
  expect(metrics.scrollbarWidth).toBe("none");
  expect(metrics.gutter).toBe(0);
  expect(metrics.overflows).toBe(true);

  await box.hover();
  await expect(track).toHaveAttribute("data-visible", "true");
  await expect(thumb).toBeVisible();

  // Thumb stays clear of the rounded host corners.
  const geometry = await box.evaluate((root) => {
    const host = root.parentElement!.getBoundingClientRect();
    const t = root.querySelector('[data-kit-scrollbar="y"]')!.getBoundingClientRect();
    return {
      topGap: t.top - host.top,
      bottomGap: host.bottom - t.bottom,
    };
  });
  expect(geometry.topGap).toBeGreaterThanOrEqual(4);
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(4);
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

  await expect(page.locator('[data-test="scrolltop"]')).toHaveText("150");
});

test("supports pointer dragging on the vertical thumb and track click", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const box = page.locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Demo log"])');
  const viewport = box.locator(".kit-scrollbox__viewport");
  const track = box.locator('[data-kit-scrollbar="y"]');
  const thumb = track.locator(".kit-scrollbar__thumb");

  await box.hover();
  await expect(track).toHaveAttribute("data-visible", "true");

  const thumbBox = (await thumb.boundingBox())!;
  expect(thumbBox.height).toBeGreaterThanOrEqual(24);

  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2 + 80, {
    steps: 6,
  });
  await page.mouse.up();

  const afterDrag = await viewport.evaluate((el) => el.scrollTop);
  expect(afterDrag).toBeGreaterThan(100);

  // Track click near the top jumps back toward the start.
  const trackBox = (await track.boundingBox())!;
  await page.mouse.click(trackBox.x + trackBox.width / 2, trackBox.y + 4);
  const afterTrackClick = await viewport.evaluate((el) => el.scrollTop);
  expect(afterTrackClick).toBeLessThan(afterDrag);
});

test("two-axis ScrollBox clears sticky header and renders both thumbs", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const box = page.locator(
    '.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Sticky diff preview"])',
  );
  const viewport = box.locator(".kit-scrollbox__viewport");
  const head = box.locator(".sticky-head");
  const yTrack = box.locator('[data-kit-scrollbar="y"]');
  const xTrack = box.locator('[data-kit-scrollbar="x"]');

  await box.hover();
  await expect(yTrack).toHaveAttribute("data-visible", "true");
  await expect(xTrack).toHaveAttribute("data-visible", "true");

  const headBox = (await head.boundingBox())!;
  const yBox = (await yTrack.boundingBox())!;
  expect(yBox.y).toBeGreaterThanOrEqual(headBox.y + headBox.height - 0.5);

  // Drag horizontal thumb to scroll sideways.
  const xThumb = (await xTrack.locator(".kit-scrollbar__thumb").boundingBox())!;
  await page.mouse.move(xThumb.x + xThumb.width / 2, xThumb.y + xThumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(xThumb.x + xThumb.width / 2 + 100, xThumb.y + xThumb.height / 2, {
    steps: 6,
  });
  await page.mouse.up();

  expect(await viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
});

test("short content hides the overlay thumb", async ({ page }) => {
  await gotoPage(page, "scroll-box");
  const box = page.locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Short list"])');
  await box.hover();
  await expect(box.locator('[data-kit-scrollbar="y"]')).toHaveAttribute("data-visible", "false");
});

test("respects prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoPage(page, "scroll-box");
  const track = page
    .locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Demo log"])')
    .locator('[data-kit-scrollbar="y"]');
  await expect(track).toHaveCSS("transition-duration", "0s");
});
