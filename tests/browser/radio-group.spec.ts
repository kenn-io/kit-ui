import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

// The real radios are invisible under a drawn mark, so these tests drive
// the native inputs through label clicks and the keyboard, and compare the
// drawn mark with Checkbox's box on the same page.

// The demo's groups reuse option labels, so every lookup is scoped to a group.
const group = (page: Page, legend: string): Locator => page.getByRole("group", { name: legend });
const option = (scope: Locator, label: string): Locator =>
  scope.locator(".kit-radio-group__option", { hasText: label });

test("the fieldset legend names the group of radios", async ({ page }) => {
  await gotoPage(page, "radio-group");
  const channels = group(page, "Update channel");
  await expect(channels.getByRole("radio")).toHaveCount(3);
  await expect(channels.getByRole("radio", { name: "Stable" })).toBeChecked();
});

test("clicking an option's label chooses it and reports the change once", async ({ page }) => {
  await gotoPage(page, "radio-group");
  const channels = group(page, "Update channel");
  const readout = page.getByTestId("radio-group-value");
  await option(channels, "Nightly").click();
  await expect(channels.getByRole("radio", { name: "Nightly" })).toBeChecked();
  await expect(channels.getByRole("radio", { name: "Stable" })).not.toBeChecked();
  await expect(readout).toHaveText("channel: nightly, changes: 1");
  // Clicking the chosen option again is not a change.
  await option(channels, "Nightly").click();
  await expect(readout).toHaveText("channel: nightly, changes: 1");
});

test("arrow keys move the choice between options", async ({ page }) => {
  await gotoPage(page, "radio-group");
  const channels = group(page, "Update channel");
  const readout = page.getByTestId("radio-group-value");
  await channels.getByRole("radio", { name: "Stable" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(channels.getByRole("radio", { name: "Beta" })).toBeFocused();
  await expect(readout).toHaveText("channel: beta, changes: 1");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(readout).toHaveText("channel: beta, changes: 3");
});

test("arrow keys skip a disabled option and a disabled group ignores clicks", async ({ page }) => {
  await gotoPage(page, "radio-group");
  const size = group(page, "Size");
  await size.getByRole("radio", { name: "Medium" }).focus();
  await page.keyboard.press("ArrowDown");
  // Large is disabled, so the choice wraps to Small.
  await expect(size.getByRole("radio", { name: "Small" })).toBeChecked();
  await expect(size.getByRole("radio", { name: /Large/ })).toBeDisabled();

  const locked = group(page, "Region (locked)");
  await option(locked, "Nightly").click({ force: true });
  await expect(locked.getByRole("radio", { name: "Beta" })).toBeChecked();
  await expect(locked.getByRole("radio", { name: "Nightly" })).not.toBeChecked();
});

test("a required group blocks submission until chosen, then submits name=value", async ({
  page,
}) => {
  await gotoPage(page, "radio-group");
  const result = page.getByTestId("radio-group-form-result");
  await page.getByRole("button", { name: "Export" }).click();
  await expect(result).toHaveText("");
  await option(group(page, "Export format"), "JSON").click();
  await page.getByRole("button", { name: "Export" }).click();
  await expect(result).toHaveText("submitted: format=json&eol=lf");
});

test("a form reset restores each group's starting choice and its bound value", async ({ page }) => {
  await gotoPage(page, "radio-group");
  const format = group(page, "Export format");
  const eol = group(page, "Line endings");
  const readout = page.getByTestId("radio-group-form-value");
  await option(format, "JSON").click();
  await option(eol, "CRLF").click();
  await expect(readout).toHaveText("format: json, line endings: crlf");

  await page.getByRole("button", { name: "Reset" }).click();
  // Export format started with no choice; Line endings started on LF.
  await expect(format.getByRole("radio", { name: "JSON" })).not.toBeChecked();
  await expect(eol.getByRole("radio", { name: "LF", exact: true })).toBeChecked();
  await expect(readout).toHaveText("format: none, line endings: lf");
});

test("the drawn mark matches Checkbox's box in both modes", async ({ page }) => {
  await gotoPage(page, "radio-group");
  const box = page.locator(".kit-checkbox", { hasText: "Include headers" });
  const boxMark = box.locator(".kit-checkbox__box");
  const radio = option(group(page, "Export format"), "CSV");
  const radioMark = radio.locator(".kit-radio-group__mark");

  const style = (el: Locator) =>
    el.evaluate((node) => {
      const cs = getComputedStyle(node);
      return {
        width: cs.width,
        height: cs.height,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
        background: cs.backgroundColor,
      };
    });
  // Both sides are re-read on each attempt: theme and state changes animate.
  const expectMarksMatch = () =>
    expect(async () => {
      expect(await style(radioMark)).toEqual(await style(boxMark));
    }).toPass();

  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    await expectMarksMatch();
    await expect(radioMark).toHaveCSS("border-radius", "50%");
  }

  await box.click();
  await radio.click();
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    await expectMarksMatch();
    // The centre dot takes the surface color the check glyph strokes with.
    const dotColor = await radioMark.evaluate(
      (node) => getComputedStyle(node, "::after").backgroundColor,
    );
    const glyphColor = await box
      .locator(".kit-checkbox__glyph--check")
      .evaluate((node) => getComputedStyle(node).stroke);
    expect(dotColor).toBe(glyphColor);
  }
});

test("keyboard focus draws the ring on the mark", async ({ page }) => {
  await gotoPage(page, "radio-group");
  const channels = group(page, "Update channel");
  const mark = option(channels, "Stable").locator(".kit-radio-group__mark");
  await expect(mark).toHaveCSS("outline-style", "none");
  await channels.getByRole("radio", { name: "Beta" }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(channels.getByRole("radio", { name: "Stable" })).toBeFocused();
  await expect(mark).not.toHaveCSS("outline-style", "none");
});
