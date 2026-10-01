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
// (docs/components/media-viewer.md), in a touch-enabled context so the
// coarse-pointer media queries match. Gestures use real touch input
// through the Chrome DevTools Protocol, so they run in Chromium only;
// layout and tap tests run in every engine.

type Point = { x: number; y: number };

async function touchPage(
  browser: Browser,
  id: string,
  viewport = { width: 1280, height: 800 },
): Promise<{ page: Page; cdp: CDPSession; close: () => Promise<void> }> {
  const context = await browser.newContext({ hasTouch: true, viewport });
  const page = await context.newPage();
  await gotoPage(page, id);
  const cdp =
    browser.browserType().name() === "chromium"
      ? await context.newCDPSession(page)
      : (null as unknown as CDPSession);
  return { page, cdp, close: () => context.close() };
}

function touch(cdp: CDPSession, type: string, points: Point[]) {
  return cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, id) => ({ ...point, id })),
  });
}

/** Lift the fingers after holding them still at `points`. CDP moves arrive
 * with no time between them, so lifting mid-move reads as a fast fling.
 * Chromium then swallows the next tap as the one that stops the fling,
 * and a tapped button gets no click. */
async function release(cdp: CDPSession, points: Point[]) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  await touch(cdp, "touchMove", points);
  await touch(cdp, "touchEnd", []);
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
  await release(cdp, [to]);
}

/** Two fingers from `from` to `to` (each a pair of points). */
async function twoFingers(cdp: CDPSession, from: [Point, Point], to: [Point, Point], steps = 5) {
  await touch(cdp, "touchStart", from);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await touch(
      cdp,
      "touchMove",
      from.map((point, i) => ({
        x: point.x + (to[i]!.x - point.x) * t,
        y: point.y + (to[i]!.y - point.y) * t,
      })),
    );
  }
  await release(cdp, to);
}

