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

test("does not remeasure for pointer-position style updates", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const result = await page.evaluate(async () => {
    const grid = document.querySelector(".demo-action-grid");
    const items = grid?.querySelector(".kit-adaptive-action-grid__items");
    const button = [...(grid?.querySelectorAll("button") ?? [])].find((candidate) =>
      candidate.textContent?.includes("Refresh"),
    );
    if (!(items instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return null;

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    let measurements = 0;
    const observer = new MutationObserver((mutations) => {
      measurements += mutations.filter(
        (mutation) => mutation.attributeName === "data-measuring" && mutation.oldValue === null,
      ).length;
    });
    observer.observe(items, {
      attributes: true,
      attributeFilter: ["data-measuring"],
      attributeOldValue: true,
    });

    const box = button.getBoundingClientRect();
    for (let index = 0; index < 4; index += 1) {
      button.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: box.left + index + 1,
          clientY: box.top + index + 1,
        }),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }
    observer.disconnect();

    return {
      measurements,
      pointerX: button.style.getPropertyValue("--kit-pointer-x"),
      pointerY: button.style.getPropertyValue("--kit-pointer-y"),
    };
  });

  expect(result).not.toBeNull();
  expect(result?.pointerX).not.toBe("");
  expect(result?.pointerY).not.toBe("");
  expect(result?.measurements).toBe(0);
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

test("restores focus to the checked native radio in sequential Tab order", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  await grid
    .locator(".kit-adaptive-action-grid__item")
    .first()
    .evaluate((element) => {
      element.innerHTML = `
        <label><input type="radio" name="native-state" /> First</label>
        <label><input type="radio" name="native-state" checked /> Checked</label>
      `;
    });

  await setSlider(slider, 460);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
  await grid.getByRole("button", { name: /Filters and actions/ }).focus();

  await setSlider(slider, 860);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
  await expect(grid.getByRole("radio", { name: "Checked" })).toBeFocused();
});

test("skips an unchecked grid radio when its group is checked elsewhere", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".demo-action-grid");
  const slider = page.locator('input[type="range"]').first();
  await grid
    .locator(".kit-adaptive-action-grid__item")
    .first()
    .evaluate((element) => {
      element.innerHTML = `
        <label><input type="radio" name="shared-state" /> Inside grid</label>
      `;
      const checked = document.createElement("input");
      checked.type = "radio";
      checked.name = "shared-state";
      checked.checked = true;
      document.body.append(checked);
    });

  await setSlider(slider, 460);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
  await grid.getByRole("button", { name: /Filters and actions/ }).focus();

  await setSlider(slider, 860);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--row/);
  await expect(grid.getByRole("button", { name: "Project" })).toBeFocused();
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

test("keeps the compact button keyboard focus border inside a zero-gap grid", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const ranges = page.locator('input[type="range"]');
  await setSlider(ranges.first(), 450);
  await setSlider(ranges.nth(1), 0);
  await setSlider(ranges.nth(2), 0);

  const grid = page.locator(".demo-action-grid");
  const trigger = grid.getByRole("button", { name: /Filters and actions/ });
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--compact/);
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--joined/);

  await page.keyboard.press("Tab");
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("outline-offset", "-2px");
});

test("keeps a text field keyboard focus border inside a zero-gap grid", async ({ page }) => {
  await gotoPage(page, "adaptive-action-grid");

  const grid = page.locator(".validation-action-grid");
  await expect(grid).toHaveClass(/kit-adaptive-action-grid--joined/);
  await grid.getByRole("button", { name: "Query controls" }).click();

  const input = grid.getByRole("textbox", { name: "Required query" });
  await page.keyboard.press("Tab");
  await input.focus();
  await expect(input).toBeFocused();
  await expect(grid.locator(".kit-text-input")).toHaveCSS("outline-offset", "-2px");
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

test.describe("filled grid layout", () => {
  async function cellWidths(page: import("@playwright/test").Page): Promise<number[]> {
    return page
      .locator(".filled-action-grid .kit-adaptive-action-grid__item")
      .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().width)));
  }

  async function rows(page: import("@playwright/test").Page): Promise<number[]> {
    return page
      .locator(".filled-action-grid .kit-adaptive-action-grid__item")
      .evaluateAll((items) => {
        const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
        return [...new Set(tops)].map((top) => tops.filter((t) => t === top).length);
      });
  }

  test("fills the container with equal tracks even when a row would fit", async ({ page }) => {
    await gotoPage(page, "adaptive-action-grid");
    const grid = page.locator(".filled-action-grid");
    await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
    const width = await grid.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const widths = await cellWidths(page);
    expect(widths).toHaveLength(4);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
    expect(widths.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(width - 4);
    expect(await rows(page)).toEqual([4]);
  });

  test("balances four items into 2x2 when only three tracks fit", async ({ page }) => {
    await gotoPage(page, "adaptive-action-grid");
    await setSlider(page.locator(".filled-width"), 450);
    const grid = page.locator(".filled-action-grid");
    await expect(grid).toHaveClass(/kit-adaptive-action-grid--grid/);
    await expect.poll(() => rows(page)).toEqual([2, 2]);
    const widths = await cellWidths(page);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
  });

  test("spans a leftover item across the last row instead of orphaning it", async ({ page }) => {
    await gotoPage(page, "adaptive-action-grid");
    await page.getByRole("button", { name: "Five actions" }).click();
    await setSlider(page.locator(".filled-width"), 620);
    await expect.poll(() => rows(page)).toEqual([4, 1]);
    const widths = await cellWidths(page);
    const gridWidth = await page
      .locator(".filled-action-grid")
      .evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(widths[4]).toBeGreaterThanOrEqual(gridWidth - 4);
  });

  test("stacks to one full-width column when a single track fits", async ({ page }) => {
    await gotoPage(page, "adaptive-action-grid");
    await setSlider(page.locator(".filled-width"), 260);
    await expect.poll(() => rows(page)).toEqual([1, 1, 1, 1]);
  });
});
