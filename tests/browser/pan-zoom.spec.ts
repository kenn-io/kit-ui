import { expect, test, type Page } from "@playwright/test";
import type { PanZoom, PanZoomOptions, PanZoomView } from "../../src/lib/utils/pan-zoom.js";
import { gotoPage } from "./helpers.js";

// The demo's linked panes cover exact sizing end to end. A bare fixture pane
// exposes the controller for callback counts, swipes, and cancellation,
// driven by deterministic pointer events.

declare global {
  interface Window {
    fixture: { controller: PanZoom; changes: PanZoomView[]; swipes: number[] };
    resolutionQuery: MediaQueryList;
  }
}

const NEAR_ONE = 1561 / 1560;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const match = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = match(query);
      if (query.startsWith("(resolution:")) window.resolutionQuery = result;
      return result;
    };
  });
  await gotoPage(page, "pan-zoom");
});

async function mount(
  page: Page,
  options: { minScale?: number; maxScale?: number; echo?: boolean } = {},
) {
  await page.evaluate(async ({ echo, ...limits }) => {
    const { attachPanZoom } = await import("/src/lib/utils/pan-zoom.ts");
    window.fixture?.controller.destroy();
    document.querySelector("#fixture")?.remove();
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

test("the comparison demo preserves linked and independent views", async ({ page }) => {
  const panes = page.locator(".pan-zoom-demo__pane");
  const transforms = () =>
    panes.locator("img").evaluateAll((images) => images.map((image) => image.style.transform));
  const fittedWidth = () =>
    panes
      .first()
      .locator("img")
      .evaluate((image) =>
        Math.min(
          image.clientWidth,
          (image.clientHeight * image.naturalWidth) / image.naturalHeight,
        ),
      );
  const matrix = () =>
    panes
      .first()
      .locator("img")
      .evaluate((image) => {
        const m = new DOMMatrix(image.style.transform);
        return { scale: m.a, x: m.e, y: m.f };
      });
  const resize = async () => {
    const initialWidth = await fittedWidth();
    for (const larger of [true, false]) {
      await page.getByRole("button", { name: /^(Larger|Smaller) panes$/ }).click();
      if (larger) await expect.poll(fittedWidth).toBeGreaterThan(initialWidth);
      else await expect.poll(fittedWidth).toBe(initialWidth);
      const linked = await transforms();
      expect(linked[1]).toBe(linked[0]);
    }
  };
  const density = async (value: number) => {
    await page.evaluate((value) => {
      Object.defineProperty(window, "devicePixelRatio", {
        value,
        configurable: true,
      });
      window.resolutionQuery.dispatchEvent(new Event("change"));
    }, value);
    await expect(page.locator("output")).toContainText(`DPR ${value}`);
  };
  for (const [width, dpr] of [
    [80, 4],
    [6000, 0.5],
  ] as const) {
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await panes.locator("img").evaluateAll((images, width) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = width * 0.6;
      const src = canvas.toDataURL();
      images.forEach((image) => {
        image.src = src;
      });
    }, width);
    await expect
      .poll(() =>
        panes
          .locator("img")
          .evaluateAll(
            (images, width) =>
              images.every((image) => image.complete && image.naturalWidth === width),
            width,
          ),
      )
      .toBe(true);
    await density(dpr);
    await page.getByRole("button", { name: "Actual pixels", exact: true }).click();
    const fitted = await fittedWidth();
    const scale = width / (fitted * dpr);
    expect((await matrix()).scale).toBeCloseTo(scale, 5);
    const box = (await panes.first().boundingBox())!;
    await mouseDrag(page, [box.x + 120, box.y + 72], [[box.x + 150, box.y + 112]]);
    const panned = await transforms();
    expect(panned[1]).toBe(panned[0]);
    await resize();
    const nextDpr = dpr === 4 ? 2 : 1;
    await density(nextDpr);
    const linked = await transforms();
    expect(linked[1]).toBe(linked[0]);
  }
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  for (const transform of await transforms()) {
    const view = await page.evaluate((transform) => {
      const matrix = new DOMMatrix(transform);
      return { scale: matrix.a, x: matrix.e, y: matrix.f };
    }, transform);
    expect(view).toEqual({ scale: 1, x: 0, y: 0 });
  }
  const boxes = await panes.evaluateAll((elements) =>
    elements.map((element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y };
    }),
  );
  const link = page.getByRole("switch", { name: "Link views" });
  await expect(link).toBeChecked();
  await link.uncheck();
  const initial = await transforms();
  await panes.first().dispatchEvent("wheel", {
    deltaY: -100,
    clientX: boxes[0]!.x + 50,
    clientY: boxes[0]!.y + 50,
  });
  const firstChanged = await transforms();
  expect(firstChanged[0]).not.toBe(initial[0]);
  expect(firstChanged[1]).toBe(initial[1]);
  await panes.last().dispatchEvent("wheel", {
    deltaY: -200,
    clientX: boxes[1]!.x + 50,
    clientY: boxes[1]!.y + 50,
  });
  const secondChanged = await transforms();
  expect(secondChanged[0]).toBe(firstChanged[0]);
  expect(secondChanged[1]).not.toBe(firstChanged[1]);
  await link.check();
  expect(await transforms()).toEqual([secondChanged[1], secondChanged[1]]);
  await link.uncheck();
  await page.getByRole("button", { name: "Actual pixels", exact: true }).click();
  const paneViews = () =>
    panes.locator("img").evaluateAll((images) =>
      images.map((image) => {
        const matrix = new DOMMatrix(image.style.transform);
        const fitted = Math.min(
          image.clientWidth,
          (image.clientHeight * image.naturalWidth) / image.naturalHeight,
        );
        return {
          scale: matrix.a,
          x: matrix.e,
          y: matrix.f,
          fitted,
          width: image.naturalWidth,
        };
      }),
    );
  await expect(page.getByLabel("Zoom scale")).toContainText("1:1");
  await mouseDrag(
    page,
    [boxes[0]!.x + 100, boxes[0]!.y + 100],
    [[boxes[0]!.x + 120, boxes[0]!.y + 130]],
  );
  await panes.last().dispatchEvent("wheel", {
    deltaY: 100,
    clientX: boxes[1]!.x + 50,
    clientY: boxes[1]!.y + 50,
  });
  await expect(page.getByLabel("Zoom scale")).toContainText("0.86:1");
  for (const change of ["density", "resize"]) {
    const before = await paneViews();
    if (change === "density") {
      await density(2);
      await expect(page.getByLabel("Zoom scale")).toContainText("1.72:1");
    } else {
      await page.getByRole("button", { name: "Larger panes", exact: true }).click();
      await expect
        .poll(async () => (await paneViews())[0]!.fitted)
        .toBeGreaterThan(before[0]!.fitted);
    }
    await expect
      .poll(async () =>
        (await paneViews()).map((view, index) => {
          const old = before[index]!;
          const scale =
            index === 0
              ? (old.scale * old.fitted) / view.fitted / (change === "density" ? 2 : 1)
              : old.scale;
          const ratio = (scale * view.fitted) / (old.scale * old.fitted);
          return {
            scale: view.scale - scale,
            x: view.x - old.x * ratio,
            y: view.y - old.y * ratio,
          };
        }),
      )
      .toEqual([
        {
          scale: expect.closeTo(0, 4),
          x: expect.closeTo(0, 2),
          y: expect.closeTo(0, 2),
        },
        {
          scale: expect.closeTo(0, 4),
          x: expect.closeTo(0, 2),
          y: expect.closeTo(0, 2),
        },
      ]);
  }
});

test("comparison panes share a row and stack on narrow screens", async ({ page }) => {
  const panes = page.locator(".pan-zoom-demo__pane");
  await expect(panes).toHaveCount(2);
  const boxes = await panes.evaluateAll((elements) =>
    elements.map((element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, right: r.right };
    }),
  );
  expect(boxes[0]!.width).toBe(boxes[1]!.width);
  expect(boxes[0]!.y).toBe(boxes[1]!.y);
  const row = (await page.locator(".pan-zoom-demo__panes").boundingBox())!;
  expect(boxes[1]!.right).toBeCloseTo(row.x + row.width, 1);

  await page.setViewportSize({ width: 600, height: 900 });
  const mobile = await panes.evaluateAll((elements) =>
    elements.map((element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width };
    }),
  );
  expect(mobile[0]!.width).toBe(mobile[1]!.width);
  expect(mobile[0]!.x).toBe(mobile[1]!.x);
  expect(mobile[1]!.y).toBeGreaterThan(mobile[0]!.y);
});

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
    // @ts-expect-error JavaScript callers can supply nullish runtime values.
    controller.setView(null);
    // @ts-expect-error JavaScript callers can supply nullish runtime values.
    controller.setView(undefined);
  });
  expect(await state(page)).toEqual({
    view: { scale: 6.3456789, offsetX: 31.25, offsetY: -18.5 },
    changes: 0,
    zoomed: "true",
  });
  const scale = await page
    .locator("#fixture > div")
    .evaluate((pan) => new DOMMatrix((pan as HTMLElement).style.transform).a);
  expect(Math.abs(scale - 6.3456789)).toBeLessThan(5e-6);
});

