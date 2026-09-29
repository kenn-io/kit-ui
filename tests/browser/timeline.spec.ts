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

test("inline CommentCard keeps a system event on one row", async ({ page }) => {
  await gotoPage(page, "timeline");

  const card = page.locator(".demo-inline-event");
  const box = async (selector: string) => {
    const found = await card.locator(selector).boundingBox();
    expect(found, selector).not.toBeNull();
    return found!;
  };
  const eyebrow = await box(".kit-card__eyebrow");
  const author = await box(".kit-card__title");
  const body = await box(".kit-comment-card__body");
  const time = await box(".kit-card__meta");

  const middles = [eyebrow, author, body, time].map((b) => b.y + b.height / 2);
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThanOrEqual(3);
  expect(eyebrow.x).toBeLessThan(author.x);
  expect(author.x).toBeLessThan(body.x);
  expect(body.x + body.width).toBeLessThanOrEqual(time.x);
});
