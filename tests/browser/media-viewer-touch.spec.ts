import {
  expect,
  test,
  type Browser,
  type CDPSession,
  type Locator,
  type Page,
} from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Touch behavior of MediaViewer and the inline Mermaid viewer
// (docs/components/media-viewer.md). Real touch input through the Chrome
// DevTools Protocol, in a touch-enabled context so the coarse-pointer
// media queries match.

type Point = { x: number; y: number };

async function touchPage(
  browser: Browser,
  id: string,
): Promise<{ page: Page; cdp: CDPSession; close: () => Promise<void> }> {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await gotoPage(page, id);
  const cdp = await context.newCDPSession(page);
  return { page, cdp, close: () => context.close() };
}

function touch(cdp: CDPSession, type: string, points: Point[]) {
  return cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, id) => ({ ...point, id })),
  });
}

/** One finger from `from` to `to` in `steps` moves. */
async function drag(cdp: CDPSession, from: Point, to: Point, steps = 8) {
  await touch(cdp, "touchStart", [from]);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await touch(cdp, "touchMove", [
      { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
    ]);
  }
  await touch(cdp, "touchEnd", []);
}

async function doubleTap(cdp: CDPSession, at: Point) {
  for (let tap = 0; tap < 2; tap += 1) {
    await touch(cdp, "touchStart", [at]);
    await touch(cdp, "touchEnd", []);
  }
}

async function center(locator: Locator): Promise<Point> {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The pan element's transform as { scale, x, y }. */
function transformOf(pan: Locator) {
  return pan.evaluate((node) => {
    const matrix = new DOMMatrix((node as HTMLElement).style.transform);
    return { scale: matrix.a, x: matrix.e, y: matrix.f };
  });
}

test("a swipe pages the viewer; once zoomed, a swipe pans instead", async ({ browser }) => {
  const { page, cdp, close } = await touchPage(browser, "media-viewer");
  await page.getByRole("button", { name: "Open viewer" }).tap();
  const counter = page.locator(".kit-media-viewer__counter");
  const viewport = page.locator(".kit-media-viewer__viewport");
  await expect(counter).toHaveText("1 / 3");

  const mid = await center(viewport);
  await drag(cdp, { x: mid.x + 150, y: mid.y }, { x: mid.x - 150, y: mid.y });
  await expect(counter).toHaveText("2 / 3");
  await drag(cdp, { x: mid.x - 150, y: mid.y }, { x: mid.x + 150, y: mid.y });
  await expect(counter).toHaveText("1 / 3");

  // A mostly vertical drag is a pan, not a swipe.
  await drag(cdp, { x: mid.x, y: mid.y + 100 }, { x: mid.x + 40, y: mid.y - 100 });
  await expect(counter).toHaveText("1 / 3");

  await page.getByRole("button", { name: "Reset view" }).tap();
  await doubleTap(cdp, mid);
  await expect
    .poll(async () => (await transformOf(page.locator(".kit-media-viewer__pan"))).scale)
    .toBe(2.5);
  await drag(cdp, { x: mid.x + 150, y: mid.y }, { x: mid.x - 150, y: mid.y });
  await expect(counter).toHaveText("1 / 3");
  await close();
});

test("double-tap zooms in at the tap, and again resets", async ({ browser }) => {
  const { page, cdp, close } = await touchPage(browser, "media-viewer");
  await page.getByRole("button", { name: "Open viewer" }).tap();
  const pan = page.locator(".kit-media-viewer__pan");
  const mid = await center(page.locator(".kit-media-viewer__viewport"));

  // Off-center, so the zoom must also shift the content to keep the
  // tapped point under the finger.
  await doubleTap(cdp, { x: mid.x + 100, y: mid.y + 50 });
  await expect.poll(() => transformOf(pan)).toEqual({ scale: 2.5, x: -150, y: -75 });

  await doubleTap(cdp, { x: mid.x + 100, y: mid.y + 50 });
  await expect.poll(() => transformOf(pan)).toEqual({ scale: 1, x: 0, y: 0 });
  await close();
});

test("a two-finger pinch zooms around the fingers", async ({ browser }) => {
  const { page, cdp, close } = await touchPage(browser, "media-viewer");
  await page.getByRole("button", { name: "Open viewer" }).tap();
  const mid = await center(page.locator(".kit-media-viewer__viewport"));

  // Fingers 100px apart spread to 200px: twice the scale.
  await touch(cdp, "touchStart", [
    { x: mid.x - 50, y: mid.y },
    { x: mid.x + 50, y: mid.y },
  ]);
  for (const spread of [60, 70, 80, 90, 100]) {
    await touch(cdp, "touchMove", [
      { x: mid.x - spread, y: mid.y },
      { x: mid.x + spread, y: mid.y },
    ]);
  }
  await touch(cdp, "touchEnd", []);
  await expect
    .poll(async () => (await transformOf(page.locator(".kit-media-viewer__pan"))).scale)
    .toBeCloseTo(2, 1);
  await close();
});

test("touch devices get 44px controls", async ({ browser }) => {
  const { page, close } = await touchPage(browser, "media-viewer");
  const size = (locator: Locator) =>
    locator.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return [rect.width, rect.height];
    });

  await page.locator("pre.mermaid.kit-mermaid-viewer").first().waitFor({ timeout: 15_000 });
  for (const button of await page.locator(".kit-mermaid-viewer__button").all()) {
    expect(await size(button)).toEqual([44, 44]);
  }
  const expand = page.getByRole("button", { name: /Open image in expanded view: Screenshot A/ });
  expect(await size(expand)).toEqual([44, 44]);

  await expand.tap();
  for (const name of ["Close expanded view", "Reset view", "Previous item", "Next item"]) {
    expect(await size(page.getByRole("button", { name }))).toEqual([44, 44]);
  }
  await close();
});

test("a vertical swipe over an inline diagram scrolls the page", async ({ browser }) => {
  const { page, cdp, close } = await touchPage(browser, "mermaid");
  const diagram = page.locator("pre.mermaid.kit-mermaid-viewer").first();
  await diagram.waitFor({ timeout: 15_000 });
  const viewport = diagram.locator(".kit-mermaid-viewer__viewport");
  const pan = diagram.locator(".kit-mermaid-viewer__pan");
  const top = async () => (await diagram.boundingBox())!.y;

  const before = await top();
  const mid = await center(viewport);
  await drag(cdp, { x: mid.x, y: mid.y + 60 }, { x: mid.x, y: mid.y - 60 }, 12);
  await expect.poll(top).toBeLessThan(before - 40);
  expect((await transformOf(pan)).scale).toBe(1);

  // Horizontal drags still pan the diagram.
  const moved = await center(viewport);
  await drag(cdp, { x: moved.x + 60, y: moved.y }, { x: moved.x - 60, y: moved.y });
  await expect.poll(async () => (await transformOf(pan)).x).toBeLessThan(-40);

  // Once zoomed, touch belongs to the diagram.
  await expect(viewport).toHaveCSS("touch-action", "pan-y");
  await doubleTap(cdp, moved);
  await expect(viewport).toHaveCSS("touch-action", "none");
  await close();
});
