import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("CommentCard does not add a second gap before consumer body content", async ({ page }) => {
  await gotoPage(page, "timeline");

  const card = page.locator(".kit-comment-card").first();
  const header = card.locator(".kit-card__header");
  const body = card.locator(".kit-comment-card__body");

  await page.addStyleTag({ content: ".consumer-body { margin-block-start: 8px; }" });
  await body.evaluate((element) => {
    element.innerHTML = '<p class="consumer-body" data-test="margin-body">Body</p>';
  });

  const headerBox = await header.boundingBox();
  const contentBox = await body.locator('[data-test="margin-body"]').boundingBox();
  expect(headerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(contentBox!.y - (headerBox!.y + headerBox!.height)).toBe(8);
});