test("overflow rejects whole inputs and later input recovers", async ({ page }) => {
  for (const axis of ["offsetX", "offsetY"] as const) {
    for (const input of ["wheel", "pinch"]) {
      await mount(page);
      await setView(page, {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        [axis]: Number.MAX_VALUE,
      });
      const before = await state(page);
      const transform = await page.locator("#fixture > div").getAttribute("style");
      const point = (value: number): [number, number] =>
        axis === "offsetX" ? [value, 200] : [200, value];
      if (input === "wheel") {
        await page
          .locator("#fixture")
          .dispatchEvent("wheel", { deltaY: -100, clientX: 200, clientY: 200 });
      } else {
        await touch(page, "pointerdown", 1, ...point(150));
        await touch(page, "pointerdown", 2, ...point(250));
        await touch(page, "pointermove", 2, ...point(350));
      }
      expect(await state(page)).toEqual(before);
      expect(await page.locator("#fixture > div").getAttribute("style")).toBe(transform);
      if (input === "wheel") {
        await page
          .locator("#fixture")
          .dispatchEvent("wheel", { deltaY: 100, clientX: 200, clientY: 200 });
      } else {
        await touch(page, "pointermove", 2, ...point(250));
      }
      const recovered = await state(page);
      expect(recovered.changes).toBe(1);
      expect(Number.isFinite(recovered.view[axis])).toBe(true);
      expect(recovered.view[axis]).toBeLessThan(before.view[axis]);
    }
  }
});

