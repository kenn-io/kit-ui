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
