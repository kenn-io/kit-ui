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

test("callout body text stays readable on every tone", async ({ page }) => {
  await gotoPage(page, "notice");

  const callouts = page.getByTestId("notice-callouts").locator(".kit-notice");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    for (const callout of await callouts.all()) {
      expect(await contrastOf(callout.locator(".kit-notice__message"))).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("inline notices keep their semantics and align the icon with the message", async ({
  page,
}) => {
  await gotoPage(page, "notice");

  const inline = page.getByTestId("notice-inline");
  const error = inline.getByRole("alert");
  await expect(error).toHaveAttribute("aria-live", "assertive");
  await expect(error.locator(".kit-notice__tone")).toHaveText("Error");
  await expect(error.locator(".kit-notice__tone")).toHaveCSS("clip-path", "inset(50%)");
  await expect(error).toHaveCSS("border-top-width", "0px");
  const icon = (await error.locator(".kit-notice__icon").boundingBox())!;
  const message = (await error.locator(".kit-notice__message").boundingBox())!;
  expect(Math.abs(icon.y + icon.height / 2 - message.y - message.height / 2)).toBeLessThan(1);

  const info = inline.getByRole("status");
  await info.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("inline-notice-callbacks")).toHaveText("1");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    for (const notice of await inline.locator(".kit-notice").all()) {
      expect(await contrastOf(notice.locator(".kit-notice__message"))).toBeGreaterThanOrEqual(4.5);
    }
  }

  const card = page.locator(".kit-notice").first();
  await expect(card.locator(".kit-notice__tone")).toBeVisible();
  await expect(card).not.toHaveCSS("border-top-width", "0px");
});
