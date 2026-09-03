import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("status motion is static by default and compositor-friendly when enabled", async ({
  page,
}) => {
  await gotoPage(page, "status-dot");

  const defaultAnimationNames = await Promise.all(
    [
      page.locator(".kit-status-dot--working").first(),
      page.locator(".kit-status-bubble").first(),
    ].map((indicator) => indicator.evaluate((element) => getComputedStyle(element).animationName)),
  );

  const animatedWorking = page.locator(".kit-status-dot--working.kit-status-dot--animated");
  const optInAnimationNames = await Promise.all([
    animatedWorking.evaluate((element) => getComputedStyle(element, "::after").animationName),
    page
      .locator(".kit-status-bubble--animated")
      .evaluate((element) => getComputedStyle(element).animationName),
  ]);

  expect(defaultAnimationNames).toEqual(["none", "none"]);
  expect(optInAnimationNames[0]).toMatch(/kit-status-glow$/);
  expect(optInAnimationNames[1]).toMatch(/kit-icon-breathe$/);
});
