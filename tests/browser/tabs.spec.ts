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

test.describe("browser-style strip", () => {
  const strip = (page: import("@playwright/test").Page) => page.getByTestId("tabs-strip");

  test("tabAttributes reach each tab and its onclick runs after selection", async ({ page }) => {
    const calendar = strip(page).getByRole("tab", { name: "Calendar" });
    await expect(calendar).toHaveAttribute("title", "Calendar");
    await expect(calendar).toHaveAttribute("data-page", "calendar");
    await expect(calendar).toHaveAttribute("draggable", "true");
    await expect(calendar).toHaveClass(/\bkit-tabs__tab\b/);
    await expect(calendar).toHaveClass(/\bstrip-tab\b/);

    await calendar.click();
    await expect(calendar).toHaveAttribute("aria-selected", "true");
    await expect(calendar).toHaveAttribute("tabindex", "0");
    await expect(page.getByTestId("tabs-strip-value")).toHaveText("calendar");
    await expect(page.getByTestId("tabs-strip-clicks")).toHaveText("1");
    // The consumer sees the new selection when its handler builds attributes.
    await expect(calendar).toHaveAttribute("data-selected", "true");
  });

  test("arrow keys keep roving focus and selection", async ({ page }) => {
    const tab = (name: string) => strip(page).getByRole("tab", { name, exact: true });
    await tab("Inbox").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab("Calendar")).toBeFocused();
    await expect(tab("Calendar")).toHaveAttribute("aria-selected", "true");
    await expect(tab("Inbox")).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("End");
    await expect(tab("Changelog")).toBeFocused();
    await expect(page.getByTestId("tabs-strip-value")).toHaveText("changelog");
    // Keyboard selection does not click.
    await expect(page.getByTestId("tabs-strip-clicks")).toHaveText("0");
  });

  test("drag handlers from tabAttributes reorder the tabs", async ({ page }) => {
    const tab = (name: string) => strip(page).getByRole("tab", { name, exact: true });
    await tab("Billing").dragTo(tab("Inbox"));
    await expect(page.getByTestId("tabs-strip-order")).toHaveText(/^billing, inbox, calendar/);
    await expect(strip(page).getByRole("tab").first()).toHaveAccessibleName("Billing");
  });

  test("afterList controls sit outside the tablist and scroll the bound list", async ({ page }) => {
    const list = strip(page).getByRole("tablist", { name: "Open pages" });
    await expect(list).toHaveClass(/\bstrip-list\b/);
    await expect(list.getByRole("button")).toHaveCount(0);
    await expect(strip(page).getByRole("button", { name: "Scroll tabs back" })).toHaveCount(0);

    await strip(page).getByRole("button", { name: "Scroll tabs forward" }).click();
    await expect.poll(() => list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // The list's onscroll handler re-measures and shows the back button.
    await expect(strip(page).getByRole("button", { name: "Scroll tabs back" })).toBeVisible();
  });

  test("the bare variant drops the tab look", async ({ page }) => {
    const list = strip(page).getByRole("tablist");
    await expect(list).toHaveCSS("border-bottom-width", "0px");
    const selected = list.getByRole("tab", { selected: true });
    expect(await selected.evaluate((el) => getComputedStyle(el, "::after").content)).toBe("none");
    // The consumer's tab class wins over the component's reset.
    const reference = await page
      .getByTestId("tabs-detail")
      .getByRole("tab", { selected: true })
      .evaluate((el) => getComputedStyle(el).paddingTop);
    expect(await selected.evaluate((el) => getComputedStyle(el).paddingTop)).not.toBe(reference);
    expect(await selected.evaluate((el) => getComputedStyle(el).paddingTop)).not.toBe("0px");
  });
});