test("wheel zoom anchors and accumulates gradual steps", async ({ page }) => {
  await mount(page);
  await page.mouse.move(260, 240);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await state(page)).view.scale).toBeGreaterThan(1);
  expect((await state(page)).changes).toBe(1);
  const wheeled = (await state(page)).view;
  expect(wheeled.offsetX).toBeCloseTo(60 * (1 - wheeled.scale), 10);
  expect(wheeled.offsetY).toBeCloseTo(40 * (1 - wheeled.scale), 10);
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

test("destroying during a drag clears panning and leaves the view unchanged", async ({ page }) => {
  await mount(page);
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(230, 220);
  const viewport = page.locator("#fixture");
  await expect(viewport).toHaveAttribute("data-panning", "true");
  const before = await state(page);
  await page.evaluate(() => window.fixture.controller.destroy());
  await expect(viewport).not.toHaveAttribute("data-panning");
  await page.mouse.move(250, 240);
  await page.mouse.up();
  expect(await state(page)).toEqual(before);
});

test("scale limits use independent defaults and stay fixed after attachment", async ({ page }) => {
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
      mixed: limit({ minScale: 0, maxScale: 32 }, 100),
      min: [undefined, 0, 2].map((minScale) => limit({ minScale }, 0.01)),
      max: [undefined, 0.5, Infinity].map((maxScale) => limit({ maxScale }, 100)),
    };
  });
  expect(defaults).toEqual({
    fixed: [0.1, 32],
    mixed: 32,
    min: [0.4, 0.4, 0.4],
    max: [8, 8, 8],
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
  await page.evaluate(() => window.fixture.controller.reset());
  expect((await state(page)).zoomed).toBeNull();
  await touch(page, "pointerdown", 1, 150, 200);
  await touch(page, "pointerdown", 2, 250, 200);
  for (const [x, change] of [
    [300, 4],
    [300, 4],
    [350, 5],
  ] as const) {
    await touch(page, "pointermove", 2, x, 200);
    const { view, changes } = await state(page);
    const last = await page.evaluate(() => window.fixture.changes.at(-1));
    expect(changes).toBe(change);
    expect(last).toEqual(view);
  }
  expect((await state(page)).view).toEqual({
    scale: 2,
    offsetX: 50,
    offsetY: 0,
  });
  await setView(page, { scale: 8, offsetX: 0, offsetY: 0 });
  await touch(page, "pointermove", 2, 400, 230);
  expect(await state(page)).toMatchObject({
    view: { scale: 8, offsetX: 25, offsetY: 15 },
    changes: 6,
  });
});

