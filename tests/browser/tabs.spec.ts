import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.beforeEach(({ page }) => gotoPage(page, "tabs"));

test("tabs and panel are wired together for assistive tech", async ({ page }) => {
  const root = page.getByTestId("tabs-detail");
  const list = root.getByRole("tablist", { name: "Pull request detail" });
  await expect(list.getByRole("tab")).toHaveCount(4);

  const selected = list.getByRole("tab", { selected: true });
  await expect(selected).toHaveAccessibleName("Conversation 4");
  const panel = root.getByRole("tabpanel");
  await expect(panel).toHaveAccessibleName("Conversation 4");
  await expect(selected).toHaveAttribute("aria-controls", (await panel.getAttribute("id"))!);
  await expect(list.getByRole("tab", { name: /Commits/ })).not.toHaveAttribute("aria-controls");
});

test("a click selects a tab and swaps the panel", async ({ page }) => {
  const root = page.getByTestId("tabs-detail");
  await root.getByRole("tab", { name: /Files changed/ }).click();
  await expect(root.getByRole("tab", { selected: true })).toHaveAccessibleName("Files changed 38");
  await expect(root.getByRole("tabpanel")).toHaveText("src/sync/retry.ts  +42 −7");
  await expect(page.getByTestId("tabs-value")).toHaveText("files");
  await expect(page.getByTestId("tabs-changes")).toHaveText("1");

  // Re-clicking the selected tab is not a change.
  await root.getByRole("tab", { name: /Files changed/ }).click();
  await expect(page.getByTestId("tabs-changes")).toHaveText("1");
});

test("arrow keys select with roving focus and skip disabled tabs", async ({ page }) => {
  const root = page.getByTestId("tabs-detail");
  const tab = (name: RegExp) => root.getByRole("tab", { name });

  // Only the selected tab is in the Tab order.
  await expect(tab(/Conversation/)).toHaveAttribute("tabindex", "0");
  await expect(tab(/Commits/)).toHaveAttribute("tabindex", "-1");

  await tab(/Conversation/).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(/Commits/)).toBeFocused();
  await expect(tab(/Commits/)).toHaveAttribute("aria-selected", "true");

  // Checks is disabled, so End lands on Files changed and ArrowRight wraps.
  await page.keyboard.press("End");
  await expect(tab(/Files changed/)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tab(/Conversation/)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tab(/Files changed/)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tab(/Conversation/)).toBeFocused();
  await expect(page.getByTestId("tabs-value")).toHaveText("conversation");
  await expect(tab(/Checks/)).toBeDisabled();
});

test("Tab moves from the selected tab into the panel", async ({ page }) => {
  const root = page.getByTestId("tabs-detail");
  await root.getByRole("tab", { selected: true }).focus();
  await page.keyboard.press("Tab");
  await expect(root.getByRole("tabpanel")).toBeFocused();
});

test("manual activation moves focus without selecting", async ({ page }) => {
  const root = page.getByTestId("tabs-manual");
  const tab = (name: RegExp) => root.getByRole("tab", { name });
  await expect(root.getByRole("tabpanel")).toHaveCount(0);

  await tab(/Conversation/).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(/Commits/)).toBeFocused();
  await expect(page.getByTestId("tabs-manual-value")).toHaveText("conversation");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tabs-manual-value")).toHaveText("commits");
  await expect(tab(/Commits/)).toHaveAttribute("aria-selected", "true");
});

test("after arrowing without selecting, Tab and Shift+Tab leave the list", async ({ page }) => {
  const root = page.getByTestId("tabs-manual");
  const tab = (name: RegExp) => root.getByRole("tab", { name });
  const focusedIsTab = () =>
    page.evaluate(() => document.activeElement?.getAttribute("role") === "tab");

  await tab(/Conversation/).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(/Commits/)).toHaveAttribute("tabindex", "0");
  await expect(tab(/Conversation/)).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("Shift+Tab");
  expect(await focusedIsTab()).toBe(false);

  // Coming back lands on the selected tab, which never changed.
  await page.keyboard.press("Tab");
  await expect(tab(/Conversation/)).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  expect(await focusedIsTab()).toBe(false);
});

test("icon-only tabs take their accessible name from the label", async ({ page }) => {
  const root = page.getByTestId("tabs-icons");
  for (const name of ["Chat", "Files"]) {
    const tab = root.getByRole("tab", { name, exact: true });
    // The visible content is only an icon, so the name must come from aria-label.
    await expect(tab).toHaveText("");
    await expect(tab.locator("svg")).toBeVisible();
    await expect(tab).toHaveAccessibleName(name);
  }
});

test("the selected tab draws an accent bar on the list rule", async ({ page }) => {
  const root = page.getByTestId("tabs-detail");
  const selected = root.getByRole("tab", { selected: true });
  const bar = await selected.evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { height: style.height, bottom: style.bottom };
  });
  expect(bar).toEqual({ height: "2px", bottom: "0px" });
  const unselected = await root
    .getByRole("tab", { name: /Commits/ })
    .evaluate((el) => getComputedStyle(el, "::after").content);
  expect(unselected).toBe("none");
});