async function tap(cdp: CDPSession, at: Point) {
  await touch(cdp, "touchStart", [at]);
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
function viewer(page: Page) {
  return page.getByRole("dialog");
}

function transformOf(pan: Locator) {
  return pan.evaluate((node) => {
    const matrix = new DOMMatrix((node as HTMLElement).style.transform);
    return { scale: matrix.a, x: matrix.e, y: matrix.f };
  });
}

test("a swipe pages the viewer; once zoomed, a swipe pans instead", async ({ browser }) => {
  test.skip(browser.browserType().name() !== "chromium", "CDP touch input");
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
  test.skip(browser.browserType().name() !== "chromium", "CDP touch input");
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
  test.skip(browser.browserType().name() !== "chromium", "CDP touch input");
  const { page, cdp, close } = await touchPage(browser, "media-viewer");
  await page.getByRole("button", { name: "Open viewer" }).tap();
  const mid = await center(page.locator(".kit-media-viewer__viewport"));

  // Fingers 100px apart spread to 200px in quarter-pixel steps, the size
  // real fingers report: twice the scale, with no step lost to rounding.
  await twoFingers(
    cdp,
    [
      { x: mid.x - 50, y: mid.y },
      { x: mid.x + 50, y: mid.y },
    ],
    [
      { x: mid.x - 100, y: mid.y },
      { x: mid.x + 100, y: mid.y },
    ],
    200,
  );
  await expect
    .poll(async () => (await transformOf(page.locator(".kit-media-viewer__pan"))).scale)
    .toBeCloseTo(2, 1);
  await close();
});

test("only a still, quick touch counts toward a double tap", async ({ browser }) => {
  test.skip(browser.browserType().name() !== "chromium", "CDP touch input");
  const { page, cdp, close } = await touchPage(browser, "media-viewer");
  await page.getByRole("button", { name: "Open viewer" }).tap();
  const pan = page.locator(".kit-media-viewer__pan");
  const reset = page.getByRole("button", { name: "Reset view" });
  const mid = await center(page.locator(".kit-media-viewer__viewport"));
  const scale = async () => (await transformOf(pan)).scale;
  const outAndBack = async () => {
    await touch(cdp, "touchStart", [mid]);
    await touch(cdp, "touchMove", [{ x: mid.x, y: mid.y + 40 }]);
    await touch(cdp, "touchMove", [mid]);
    await touch(cdp, "touchEnd", []);
  };

  // A tap, then a drag that ends where it started: no zoom.
  await tap(cdp, mid);
  await outAndBack();
  await page.waitForTimeout(150);
  expect(await scale()).toBe(1);

  // The drag first, then a tap: no zoom.
  await reset.tap();
  await page.waitForTimeout(350);
  await outAndBack();
  await tap(cdp, mid);
  await page.waitForTimeout(150);
  expect(await scale()).toBe(1);

  // A tap, a pinch, a tap: the pinch's zoom stays.
  await page.waitForTimeout(350);
  await tap(cdp, mid);
  await twoFingers(
    cdp,
    [
      { x: mid.x - 50, y: mid.y },
      { x: mid.x + 50, y: mid.y },
    ],
    [
      { x: mid.x - 100, y: mid.y },
      { x: mid.x + 100, y: mid.y },
    ],
  );
  await tap(cdp, mid);
  await page.waitForTimeout(150);
  expect(await scale()).toBeCloseTo(2, 1);
  await close();
});

test("on a phone the controls stay apart and tappable, and the backdrop closes", async ({
  browser,
}) => {
  const { page, close } = await touchPage(browser, "media-viewer", { width: 390, height: 844 });
  await page.getByRole("button", { name: "Open viewer" }).tap();
  const panel = (await viewer(page).boundingBox())!;
  const names = ["Close expanded view", "Reset view", "Previous item", "Next item"];
  const boxes = [];
  for (const name of names) {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(panel.x);
    expect(box.y).toBeGreaterThanOrEqual(panel.y);
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
    expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
    boxes.push(box);
  }
  const counterBox = (await page.locator(".kit-media-viewer__counter").boundingBox())!;
  for (const [i, a] of [...boxes, counterBox].entries()) {
    for (const b of [...boxes, counterBox].slice(i + 1)) {
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart).toBe(true);
    }
  }

  const counter = page.locator(".kit-media-viewer__counter");
  await page.getByRole("button", { name: "Next item" }).tap();
  await expect(counter).toHaveText("2 / 3");
  await page.getByRole("button", { name: "Previous item" }).tap();
  await expect(counter).toHaveText("1 / 3");

  // The 5% margin around the panel is backdrop. A link fills the page
  // beneath the overlay: the tap must close the viewer and not also
  // follow the link (its click must not fall through once closed).
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "#followed";
    link.style.cssText = "position: fixed; inset: 0; z-index: 1;";
    document.body.append(link);
  });
  await page.touchscreen.tap(panel.x / 2, panel.y / 2);
  await expect(viewer(page)).toBeHidden();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => location.hash)).toBe("#media-viewer");
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
  test.skip(browser.browserType().name() !== "chromium", "CDP touch input");
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
  // Moves before the browser took the scroll leave no offset behind.
  expect(await transformOf(pan)).toEqual({ scale: 1, x: 0, y: 0 });

  // Horizontal drags still pan the diagram.
  const moved = await center(viewport);
  await drag(cdp, { x: moved.x + 60, y: moved.y }, { x: moved.x - 60, y: moved.y });
  await expect.poll(async () => (await transformOf(pan)).x).toBeLessThan(-40);

  // A pinch whose fingers drift vertically zooms; the page stays put.
  await page.getByRole("button", { name: "Reset diagram view" }).first().tap();
  await expect.poll(() => transformOf(pan)).toEqual({ scale: 1, x: 0, y: 0 });
  const settled = await top();
  await twoFingers(
    cdp,
    [
      { x: moved.x - 30, y: moved.y + 30 },
      { x: moved.x + 30, y: moved.y + 30 },
    ],
    [
      { x: moved.x - 60, y: moved.y - 30 },
      { x: moved.x + 60, y: moved.y - 30 },
    ],
    10,
  );
  await expect.poll(async () => (await transformOf(pan)).scale).toBeGreaterThan(1.5);
  expect(await top()).toBe(settled);
  await page.getByRole("button", { name: "Reset diagram view" }).first().tap();
  await expect.poll(() => transformOf(pan)).toEqual({ scale: 1, x: 0, y: 0 });

  // Once zoomed, touch belongs to the diagram.
  await expect(viewport).toHaveCSS("touch-action", "pan-y");
  await doubleTap(cdp, moved);
  await expect(viewport).toHaveCSS("touch-action", "none");
  await close();
});
