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

  await setSlider(slider, 460);
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
  await setSlider(slider, 545);
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
        }, 200);
      }),
  );
  expect(modeChanges).toBe(0);
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
  await expect(grid.getByRole("radio", { name: "All" })).toBeFocused();
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
