import { expect, test, type Page } from "@playwright/test";
import type { PanZoom, PanZoomOptions, PanZoomView } from "../../src/lib/utils/pan-zoom.js";
import { gotoPage } from "./helpers.js";

// The demo's linked panes cover exact sizing end to end. A bare fixture pane
// exposes the controller for callback counts, swipes, and cancellation,
// driven by deterministic pointer events.

declare global {
  interface Window {
    fixture: { controller: PanZoom; changes: PanZoomView[]; swipes: number[] };
  }
}

const NEAR_ONE = 1561 / 1560;

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "pan-zoom");
});

async function mount(
  page: Page,
  options: { minScale?: number; maxScale?: number; echo?: boolean } = {},
) {
  await page.evaluate(async ({ echo, ...limits }) => {
    const { attachPanZoom } = await import("/src/lib/utils/pan-zoom.ts");
    const viewport = document.createElement("div");
    viewport.id = "fixture";
    viewport.style.cssText =
      "position:fixed;left:100px;top:100px;width:200px;height:200px;z-index:1000;touch-action:none";
    const pan = document.createElement("div");
    pan.style.cssText = "width:200px;height:200px";
    viewport.append(pan);
    document.body.append(viewport);
    const changes: PanZoomView[] = [];
    const swipes: number[] = [];
    const controller = attachPanZoom(viewport, pan, {
      ...limits,
      onSwipe: (direction) => swipes.push(direction),
      onChange: (view) => {
        changes.push(view);
        if (echo) controller.setView({ ...view });
      },
    } satisfies PanZoomOptions);
    window.fixture = { controller, changes, swipes };
  }, options);
}

const state = (page: Page) =>
  page.evaluate(() => ({
    view: window.fixture.controller.getView(),
    changes: window.fixture.changes.length,
    zoomed: document.querySelector<HTMLElement>("#fixture")!.dataset["zoomed"] ?? null,
  }));

const setView = (page: Page, view: PanZoomView) =>
  page.evaluate((view) => window.fixture.controller.setView(view), view);

/** Touch pointer input with real timestamps; ids 1 and 2 are two fingers. */
async function touch(page: Page, type: string, id: number, x: number, y: number) {
  await page.locator("#fixture").dispatchEvent(type, {
    pointerId: id,
    pointerType: "touch",
    isPrimary: id === 1,
    clientX: x,
    clientY: y,
    bubbles: true,
  });
}

async function mouseDrag(page: Page, from: [number, number], moves: [number, number][]) {
  await page.mouse.move(...from);
  await page.mouse.down();
  for (const point of moves) await page.mouse.move(...point);
  await page.mouse.up();
}

