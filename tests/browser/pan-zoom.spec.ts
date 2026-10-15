import { expect, test } from "@playwright/test";
import type { PanZoom, PanZoomView } from "../../src/lib/utils/pan-zoom.js";
import { gotoPage } from "./helpers.js";

declare global {
  interface Window {
    panZoomTest: { first: PanZoom; second: PanZoom; changes: PanZoomView[]; echoes: PanZoomView[] };
  }
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "media-viewer");
  await page.evaluate(async () => {
    const { attachPanZoom } = await import("/src/lib/utils/pan-zoom.ts");
    const makePane = (id: string) => {
      const viewport = document.createElement("div");
      viewport.id = id;
      viewport.style.cssText =
        "position:fixed;top:100px;width:200px;height:200px;touch-action:none";
      viewport.style.left = id === "first" ? "100px" : "400px";
      const pan = document.createElement("div");
      pan.style.cssText = "width:200px;height:200px";
      viewport.append(pan);
      document.body.append(viewport);
      return { viewport, pan };
    };
    const a = makePane("first");
    const b = makePane("second");
    const changes: PanZoomView[] = [];
    const echoes: PanZoomView[] = [];
    const second = attachPanZoom(b.viewport, b.pan, {
      maxScale: 16,
      onChange: (view) => echoes.push(view),
    });
    const first = attachPanZoom(a.viewport, a.pan, {
      maxScale: 16,
      onChange: (view) => {
        changes.push(view);
        second.setView(view);
      },
    });
    window.panZoomTest = { first, second, changes, echoes };
  });
});

test("external views are precise, detached, silent, and validated", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { first, changes } = window.panZoomTest;
    first.setView({ scale: 12.3456789, offsetX: 31.25, offsetY: -18.5 });
    const view = first.getView();
    const renderedScale =
      document.querySelector<HTMLElement>("#first > div")!.getBoundingClientRect().width / 200;
    view.offsetX = 999;
    for (const invalid of [
      { scale: NaN, offsetX: 0, offsetY: 0 },
      { scale: 0, offsetX: 0, offsetY: 0 },
      { scale: -1, offsetX: 0, offsetY: 0 },
      { scale: 2, offsetX: Infinity, offsetY: 0 },
      { scale: 2, offsetX: 0, offsetY: NaN },
    ])
      first.setView(invalid);
    return { view: first.getView(), renderedScale, changes };
  });
  expect(result.view).toEqual({ scale: 12.3456789, offsetX: 31.25, offsetY: -18.5 });
  expect(result.renderedScale).toBeCloseTo(12.3456789, 5);
  expect(result.changes).toEqual([]);
});

test("wheel and drag link panes, and reset reports the resting view", async ({ page }) => {
  await page.locator("#first").hover();
  await page.mouse.wheel(0, -500);
  await expect
    .poll(() => page.evaluate(() => window.panZoomTest.changes.length))
    .toBeGreaterThan(0);
  await page.mouse.move(180, 180);
  await page.mouse.down();
  await page.mouse.move(210, 220);
  await page.mouse.up();
  const linked = await page.evaluate(() => {
    const { first, second } = window.panZoomTest;
    return { first: first.getView(), second: second.getView() };
  });
  expect(linked.first.scale).toBeGreaterThan(1);
  expect(linked.first.offsetX).toBe(30);
  expect(linked.first.offsetY).toBe(40);
  expect(linked.second).toEqual(linked.first);
  const reset = await page.evaluate(() => {
    const { first, second, changes, echoes } = window.panZoomTest;
    first.reset();
    return { first: first.getView(), second: second.getView(), change: changes.at(-1), echoes };
  });
  expect(reset.first).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  expect(reset.second).toEqual(reset.first);
  expect(reset.change).toEqual(reset.first);
  expect(reset.echoes).toEqual([]);
});

test("gestures and external setting share scale limits", async ({ page }) => {
  await page.evaluate(() =>
    window.panZoomTest.first.setView({ scale: 100, offsetX: 0, offsetY: 0 }),
  );
  expect(await page.evaluate(() => window.panZoomTest.first.getView().scale)).toBe(16);
  await page.locator("#first").hover();
  await page.mouse.wheel(0, 10000);
  await expect.poll(() => page.evaluate(() => window.panZoomTest.first.getView().scale)).toBe(0.4);
  await page.mouse.wheel(0, -10000);
  await expect.poll(() => page.evaluate(() => window.panZoomTest.first.getView().scale)).toBe(16);
  const defaults = await page.evaluate(async () => {
    const { attachPanZoom } = await import("/src/lib/utils/pan-zoom.ts");
    return [undefined, 0, NaN, Infinity].map((maxScale) => {
      const controller = attachPanZoom(
        document.createElement("div"),
        document.createElement("div"),
        { maxScale },
      );
      controller.setView({ scale: 100, offsetX: 0, offsetY: 0 });
      const scale = controller.getView().scale;
      controller.destroy();
      return scale;
    });
  });
  expect(defaults).toEqual([8, 8, 8, 8]);
});
