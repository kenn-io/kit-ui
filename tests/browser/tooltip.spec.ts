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
