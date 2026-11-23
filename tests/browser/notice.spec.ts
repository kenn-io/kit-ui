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

test("inline notices retain their tone and live-region semantics", async ({ page }) => {
  await gotoPage(page, "notice");
  const inline = page.getByTestId("notice-inline");
  const error = inline.getByRole("alert").first();
  await expect(error).toHaveAttribute("aria-live", "assertive");
  await expect(error.locator(".kit-notice__tone")).toHaveText("Error");
  await expect(error.locator(".kit-notice__tone")).toHaveCSS("clip-path", "inset(50%)");
  await expect(error).toHaveCSS("border-top-width", "0px");
  expect((await error.boundingBox())!.height).toBeGreaterThanOrEqual(32);

  const info = inline.getByRole("status");
  const tone = info.locator(".kit-notice__tone");
  await expect(tone).toBeVisible();
  await expect(tone).toHaveText("Info");
  const toneBox = (await tone.boundingBox())!;
  const messageBox = (await info.locator(".kit-notice__message").boundingBox())!;
  expect(toneBox.x).toBe(messageBox.x);
  expect(toneBox.y + toneBox.height).toBeLessThanOrEqual(messageBox.y);

  const note = inline.getByRole("note");
  await expect(note).toHaveText(/Draft saved\./);
  await expect(note).not.toHaveAttribute("aria-live");
  const title = (await note.locator(".kit-notice__title").boundingBox())!;
  const noteMessage = (await note.locator(".kit-notice__message").boundingBox())!;
  expect(title.y + title.height).toBeLessThanOrEqual(noteMessage.y);
  expect(title.x).toBe(noteMessage.x);
});

test("inline icons align with the first line of wrapped messages", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await gotoPage(page, "notice");
  const error = page.getByTestId("notice-inline-wrapped").getByRole("alert");
  const firstLine = await error.locator(".kit-notice__message").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = range.getClientRects();
    return { y: lines[0]!.y, height: lines[0]!.height, count: lines.length };
  });
  const icon = (await error.locator(".kit-notice__icon").boundingBox())!;
  expect(firstLine.count).toBeGreaterThan(1);
  expect(Math.abs(icon.y + icon.height / 2 - firstLine.y - firstLine.height / 2)).toBeLessThan(2);
});

test("inline actions work and align with their messages", async ({ page }) => {
  await gotoPage(page, "notice");
  const info = page.getByTestId("notice-inline").getByRole("status");
  await info.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("inline-notice-callbacks")).toHaveText("1");

  const error = page.getByTestId("notice-inline-wrapped").getByRole("alert");
  const errorBox = (await error.boundingBox())!;
  const buttonBox = (await error.getByRole("button").boundingBox())!;
  expect(
    Math.abs(errorBox.y + errorBox.height / 2 - buttonBox.y - buttonBox.height / 2),
  ).toBeLessThan(1);

  await page.setViewportSize({ width: 640, height: 800 });
  const edges = await info.evaluate((element) => {
    const message = element.querySelector(".kit-notice__message")!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element.querySelector("button")!);
    return { message: message.x, action: range.getBoundingClientRect().x };
  });
  expect(Math.abs(edges.message - edges.action)).toBeLessThan(1);
});

test("inline notice messages stay readable in light and dark themes", async ({ page }) => {
  await gotoPage(page, "notice");
  const inline = page.getByTestId("notice-inline");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    for (const notice of await inline.locator(".kit-notice").all()) {
      expect(await contrastOf(notice.locator(".kit-notice__message"))).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("the default notice keeps its visible tone and border", async ({ page }) => {
  await gotoPage(page, "notice");
  const card = page.locator(".kit-notice").first();
  await expect(card.locator(".kit-notice__tone")).toBeVisible();
  await expect(card).not.toHaveCSS("border-top-width", "0px");
});