test("swipes respect scale and axis", async ({ page }) => {
  await mount(page);
  await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
  await touch(page, "pointerdown", 1, 250, 200);
  await touch(page, "pointermove", 1, 180, 200);
  await touch(page, "pointerup", 1, 180, 200);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1]);
  await touch(page, "pointerdown", 1, 180, 200);
  await touch(page, "pointermove", 1, 250, 200);
  await touch(page, "pointerup", 1, 250, 200);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1, -1]);
  // Horizontal distance alone reaches the swipe threshold; the vertical axis rejects it.
  await touch(page, "pointerdown", 1, 150, 120);
  await touch(page, "pointermove", 1, 210, 280);
  await touch(page, "pointerup", 1, 210, 280);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1, -1]);
  await setView(page, { scale: 2.5, offsetX: 0, offsetY: 0 });
  await touch(page, "pointerdown", 1, 250, 200);
  await touch(page, "pointermove", 1, 180, 200);
  await touch(page, "pointerup", 1, 180, 200);
  expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1, -1]);
  expect((await state(page)).view).toEqual({
    scale: 2.5,
    offsetX: -70,
    offsetY: 0,
  });
  for (const change of ["external", "wheel"]) {
    await setView(page, { scale: 1, offsetX: 0, offsetY: 0 });
    await touch(page, "pointerdown", 1, 250, 200);
    await touch(page, "pointermove", 1, 180, 200);
    if (change === "external") {
      await setView(page, { scale: 2.5, offsetX: 0, offsetY: 0 });
      await setView(page, { scale: 1, offsetX: 0, offsetY: 0 });
    } else {
      await page.locator("#fixture").dispatchEvent("wheel", { deltaY: -100 });
    }
    await touch(page, "pointerup", 1, 180, 200);
    expect(await page.evaluate(() => window.fixture.swipes)).toEqual([1, -1]);
  }
});