for (const deviceScaleFactor of [1, 2, 3]) {
  test.describe(`at device-pixel ratio ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });

    test("linked panes show either original at exact physical size through a drag", async ({
      page,
    }) => {
      const panes = page.locator(".pan-zoom-demo__pane");
      const images = panes.locator("img");
      const rendered = () =>
        images.evaluateAll((all) =>
          all.map((image) => ({
            physical: image.getBoundingClientRect().width * devicePixelRatio,
            natural: (image as HTMLImageElement).naturalWidth,
            transform: image.style.transform,
          })),
        );
      for (const [index, label] of [
        [0, "Large"],
        [1, "Small"],
      ] as const) {
        await page.getByRole("button", { name: `${label} at actual pixels` }).click();
        const box = (await panes.nth(index).boundingBox())!;
        for (const drag of [false, true]) {
          if (drag) await mouseDrag(page, [box.x + 120, box.y + 72], [[box.x + 150, box.y + 112]]);
          const [first, second] = await rendered();
          const exact = index === 0 ? first! : second!;
          expect(exact.physical).toBeCloseTo(exact.natural, 3);
          expect(second!.transform).toBe(first!.transform);
          expect(
            first!.transform.startsWith(drag ? "translate(30px, 40px)" : "translate(0px, 0px)"),
          ).toBe(true);
        }
        await expect(panes.nth(0)).toHaveAttribute("data-zoomed", "true");
      }
      await page.getByRole("button", { name: "Fit", exact: true }).click();
      expect((await rendered()).map(({ transform }) => transform)).toEqual([
        "translate(0px, 0px) scale(1)",
        "translate(0px, 0px) scale(1)",
      ]);
    });
  });
}

test("views are precise, detached, silent, and validated", async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(() => {
    const { controller } = window.fixture;
    controller.setView({ scale: 6.3456789, offsetX: 31.25, offsetY: -18.5 });
    controller.getView().offsetX = 999;
    for (const invalid of [
      { scale: NaN, offsetX: 0, offsetY: 0 },
      { scale: 0, offsetX: 0, offsetY: 0 },
      { scale: -1, offsetX: 0, offsetY: 0 },
      { scale: 2, offsetX: Infinity, offsetY: 0 },
      { scale: 2, offsetX: 0, offsetY: NaN },
    ])
      controller.setView(invalid);
    return (
      document.querySelector<HTMLElement>("#fixture > div")!.getBoundingClientRect().width / 200
    );
  });
  // Beyond the six digits Chromium serializes, and the old four-decimal rounding.
  expect(result).toBeCloseTo(6.3456789, 6);
  expect(await state(page)).toEqual({
    view: { scale: 6.3456789, offsetX: 31.25, offsetY: -18.5 },
    changes: 0,
    zoomed: "true",
  });
});

test("bounds stay fixed and invalid limits fall back independently", async ({ page }) => {
  const scales = await page.evaluate(async () => {
    const { attachPanZoom } = await import("/src/lib/utils/pan-zoom.ts");
    const limits = { minScale: 0.1, maxScale: 32 };
    const controller = attachPanZoom(
      document.createElement("div"),
      document.createElement("div"),
      limits,
    );
    limits.minScale = 0.9;
    limits.maxScale = 2;
    const read = (scale: number) => {
      controller.setView({ scale, offsetX: 0, offsetY: 0 });
      return controller.getView().scale;
    };
    const fixed = [read(0.01), read(100)];
    controller.destroy();
    const mixed = [
      { minScale: 0, maxScale: 32 },
      { minScale: 0.1, maxScale: NaN },
    ].map((options) => {
      const c = attachPanZoom(
        document.createElement("div"),
        document.createElement("div"),
        options,
      );
      c.setView({ scale: 0.01, offsetX: 0, offsetY: 0 });
      const min = c.getView().scale;
      c.setView({ scale: 100, offsetX: 0, offsetY: 0 });
      const max = c.getView().scale;
      c.destroy();
      return [min, max];
    });
    return { fixed, mixed };
  });
  expect(scales).toEqual({
    fixed: [0.1, 32],
    mixed: [
      [0.4, 32],
      [0.1, 8],
    ],
  });
});

test("actual-pixel sizing uses the fitted width of a letterboxed image", async ({ page }) => {
  const physicalWidth = await page.evaluate(async () => {
    const { attachPanZoom } = await import("/src/lib/utils/pan-zoom.ts");
    const viewport = document.createElement("div");
    const image = new Image();
    image.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='160'/%3E";
    image.style.cssText = "width:240px;height:144px;object-fit:contain";
    viewport.append(image);
    document.body.append(viewport);
    await image.decode();
    const fittedW = Math.min(
      image.clientWidth,
      (image.clientHeight * image.naturalWidth) / image.naturalHeight,
    );
    const c = attachPanZoom(viewport, image, { minScale: 0.1, maxScale: 32 });
    c.setView({ scale: image.naturalWidth / (fittedW * devicePixelRatio), offsetX: 0, offsetY: 0 });
    const actual =
      ((image.getBoundingClientRect().width * fittedW) / image.clientWidth) * devicePixelRatio;
    c.destroy();
    return actual;
  });
  expect(physicalWidth).toBeCloseTo(80, 4);
});

test("a changed near-1 view replaces pinch settle intent until a later rescale", async ({
  page,
}) => {
  await mount(page);
  for (const rescale of [false, true]) {
    await touch(page, "pointerdown", 1, 150, 200);
    await touch(page, "pointerdown", 2, 250, 200);
    await touch(page, "pointermove", 2, 350, 200);
    await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
    if (rescale) await touch(page, "pointermove", 2, 349.98, 200);
    await touch(page, "pointerup", 2, 349.98, 200);
    await touch(page, "pointerup", 1, 150, 200);
    expect((await state(page)).view.scale).toBe(rescale ? 1 : NEAR_ONE);
  }
});

test("setters and gestures share scale limits, and invalid limits use defaults", async ({
  page,
}) => {
  await mount(page, { minScale: 0.25, maxScale: 16 });
  await setView(page, { scale: 100, offsetX: 0, offsetY: 0 });
  expect((await state(page)).view.scale).toBe(16);
  await setView(page, { scale: 0.01, offsetX: 0, offsetY: 0 });
  expect((await state(page)).view.scale).toBe(0.25);
  await page.mouse.move(200, 200);
  await page.mouse.wheel(0, -10000);
  await expect.poll(async () => (await state(page)).view.scale).toBe(16);
  await page.mouse.wheel(0, 10000);
  await expect.poll(async () => (await state(page)).view.scale).toBe(0.25);
  const defaults = await page.evaluate(async () => {
    const { attachPanZoom } = await import("/src/lib/utils/pan-zoom.ts");
    const limit = (options: PanZoomOptions, scale: number) => {
      const controller = attachPanZoom(
        document.createElement("div"),
        document.createElement("div"),
        options,
      );
      controller.setView({ scale, offsetX: 0, offsetY: 0 });
      return controller.getView().scale;
    };
    return {
      min: [undefined, 0, -1, 2, NaN, Infinity].map((minScale) => limit({ minScale }, 0.01)),
      max: [undefined, 0, 0.5, NaN, Infinity].map((maxScale) => limit({ maxScale }, 100)),
    };
  });
  expect(defaults).toEqual({ min: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4], max: [8, 8, 8, 8, 8] });
});

test("each changed input reports one completed view, including clamped pinches that pan", async ({
  page,
}) => {
  await mount(page);
  await mouseDrag(
    page,
    [200, 200],
    [
      [200, 200],
      [210, 205],
      [230, 215],
    ],
  );
  expect(await state(page)).toMatchObject({
    view: { scale: 1, offsetX: 30, offsetY: 15 },
    changes: 2,
  });
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await state(page)).changes).toBe(3);
  await page.mouse.dblclick(200, 200);
  expect(await state(page)).toMatchObject({
    view: { scale: 1, offsetX: 0, offsetY: 0 },
    changes: 4,
  });
  await page.mouse.dblclick(200, 200);
  expect(await state(page)).toMatchObject({ view: { scale: 2.5 }, changes: 5 });
  await page.evaluate(() => window.fixture.controller.reset());
  await touch(page, "pointerdown", 1, 150, 200);
  await touch(page, "pointerdown", 2, 250, 200);
  for (const [x, change] of [
    [300, 6],
    [300, 6],
    [350, 7],
  ] as const) {
    await touch(page, "pointermove", 2, x, 200);
    const { view, changes } = await state(page);
    const last = await page.evaluate(() => window.fixture.changes.at(-1));
    expect(changes).toBe(change + 1);
    expect(last).toEqual(view);
  }
  expect((await state(page)).view.scale).toBeCloseTo(2, 10);
  await setView(page, { scale: 8, offsetX: 0, offsetY: 0 });
  await touch(page, "pointermove", 2, 400, 230);
  expect(await state(page)).toMatchObject({
    view: { scale: 8, offsetX: 25, offsetY: 15 },
    changes: 9,
  });
});

test("a near-1 view keeps its scale through a drag, rests, pages, and double-taps in", async ({
  page,
}) => {
  await mount(page);
  await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
  await mouseDrag(page, [200, 200], [[230, 240]]);
  expect(await state(page)).toEqual({
    view: { scale: NEAR_ONE, offsetX: 30, offsetY: 40 },
    changes: 1,
    zoomed: null,
  });
  await touch(page, "pointerdown", 1, 250, 200);
  await touch(page, "pointermove", 1, 180, 200);
  await touch(page, "pointerup", 1, 180, 200);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1]);
  expect((await state(page)).view.scale).toBe(NEAR_ONE);
  for (let tap = 0; tap < 2; tap++) {
    await touch(page, "pointerdown", 1, 200, 200);
    await touch(page, "pointerup", 1, 200, 200);
  }
  expect(await state(page)).toMatchObject({ view: { scale: 2.5 }, changes: 3, zoomed: "true" });
});

test("only a pinch that changed scale settles at 1 on release", async ({ page }) => {
  await mount(page);
  await touch(page, "pointerdown", 1, 150, 200);
  await touch(page, "pointerdown", 2, 250, 200);
  await touch(page, "pointermove", 2, 350, 200);
  await touch(page, "pointermove", 2, 250.05, 200);
  expect((await state(page)).view.scale).not.toBe(1);
  await touch(page, "pointerup", 2, 250.05, 200);
  const before = (await state(page)).changes;
  await touch(page, "pointerup", 1, 150, 200);
  expect(await state(page)).toMatchObject({ view: { scale: 1 }, changes: before + 1 });
  await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
  await touch(page, "pointerdown", 1, 150, 200);
  await touch(page, "pointerdown", 2, 250, 200);
  // Same finger distance, so it pans without changing scale.
  await touch(page, "pointermove", 2, 210, 280);
  await touch(page, "pointerup", 2, 210, 280);
  await touch(page, "pointerup", 1, 150, 200);
  expect((await state(page)).view.scale).toBe(NEAR_ONE);
});

test("cancellation keeps its destination through equal echoes and invalid views", async ({
  page,
}) => {
  await mount(page, { echo: true });
  await touch(page, "pointerdown", 1, 200, 200);
  await touch(page, "pointermove", 1, 230, 200);
  await setView(page, { scale: NaN, offsetX: 0, offsetY: 0 });
  expect(await state(page)).toMatchObject({ view: { offsetX: 30 }, changes: 1 });
  await touch(page, "pointercancel", 1, 230, 200);
  expect(await state(page)).toMatchObject({
    view: { scale: 1, offsetX: 0, offsetY: 0 },
    changes: 2,
  });
});

test("a different applied view becomes the cancellation destination", async ({ page }) => {
  await mount(page);
  const applied = { scale: 2, offsetX: 5, offsetY: 5 };
  await touch(page, "pointerdown", 1, 200, 200);
  await touch(page, "pointermove", 1, 230, 200);
  await setView(page, applied);
  await touch(page, "pointercancel", 1, 230, 200);
  expect(await state(page)).toMatchObject({ view: applied, changes: 1 });
  await touch(page, "pointerdown", 1, 200, 200);
  await setView(page, applied);
  await touch(page, "pointermove", 1, 230, 200);
  await touch(page, "pointercancel", 1, 230, 200);
  expect((await state(page)).view).toEqual(applied);
  await touch(page, "pointerdown", 1, 200, 200);
  await touch(page, "pointermove", 1, 230, 200);
  await page.evaluate(() => window.fixture.controller.reset());
  await touch(page, "pointermove", 1, 260, 220);
  await touch(page, "pointercancel", 1, 260, 220);
  expect(await state(page)).toMatchObject({
    view: { scale: 1, offsetX: 0, offsetY: 0 },
    changes: 7,
  });
});
