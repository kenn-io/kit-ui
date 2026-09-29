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

test("TimelineItem spacing follows --kit-timeline-gap", async ({ page }) => {
  await gotoPage(page, "timeline");

  const items = page.locator(".kit-timeline-item");
  const gapAfterFirst = async () => {
    const first = await items
      .nth(0)
      .locator(".kit-timeline-item__content > *")
      .first()
      .boundingBox();
    const second = await items.nth(1).boundingBox();
    return second!.y - (first!.y + first!.height);
  };
  const standard = await gapAfterFirst();
  await items
    .nth(0)
    .evaluate((el) => (el as HTMLElement).style.setProperty("--kit-timeline-gap", "4px"));
  expect(standard - (await gapAfterFirst())).toBeCloseTo(12, 0);
});

test("inline CommentCard keeps a long author inside a narrow card", async ({ page }) => {
  await gotoPage(page, "timeline");

  const card = page.locator(".demo-inline-event");
  await card.evaluate((el) => {
    (el as HTMLElement).style.width = "280px";
    el.querySelector(".kit-card__title")!.textContent =
      "a-very-long-automation-account-name-for-release-tooling";
  });

  const fits = await card.evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits).toBe(true);
  const cardBox = (await card.boundingBox())!;
  const timeBox = (await card.locator(".kit-card__meta").boundingBox())!;
  expect(timeBox.x + timeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  const summaryBox = (await card.locator(".kit-comment-card__body").boundingBox())!;
  expect(summaryBox.width).toBeGreaterThan(0);
});

test("inline CommentCard keeps a long type label and time inside a narrow card", async ({
  page,
}) => {
  await gotoPage(page, "timeline");

  const card = page.locator(".demo-inline-event");
  await card.evaluate((el) => {
    (el as HTMLElement).style.width = "220px";
    el.querySelector(".kit-card__eyebrow")!.textContent = "review requested from a team";
    el.querySelector(".kit-card__meta")!.textContent = "vor ungefähr siebzehn Stunden";
  });

  const fits = await card.evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits).toBe(true);
  const cardBox = (await card.boundingBox())!;
  for (const part of [".kit-card__eyebrow", ".kit-card__title", ".kit-card__meta"]) {
    const box = (await card.locator(part).boundingBox())!;
    expect(box.x, part).toBeGreaterThanOrEqual(cardBox.x);
    expect(box.x + box.width, part).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  }
});

test("inline CommentCard keeps its summary visible when every label is long", async ({ page }) => {
  await gotoPage(page, "timeline");

  const card = page.locator(".demo-inline-event");
  await card.evaluate((el) => {
    (el as HTMLElement).style.width = "220px";
    el.querySelector(".kit-card__eyebrow")!.textContent = "review requested from a team";
    el.querySelector(".kit-card__title")!.textContent = "a-very-long-automation-account-name";
    el.querySelector(".kit-card__meta")!.textContent = "vor ungefähr siebzehn Stunden";
  });

  expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const inner = await card.evaluate((el) => el.clientWidth);
  const summary = (await card.locator(".kit-comment-card__body").boundingBox())!;
  expect(summary.width).toBeGreaterThanOrEqual(inner * 0.25);
});
