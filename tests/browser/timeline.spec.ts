import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("CommentCard keeps the standard body gap by default", async ({ page }) => {
  await gotoPage(page, "timeline");

  const card = page.locator(".kit-comment-card").nth(1);
  const header = card.locator(".kit-card__header");
  const body = card.locator(".kit-comment-card__body");

  const headerBox = await header.boundingBox();
  const bodyBox = await body.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(bodyBox!.y - (headerBox!.y + headerBox!.height)).toBe(8);
});

test("CommentCard can delegate its body gap to rich consumer content", async ({ page }) => {
  await gotoPage(page, "timeline");

  const card = page.locator(".demo-rich-comment");
  const header = card.locator(".kit-card__header");
  const content = card.locator(".demo-rich-comment__body");

  const headerBox = await header.boundingBox();
  const contentBox = await content.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(contentBox!.y - (headerBox!.y + headerBox!.height)).toBe(8);
});
