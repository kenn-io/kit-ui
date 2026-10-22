import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Placement is layout: only a real browser shows where the bubble and its
// arrow land relative to the control they describe.

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
}

/** Viewport x of the arrow's center (the bubble's ::before). */
async function arrowCenterOf(tooltip: Locator): Promise<number> {
  return tooltip.evaluate((el) => {
    const arrow = getComputedStyle(el, "::before");
    return el.getBoundingClientRect().left + parseFloat(arrow.left) + parseFloat(arrow.width) / 2;
  });
}

const centerOf = (box: Box) => (box.left + box.right) / 2;

function resetButton(page: Page) {
  return page.getByTestId("icon-tooltip").getByRole("button", { name: "Reset" });
}

test("keyboard focus opens the tooltip centered under its icon button with a small gap", async ({
  page,
}) => {
  await gotoPage(page, "tooltip");
  const button = resetButton(page);
  await button.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveText("Reset to default");

  const control = await boxOf(button);
  const bubble = await boxOf(tooltip);
  expect(Math.abs(centerOf(bubble) - centerOf(control))).toBeLessThanOrEqual(1);
  expect(Math.abs((await arrowCenterOf(tooltip)) - centerOf(control))).toBeLessThanOrEqual(1);
  const gap = bubble.top - control.bottom;
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThanOrEqual(12);
});

test("hover opens the tooltip centered under a text button", async ({ page }) => {
  await gotoPage(page, "tooltip");
  const button = page.getByRole("button", { name: "Update branch" });
  await button.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveText("Rebases and fast-forwards the branch");

  const control = await boxOf(button);
  const bubble = await boxOf(tooltip);
  expect(Math.abs(centerOf(bubble) - centerOf(control))).toBeLessThanOrEqual(1);
  expect(Math.abs((await arrowCenterOf(tooltip)) - centerOf(control))).toBeLessThanOrEqual(1);
  expect(bubble.top).toBeGreaterThan(control.bottom);
});

test("near the bottom-right corner the tooltip flips above, stays on screen, and still points at its control", async ({
  page,
}) => {
  await gotoPage(page, "tooltip");
  // Pin the trigger into the corner so neither centered nor below fits.
  await page.getByTestId("icon-tooltip").evaluate((el) => {
    Object.assign(el.style, { position: "fixed", right: "16px", bottom: "16px", zIndex: "1" });
  });
  const button = resetButton(page);
  await button.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();

  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("the test needs a fixed viewport");
  const control = await boxOf(button);
  const bubble = await boxOf(tooltip);
  expect(bubble.right).toBeLessThanOrEqual(viewport.width - 8 + 0.5);
  expect(bubble.bottom).toBeLessThan(control.top);
  expect(control.top - bubble.bottom).toBeLessThanOrEqual(12);
  expect(Math.abs((await arrowCenterOf(tooltip)) - centerOf(control))).toBeLessThanOrEqual(1);
});

test("side right puts the tooltip beside its control, clear of the icon below", async ({
  page,
}) => {
  await gotoPage(page, "tooltip");
  const column = page.getByTestId("icon-column");
  const inbox = column.getByRole("button", { name: "Inbox" });
  await inbox.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveText("Inbox");

  const control = await boxOf(inbox);
  const below = await boxOf(column.getByRole("button", { name: "Notifications" }));
  const bubble = await boxOf(tooltip);
  const gap = bubble.left - control.right;
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThanOrEqual(12);
  expect(bubble.right <= below.left || bubble.left >= below.right).toBe(true);
  // The arrow points left at the control's vertical center.
  const arrow = await tooltip.evaluate((el) => {
    const style = getComputedStyle(el, "::before");
    const box = el.getBoundingClientRect();
    return {
      right: box.left + parseFloat(style.left) + parseFloat(style.width),
      middle: box.top + parseFloat(style.top) + parseFloat(style.height) / 2,
    };
  });
  expect(arrow.right).toBeLessThanOrEqual(bubble.left + 6);
  expect(Math.abs(arrow.middle - (control.top + control.bottom) / 2)).toBeLessThanOrEqual(1);
});

test("side right without room on the right falls back below and stays on screen", async ({
  page,
}) => {
  await gotoPage(page, "tooltip");
  const column = page.getByTestId("icon-column");
  await column.evaluate((el) => {
    Object.assign(el.style, { position: "fixed", right: "16px", top: "200px", zIndex: "1" });
  });
  const inbox = column.getByRole("button", { name: "Inbox" });
  await inbox.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveText("Inbox");

  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("the test needs a fixed viewport");
  const control = await boxOf(inbox);
  const bubble = await boxOf(tooltip);
  expect(bubble.right).toBeLessThanOrEqual(viewport.width - 8 + 0.5);
  expect(bubble.top).toBeGreaterThan(control.bottom);
  expect(Math.abs((await arrowCenterOf(tooltip)) - centerOf(control))).toBeLessThanOrEqual(1);
});

test("a tooltip removed during its hover delay leaves the open tooltip alone", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-01-15T08:00:00") });
  await gotoPage(page, "tooltip");
  await page.clock.pauseAt(new Date("2026-01-15T09:00:00"));
  const column = page.getByTestId("icon-column");
  const tooltip = page.getByRole("tooltip");
  // The pointer rests on Notifications while its open delay runs.
  await column.getByRole("button", { name: "Notifications" }).hover();
  // The keyboard removes it, so the pointer never leaves it.
  await page.getByRole("button", { name: "Remove Notifications" }).focus();
  await page.keyboard.press("Enter");
  await expect(column.getByRole("button", { name: "Notifications" })).toHaveCount(0);
  await column.getByRole("button", { name: "Inbox" }).focus();
  await expect(tooltip).toHaveText("Inbox");
  await page.clock.runFor(1000);
  await expect(tooltip).toHaveText("Inbox");
});