test("double clicks and taps anchor and toggle; duplicate clicks and moved taps are ignored", async ({
  page,
}) => {
  await mount(page);
  await page.locator("#fixture").dispatchEvent("dblclick", { clientX: 300, clientY: 250 });
  expect((await state(page)).view).toEqual({
    scale: 2.5,
    offsetX: -150,
    offsetY: -75,
  });
  await page.locator("#fixture").dispatchEvent("dblclick", { clientX: 300, clientY: 250 });
  expect((await state(page)).view).toEqual({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  for (const scenario of ["double-tap", "release-away", "tap-drag", "tap-pinch-tap"]) {
    await mount(page);
    const result = await page.evaluate(
      ({ scenario, initialScale }) => {
        window.fixture.controller.setView({
          scale: initialScale,
          offsetX: 0,
          offsetY: 0,
        });
        const viewport = document.querySelector("#fixture")!;
        const fire = (type: string, id: number, x: number, y: number) =>
          viewport.dispatchEvent(
            new PointerEvent(type, {
              pointerId: id,
              pointerType: "touch",
              isPrimary: id === 1,
              clientX: x,
              clientY: y,
              bubbles: true,
            }),
          );
        const tapAt = (x: number, y: number) => {
          fire("pointerdown", 1, x, y);
          fire("pointerup", 1, x, y);
        };
        const returningDrag = () => {
          fire("pointerdown", 1, 200, 200);
          fire("pointermove", 1, 200, 240);
          fire("pointermove", 1, 200, 200);
          fire("pointerup", 1, 200, 200);
        };
        if (scenario === "double-tap") {
          tapAt(300, 250);
          tapAt(300, 250);
          const anchored = window.fixture.controller.getView();
          viewport.dispatchEvent(
            new MouseEvent("dblclick", {
              clientX: 300,
              clientY: 250,
              bubbles: true,
            }),
          );
          return { anchored, view: window.fixture.controller.getView() };
        } else if (scenario === "release-away") {
          fire("pointerdown", 1, 200, 200);
          fire("pointerup", 1, 200, 220);
          tapAt(200, 220);
        } else if (scenario === "tap-drag") {
          tapAt(200, 200);
          returningDrag();
        } else {
          tapAt(200, 200);
          fire("pointerdown", 1, 150, 200);
          fire("pointerdown", 2, 250, 200);
          fire("pointermove", 2, 350, 200);
          fire("pointerup", 2, 350, 200);
          fire("pointerup", 1, 150, 200);
          tapAt(200, 200);
        }
        return { anchored: null, view: window.fixture.controller.getView() };
      },
      { scenario, initialScale: NEAR_ONE },
    );
    if (result.anchored) {
      expect(result.anchored.scale).toBe(2.5);
      expect(result.anchored.offsetX).toBeCloseTo(100 * (1 - 2.5 / NEAR_ONE), 10);
      expect(result.anchored.offsetY).toBeCloseTo(50 * (1 - 2.5 / NEAR_ONE), 10);
      expect(result.view).toEqual(result.anchored);
      expect((await state(page)).zoomed).toBe("true");
    } else {
      expect(result.view.scale).toBe(scenario === "tap-pinch-tap" ? 2 * NEAR_ONE : NEAR_ONE);
    }
  }
});

test("only a pinch that changed scale settles at 1 on release", async ({ page }) => {
  await mount(page);
  await setView(page, { scale: NEAR_ONE, offsetX: 0, offsetY: 0 });
  await touch(page, "pointerdown", 1, 200, 200);
  await touch(page, "pointermove", 1, 230, 200);
  await touch(page, "pointerup", 1, 230, 200);
  expect((await state(page)).view.scale).toBe(NEAR_ONE);
  await setView(page, { scale: 1, offsetX: 0, offsetY: 0 });
  await touch(page, "pointerdown", 1, 150, 200);
  await touch(page, "pointerdown", 2, 250, 200);
  await touch(page, "pointermove", 2, 350, 200);
  await touch(page, "pointermove", 2, 250.05, 200);
  expect((await state(page)).view.scale).not.toBe(1);
  await touch(page, "pointerup", 2, 250.05, 200);
  const before = (await state(page)).changes;
  await touch(page, "pointerup", 1, 150, 200);
  expect(await state(page)).toMatchObject({
    view: { scale: 1 },
    changes: before + 1,
    zoomed: null,
  });
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
  expect(await state(page)).toMatchObject({
    view: { offsetX: 30 },
    changes: 1,
  });
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
