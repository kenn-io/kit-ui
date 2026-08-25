import { expect, test } from "@playwright/test";
import { gotoPage, setSlider } from "./helpers.js";

test("supports a frameless action surface with no outer padding", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const items = grid.locator(".kit-adaptive-action-grid__items");

  await expect(grid).toHaveCSS("border-top-width", "0px");
  await expect(items).toHaveCSS("padding", "0px");
});

test("moves between row, grid, and compact without replacing nested state", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  const openRadio = grid.getByRole("radio", { name: "Open" });

  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
  await openRadio.evaluate((element) => element.setAttribute("data-node-identity", "original"));
  await openRadio.focus();
  await page.keyboard.press("ArrowRight");
  await expect(grid.getByRole("radio", { name: "Open" })).toHaveAttribute("aria-checked", "true");
  await expect(grid.getByRole("radio", { name: "Open" })).toHaveAttribute(
    "data-node-identity",
    "original",
  );

  await setSlider(slider, 520);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
  await expect(grid.getByRole("radio", { name: "Open" })).toHaveAttribute("aria-checked", "true");

  await slider.focus();
  await setSlider(slider, 460);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
  const trigger = grid.getByRole("button", { name: /Filters and actions/ });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(grid.getByRole("radio", { name: "Open" })).toHaveAttribute("aria-checked", "true");
  await trigger.focus();
  await page.keyboard.press("Tab");
  await expect(grid.getByRole("radio", { name: "Open" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(grid.getByRole("button", { name: "Project" })).toBeFocused();

  await setSlider(slider, 860);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
  await expect(trigger).toHaveCount(0);
  await expect(grid.getByRole("radio", { name: "Open" })).toHaveAttribute("aria-checked", "true");
  await expect(grid.getByRole("radio", { name: "Open" })).toHaveAttribute(
    "data-node-identity",
    "original",
  );
});

test("remeasures changed labels in grid and compact modes", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  const concise = page.getByRole("button", { name: "Use concise labels" });

  await setSlider(slider, 545);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
  await concise.click();
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);

  await page.getByRole("button", { name: "Use full labels" }).click();
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);

  await setSlider(slider, 465);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
  await concise.click();
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);

  await page.getByRole("button", { name: "Use full labels" }).click();
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
});

test("settles at a row-to-grid boundary instead of oscillating", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  for (const width of [545, 560, 575]) {
    await setSlider(slider, width);
    await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);

    const modeChanges = await grid.evaluate(
      (element) =>
        new Promise<number>((resolve) => {
          let count = 0;
          const observer = new MutationObserver(() => count++);
          observer.observe(element, { attributes: true, attributeFilter: ["class"] });
          setTimeout(() => {
            observer.disconnect();
            resolve(count);
          }, 100);
        }),
    );
    expect(modeChanges).toBe(0);
  }
});

test("remeasures after an inherited font change", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  await setSlider(page.locator('input[type="range"]').first(), 560);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);

  await grid.evaluate((element) => {
    if (element.parentElement) element.parentElement.style.fontFamily = "Times New Roman";
  });
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
});

test("remeasures when its class prop changes inherited styles", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  await setSlider(page.locator('input[type="range"]').first(), 560);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);

  await page.addStyleTag({
    content: '.demo-action-grid--radius-lg { font-family: "Times New Roman"; }',
  });
  await page.getByRole("combobox", { name: "Outer corner radius: Medium radius" }).click();
  await page.getByRole("option", { name: "Large radius" }).click();

  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
});

test("harmonizes the default type and height of nested kit controls", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const controls = {
    segment: grid.locator(".kit-segmented"),
    segmentButton: grid.getByRole("radio", { name: "All" }),
    filter: grid.getByRole("button", { name: "Project" }),
    button: grid.getByRole("button", { name: "Refresh" }),
    iconButton: grid.getByRole("button", { name: "View settings" }),
  };

  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
  const rowHeights = await Promise.all(
    [controls.segmentButton, controls.filter, controls.button, controls.iconButton].map((control) =>
      control.evaluate((element) => element.getBoundingClientRect().height),
    ),
  );
  expect(new Set(rowHeights)).toEqual(new Set([28]));

  await page.evaluate(() => document.documentElement.classList.add("kit-type-touch"));
  const touchRowHeights = await Promise.all(
    [controls.segmentButton, controls.filter, controls.button, controls.iconButton].map((control) =>
      control.evaluate((element) => element.getBoundingClientRect().height),
    ),
  );
  expect(new Set(touchRowHeights)).toEqual(new Set([32]));

  await setSlider(page.locator('input[type="range"]').first(), 545);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);

  const fontSizes = await Promise.all(
    [controls.segmentButton, controls.filter, controls.button].map((control) =>
      control.evaluate((element) => getComputedStyle(element).fontSize),
    ),
  );
  expect(new Set(fontSizes).size).toBe(1);

  const borderWidths = await Promise.all(
    [controls.segment, controls.filter, controls.button, controls.iconButton].map((control) =>
      control.evaluate((element) => getComputedStyle(element).borderTopWidth),
    ),
  );
  expect(new Set(borderWidths)).toEqual(new Set(["1px"]));
});

test("gives the compact disclosure a 48px coarse-pointer target", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await gotoPage(page, "adaptive-action-grid");

  await setSlider(page.locator('input[type="range"]').first(), 450);
  const triggerHeight = await page
    .locator(".demo-action-grid")
    .getByRole("button", { name: /Filters and actions/ })
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(triggerHeight).toBe(48);

  await context.close();
});