test("the first hover waits, then the next trigger's tooltip replaces it at once", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-15T08:00:00") });
  await gotoPage(page, "tooltip");
  await page.clock.pauseAt(new Date("2026-01-15T09:00:00"));
  const column = page.getByTestId("icon-column");
  const tooltip = page.getByRole("tooltip");
  await column.getByRole("button", { name: "Inbox" }).hover();
  await page.clock.runFor(200);
  await expect(tooltip).toHaveCount(0);
  await page.clock.runFor(100);
  await expect(tooltip).toHaveText("Inbox");

  // No clock time passes: the swap needs no timer.
  await column.getByRole("button", { name: "Notifications" }).hover();
  await expect(tooltip).toHaveText("Notifications");

  // Once none is open, the next hover waits again.
  await page.mouse.move(0, 0);
  await page.clock.runFor(200);
  await expect(tooltip).toHaveCount(0);
  await column.getByRole("button", { name: "Inbox" }).hover();
  await page.clock.runFor(200);
  await expect(tooltip).toHaveCount(0);
});

test("the open tooltip is the control's accessible description", async ({ page }) => {
  await gotoPage(page, "tooltip");
  const button = resetButton(page);
  await button.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(button).toHaveAccessibleDescription("Reset to default");
});

test("the description follows keyboard focus to the second control a tooltip wraps", async ({
  page,
}) => {
  await gotoPage(page, "tooltip");
  const group = page.getByTestId("group-tooltip");
  const left = group.getByRole("button", { name: "Align left" });
  const right = group.getByRole("button", { name: "Align right" });

  await right.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(right).toHaveAccessibleDescription("Aligns the selected text");
  await expect(left).toHaveAccessibleDescription("");
});

test("the description is on the control while its focus event is still being handled", async ({
  page,
}) => {
  await gotoPage(page, "tooltip");
  // A document listener runs after the tooltip's own focusin handler but
  // before any later render, which is when assistive technology reads focus.
  await page.evaluate(() => {
    document.addEventListener(
      "focusin",
      () => {
        document.body.dataset.describedAtFocus =
          document.activeElement?.getAttribute("aria-describedby") ?? "";
      },
      { once: true },
    );
  });
  const button = resetButton(page);
  await button.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const tooltipID = await tooltip.getAttribute("id");
  await expect(page.locator("body")).toHaveAttribute("data-described-at-focus", tooltipID ?? "");
});

test("the description survives the control rewriting its own aria-describedby while open", async ({
  page,
}) => {
  await gotoPage(page, "tooltip");
  await page.evaluate(() => {
    const hint = document.createElement("span");
    hint.id = "extra-hint";
    hint.textContent = "Field is required";
    document.body.append(hint);
  });
  const button = resetButton(page);
  await button.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();

  // What Svelte does when a control's description prop changes.
  await button.evaluate((el) => el.setAttribute("aria-describedby", "extra-hint"));
  await expect(button).toHaveAccessibleDescription("Field is required Reset to default");

  await button.blur();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-describedby", "extra-hint");
});

test("pressing a control hides its tooltip until the pointer leaves", async ({ page }) => {
  await gotoPage(page, "tooltip");
  const button = page.getByRole("button", { name: "Update branch" });
  const tooltip = page.getByRole("tooltip");
  await button.hover();
  await expect(tooltip).toBeVisible();

  // The click also focuses the button, which would otherwise show it again.
  await button.click();
  await expect(button).toBeFocused();
  await expect(tooltip).toHaveCount(0);
  await expect(button).not.toHaveAttribute("aria-describedby");

  await page.mouse.move(0, 0);
  await button.hover();
  await expect(tooltip).toBeVisible();
});

test("clicking from one wrapped control to another keeps the tooltip hidden", async ({ page }) => {
  await gotoPage(page, "tooltip");
  const group = page.getByTestId("group-tooltip");
  await group.getByRole("button", { name: "Align left" }).click();
  const right = group.getByRole("button", { name: "Align right" });
  await right.click();
  await expect(right).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("tabbing to the next control after a click shows its tooltip", async ({ page }) => {
  await gotoPage(page, "tooltip");
  const group = page.getByTestId("group-tooltip");
  await group.getByRole("button", { name: "Align left" }).click();
  await page.keyboard.press("Tab");
  const right = group.getByRole("button", { name: "Align right" });
  await expect(right).toBeFocused();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(right).toHaveAccessibleDescription("Aligns the selected text");
});

test("pressing Enter on a focused control hides its tooltip", async ({ page }) => {
  await gotoPage(page, "tooltip");
  const button = resetButton(page);
  await button.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(button).toBeFocused();
  await expect(tooltip).toHaveCount(0);
});

test("a touch tap does not open the tooltip", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true });
  const page = await context.newPage();
  await gotoPage(page, "tooltip");
  await page.getByRole("button", { name: "Update branch" }).tap();
  // Past the open delay the emulated mouseenter would have used.
  await page.waitForTimeout(500);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await context.close();
});

test("a touch tap opens the tooltip of a focusable trigger", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true });
  const page = await context.newPage();
  await gotoPage(page, "tooltip");
  await page.getByText("focusable text").tap();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Uses tabindex so plain text is keyboard-reachable",
  );
  await context.close();
});
