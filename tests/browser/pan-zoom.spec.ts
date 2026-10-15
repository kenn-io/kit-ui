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
      await expect(images).toHaveCount(2);
      // A shorter image box letterboxes both originals without changing the demo formula.
      await images.evaluateAll((all) => {
        for (const image of all) (image as HTMLElement).style.height = "120px";
      });
      const rendered = () =>
        images.evaluateAll((all) =>
          all.map((image) => ({
            physical:
              image.getBoundingClientRect().width *
              Math.min(
                1,
                (image.clientHeight / image.clientWidth) *
                  ((image as HTMLImageElement).naturalWidth /
                    (image as HTMLImageElement).naturalHeight),
              ) *
              devicePixelRatio,
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
  await page.evaluate(() => {
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
  });
  expect(await state(page)).toEqual({
    view: { scale: 6.3456789, offsetX: 31.25, offsetY: -18.5 },
    changes: 0,
    zoomed: "true",
  });
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
    const limit = (options: PanZoomOptions, scale: number) => {
      const controller = attachPanZoom(
        document.createElement("div"),
        document.createElement("div"),
        options,
      );
      controller.setView({ scale, offsetX: 0, offsetY: 0 });
      const effective = controller.getView().scale;
      controller.destroy();
      return effective;
    };
    return {
      fixed,
      mixed: [
        limit({ minScale: 0, maxScale: 32 }, 0.01),
        limit({ minScale: 0, maxScale: 32 }, 100),
      ],
      min: [undefined, 0, -1, 2, NaN, Infinity].map((minScale) => limit({ minScale }, 0.01)),
      max: [undefined, 0, 0.5, NaN, Infinity].map((maxScale) => limit({ maxScale }, 100)),
    };
  });
  expect(defaults).toEqual({
    fixed: [0.1, 32],
    mixed: [0.4, 32],
    min: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    max: [8, 8, 8, 8, 8],
  });
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
  await page.locator("#fixture").dispatchEvent("dblclick", { clientX: 300, clientY: 250 });
  expect(await state(page)).toMatchObject({
    view: { scale: 2.5, offsetX: -150, offsetY: -75 },
    changes: 5,
  });
  await page.evaluate(() => window.fixture.controller.reset());
  await touch(page, "pointerdown", 1, 150, 200);
  await touch(page, "pointerdown", 2, 250, 200);
  for (const [x, change] of [
    [300, 7],
    [300, 7],
    [350, 8],
  ] as const) {
    await touch(page, "pointermove", 2, x, 200);
    const { view, changes } = await state(page);
    const last = await page.evaluate(() => window.fixture.changes.at(-1));
    expect(changes).toBe(change);
    expect(last).toEqual(view);
  }
  expect((await state(page)).view.scale).toBeCloseTo(2, 10);
  await setView(page, { scale: 8, offsetX: 0, offsetY: 0 });
  await touch(page, "pointermove", 2, 400, 230);
  expect(await state(page)).toMatchObject({
    view: { scale: 8, offsetX: 25, offsetY: 15 },
    changes: 9,
  });
  await page.evaluate(() => window.fixture.controller.reset());
  // Each step alone is under 0.1% of zoom.
  await page.locator("#fixture").evaluate((element) => {
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
  expect((await state(page)).view.scale).toBeGreaterThan(1.02);
  expect((await state(page)).zoomed).toBe("true");
});

test("a near-1 view keeps its scale through a drag, rests, pages, and double-taps in", async ({
  page,
}) => {
  await mount(page);
  await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
  await touch(page, "pointerdown", 1, 200, 200);
  await touch(page, "pointermove", 1, 230, 200);
  await touch(page, "pointerup", 1, 230, 200);
  expect(await state(page)).toMatchObject({
    view: { offsetX: 30, offsetY: 0 },
  });
  await touch(page, "pointerdown", 1, 250, 200);
  await touch(page, "pointermove", 1, 180, 200);
  await touch(page, "pointerup", 1, 180, 200);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1]);
  expect((await state(page)).view.scale).toBe(NEAR_ONE);
  // Horizontal distance alone reaches the swipe threshold; the vertical axis rejects it.
  await touch(page, "pointerdown", 1, 150, 120);
  await touch(page, "pointermove", 1, 210, 280);
  await touch(page, "pointerup", 1, 210, 280);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1]);
  await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
  await page.evaluate(() => {
    const viewport = document.querySelector("#fixture")!;
    for (const type of ["pointerdown", "pointerup", "pointerdown", "pointerup"]) {
      viewport.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: 300,
          clientY: 250,
          bubbles: true,
        }),
      );
    }
    viewport.dispatchEvent(
      new MouseEvent("dblclick", { clientX: 300, clientY: 250, bubbles: true }),
    );
  });
  const anchored = (await state(page)).view;
  expect(anchored.scale).toBe(2.5);
  expect(anchored.offsetX).toBeCloseTo(100 * (1 - 2.5 / NEAR_ONE), 10);
  expect(anchored.offsetY).toBeCloseTo(50 * (1 - 2.5 / NEAR_ONE), 10);
  expect((await state(page)).zoomed).toBe("true");
  await touch(page, "pointerdown", 1, 250, 200);
  await touch(page, "pointermove", 1, 180, 200);
  await touch(page, "pointerup", 1, 180, 200);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1]);
  expect((await state(page)).view).toEqual({ ...anchored, offsetX: anchored.offsetX - 70 });
  const tapAt = async (x: number, y: number) => {
    await touch(page, "pointerdown", 1, x, y);
    await touch(page, "pointerup", 1, x, y);
  };
  const returningDrag = async () => {
    await touch(page, "pointerdown", 1, 200, 200);
    await touch(page, "pointermove", 1, 200, 240);
    await touch(page, "pointermove", 1, 200, 200);
    await touch(page, "pointerup", 1, 200, 200);
  };
  for (const scenario of ["release-away", "tap-drag", "drag-tap", "tap-pinch-tap"]) {
    // Cancel clears the previous tap without waiting for its timeout.
    await touch(page, "pointerdown", 1, 200, 200);
    await touch(page, "pointercancel", 1, 200, 200);
    await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
    if (scenario === "release-away") {
      await touch(page, "pointerdown", 1, 200, 200);
      await touch(page, "pointerup", 1, 200, 220);
      await tapAt(200, 220);
    } else if (scenario === "tap-drag") {
      await tapAt(200, 200);
      await returningDrag();
    } else if (scenario === "drag-tap") {
      await returningDrag();
      await tapAt(200, 200);
    } else {
      await tapAt(200, 200);
      await touch(page, "pointerdown", 1, 150, 200);
      await touch(page, "pointerdown", 2, 250, 200);
      await touch(page, "pointermove", 2, 350, 200);
      await touch(page, "pointerup", 2, 350, 200);
      await touch(page, "pointerup", 1, 150, 200);
      await tapAt(200, 200);
    }
    expect((await state(page)).view.scale).toBe(
      scenario === "tap-pinch-tap" ? 2 * NEAR_ONE : NEAR_ONE,
    );
  }
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

test("cancellation keeps its destination through equal echoes and applied views", async ({
  page,
}) => {
  await mount(page, { echo: true });
  await touch(page, "pointerdown", 1, 200, 200);
  await touch(page, "pointermove", 1, 230, 200);
  expect(await state(page)).toMatchObject({ view: { offsetX: 30 }, changes: 1 });
  await touch(page, "pointercancel", 1, 230, 200);
  expect(await state(page)).toMatchObject({
    view: { scale: 1, offsetX: 0, offsetY: 0 },
    changes: 2,
  });
  const applied = { scale: 2, offsetX: 5, offsetY: 5 };
  await touch(page, "pointerdown", 1, 200, 200);
  await touch(page, "pointermove", 1, 230, 200);
  await setView(page, applied);
  await touch(page, "pointercancel", 1, 230, 200);
  expect(await state(page)).toMatchObject({ view: applied, changes: 3 });
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