test("keeps a focused child visible when resize enters compact mode", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  const project = grid.getByRole("button", { name: "Project" });
  const openRadio = grid.getByRole("radio", { name: "Open" });
  await openRadio.click();
  await project.focus();
  await expect(project).toBeFocused();

  await setSlider(slider, 450);
  const trigger = grid.getByRole("button", { name: /Filters and actions/ });
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(project).toBeFocused();

  await trigger.focus();
  await setSlider(slider, 860);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
  await expect(openRadio).toBeFocused();
  await expect(openRadio).toHaveAttribute("tabindex", "0");
});

test("returns focus to the trigger when bound state closes the compact panel", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  await setSlider(page.locator('input[type="range"]').first(), 450);
  const trigger = grid.getByRole("button", { name: /Filters and actions/ });
  await trigger.click();

  const project = grid.getByRole("button", { name: "Project" });
  await project.focus();
  await expect(project).toBeFocused();
  await page
    .getByRole("button", { name: "Close compact panel" })
    .evaluate((element: HTMLButtonElement) => element.click());

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("zero-gap geometry forms one joined grid", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".joined-action-grid");
  const items = grid.locator(".kit-adaptive-action-grid__items");
  const buttons = grid.getByRole("button");

  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
  await expect(buttons).toHaveCount(4);

  const geometry = await items.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      rowGap: styles.rowGap,
      columnGap: styles.columnGap,
      padding: styles.padding,
    };
  });
  expect(geometry).toEqual({ rowGap: "0px", columnGap: "0px", padding: "0px" });
  await expect(buttons.first()).toHaveCSS("border-radius", "0px");

  const boxes = await buttons.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }),
  );
  expect(Math.abs(boxes[0]!.right - boxes[1]!.left)).toBeLessThan(0.5);
  expect(Math.abs(boxes[0]!.bottom - boxes[2]!.top)).toBeLessThan(0.5);
});

test("shrinks a long filter trigger without sizing its floating panel", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  await setSlider(page.locator('input[type="range"]').first(), 520);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
  await page.getByRole("button", { name: "Use long filter label" }).click();

  const trigger = grid.getByRole("button", {
    name: "Project assignment across every connected workspace",
  });
  const label = trigger.locator(".kit-filter-dropdown__trigger-label");
  const triggerGeometry = await label.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflow: getComputedStyle(element).overflow,
    textOverflow: getComputedStyle(element).textOverflow,
    whiteSpace: getComputedStyle(element).whiteSpace,
    height: element.parentElement?.getBoundingClientRect().height,
  }));
  expect(triggerGeometry.scrollWidth).toBeGreaterThan(triggerGeometry.clientWidth);
  expect(triggerGeometry).toMatchObject({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    height: 28,
  });

  await trigger.click();
  const panel = grid.locator(".kit-filter-dropdown__panel");
  await expect(panel).toBeVisible();
  const widths = {
    trigger: await trigger.evaluate((element) => element.getBoundingClientRect().width),
    panel: await panel.evaluate((element) => element.getBoundingClientRect().width),
  };
  expect(widths.panel).toBeGreaterThanOrEqual(200);
  expect(widths.panel).not.toBe(widths.trigger);
});

test("preserves item identity, measurement, and order across item changes", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  await setSlider(slider, 700);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);

  const selectedState = grid.getByRole("radio", { name: "All" });
  const settings = grid.getByRole("button", { name: "View settings" });
  await selectedState.evaluate((element) => element.setAttribute("data-node-identity", "state"));
  await settings.evaluate((element) => element.setAttribute("data-node-identity", "settings"));

  await page.getByRole("button", { name: "Add archive action" }).click();
  await expect(grid.getByRole("button", { name: "Archive selected results" })).toBeVisible();
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
  await expect(selectedState).toHaveAttribute("data-node-identity", "state");
  await expect(settings).toHaveAttribute("data-node-identity", "settings");

  await page.getByRole("button", { name: "Remove archive action" }).click();
  await expect(grid.getByRole("button", { name: "Archive selected results" })).toHaveCount(0);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
  await expect(selectedState).toHaveAttribute("data-node-identity", "state");
  await expect(settings).toHaveAttribute("data-node-identity", "settings");

  await page.getByRole("button", { name: "Reverse item order" }).click();
  await expect(
    grid.locator(".kit-adaptive-action-grid__item").first().getByRole("button", {
      name: "View settings",
    }),
  ).toBeVisible();
  await expect(selectedState).toHaveAttribute("data-node-identity", "state");
  await expect(settings).toHaveAttribute("data-node-identity", "settings");

  await settings.focus();
  await page.keyboard.press("Tab");
  await expect(grid.getByRole("button", { name: "Export CSV" })).toBeFocused();
});

test("measures icon-only rows at their full control width", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".icon-action-grid");
  const items = grid.locator(".kit-adaptive-action-grid__items");
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
  await expect(grid.getByRole("button", { name: "View settings" })).toHaveCount(6);
  const geometry = await items.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});

test("keeps an open dropdown attached during container-only reflow", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  await setSlider(slider, 860);
  const trigger = grid.getByRole("button", { name: "Model" });
  await trigger.click();
  const panel = grid.locator(".kit-filter-dropdown__panel");
  await expect(panel).toBeVisible();

  await setSlider(slider, 520);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
  await expect
    .poll(async () => {
      const triggerBox = await trigger.boundingBox();
      const panelBox = await panel.boundingBox();
      if (!triggerBox || !panelBox) return null;
      return {
        horizontalOffset: Math.round(panelBox.x - triggerBox.x),
        verticalGap: Math.round(panelBox.y - (triggerBox.y + triggerBox.height)),
      };
    })
    .toEqual({ horizontalOffset: 0, verticalGap: 4 });
});

test("opens compact content before focusing an invalid form control", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".validation-action-grid");
  const trigger = grid.getByRole("button", { name: "Query controls" });
  const input = grid.getByRole("textbox", { name: "Required query" });
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Submit form" }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(input).toBeFocused();
});
