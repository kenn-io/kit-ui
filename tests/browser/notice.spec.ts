import { expect, test } from "@playwright/test";
import { contrastOf, gotoPage, setTheme } from "./helpers.js";

test("a static callout is a note and is not announced", async ({ page }) => {
  await gotoPage(page, "notice");

  const callouts = page.getByTestId("notice-callouts").locator(".kit-notice");
  await expect(callouts).toHaveCount(4);
  for (const callout of await callouts.all()) {
    await expect(callout).toHaveAttribute("role", "note");
    await expect(callout).not.toHaveAttribute("aria-live");
  }

  // The live notice above keeps its status semantics.
  const live = page.locator(".kit-notice").first();
  await expect(live).toHaveAttribute("role", "status");
  await expect(live).toHaveAttribute("aria-live", "polite");
});

test("callouts render rich children and a custom icon", async ({ page }) => {
  await gotoPage(page, "notice");

  const tip = page.getByTestId("notice-callouts").locator('.kit-notice[data-tone="tip"]');
  await expect(tip.locator(".kit-notice__tone")).toHaveText("Tip");
  await expect(tip.locator("code")).toHaveText("bun run check");
  await expect(tip.getByRole("link", { name: "the Markdown page" })).toBeVisible();
  await expect(tip.locator(".kit-notice__icon svg")).toBeVisible();
  await expect(tip.locator(".kit-notice__mark")).toHaveCount(0);

  const error = page.getByTestId("notice-callouts").locator('.kit-notice[data-tone="error"]');
  await expect(error.getByRole("listitem")).toHaveCount(2);
  // Outside list markers sit in the item's indent. Without one they hang
  // left of the text column, into the gap beside the tone dot.
  const label = (await error.locator(".kit-notice__tone").boundingBox())!;
  const item = (await error.getByRole("listitem").first().boundingBox())!;
  expect(item.x).toBeGreaterThan(label.x + 8);
});

test("notice body text stays readable on every tone", async ({ page }) => {
  await gotoPage(page, "notice");

  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    for (const id of ["notice-callouts", "notice-inline"]) {
      for (const notice of await page.getByTestId(id).locator(".kit-notice").all()) {
        expect(await contrastOf(notice.locator(".kit-notice__message"))).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  }
});

test("inline notices show their tone and remove the card border", async ({ page }) => {
  await gotoPage(page, "notice");
  const inline = page.getByTestId("notice-inline");
  const error = inline.getByRole("alert").first();
  await expect(error.locator(".kit-notice__icon")).toHaveAttribute("aria-hidden", "true");
  await expect(error.locator(".kit-notice__tone")).toHaveText("Error");
  await expect(error.locator(".kit-notice__tone")).toHaveCSS("clip-path", "inset(50%)");
  await expect(error.locator(".kit-notice__tone")).toHaveCSS("margin-bottom", "-1px");
  const bounds = await error.evaluate((element) => {
    const content = element.querySelector(".kit-notice__content")!;
    const label = element.querySelector(".kit-notice__tone")!;
    return { contained: (label as HTMLElement).offsetParent === content };
  });
  expect(bounds.contained).toBe(true);
  await expect(error).toHaveCSS("border-top-width", "0px");
  expect((await error.boundingBox())!.height).toBeGreaterThanOrEqual(32);

  const info = inline.getByRole("status");
  const tone = info.locator(".kit-notice__tone");
  await expect(tone).toHaveText("Info");
  await expect(tone).not.toHaveCSS("clip-path", "inset(50%)");
  const mark = (await info.locator(".kit-notice__mark").boundingBox())!;
  const label = (await tone.boundingBox())!;
  expect(label.x - (mark.x + mark.width + 3)).toBeGreaterThanOrEqual(4);
  await expect(page.locator(".kit-notice").first()).not.toHaveCSS("border-top-width", "0px");
});

test("inline icons and actions align with wrapped messages", async ({ page }) => {
  await gotoPage(page, "notice");
  const error = page.getByTestId("notice-inline").getByRole("alert").last();
  const firstLine = await error.locator(".kit-notice__message").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = range.getClientRects();
    return { y: lines[0]!.y, height: lines[0]!.height, count: lines.length };
  });
  const icon = (await error.locator(".kit-notice__icon").boundingBox())!;
  expect(firstLine.count).toBeGreaterThan(1);
  expect(icon.width).toBe(14);
  expect(Math.abs(icon.y + icon.height / 2 - firstLine.y - firstLine.height / 2)).toBeLessThan(0.5);

  const errorBox = (await error.boundingBox())!;
  const buttonBox = (await error.getByRole("button").boundingBox())!;
  expect(
    Math.abs(errorBox.y + errorBox.height / 2 - buttonBox.y - buttonBox.height / 2),
  ).toBeLessThan(1);
});
