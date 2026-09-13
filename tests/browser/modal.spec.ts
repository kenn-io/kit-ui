import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// A phone gives a page two heights: the large one it has when the URL bar is
// hidden, which 100vh reports, and the smaller one visible whenever the bar is
// shown. A panel capped with the first can be taller than the screen, and the
// footer, being last, is what goes.
//
// Emulation.setSmallViewportHeightDifferenceOverride sets that gap, which is
// what makes this reproducible without a phone: a headless browser has no URL
// bar, so without it 100vh and 100svh are the same and nothing shows.
test("a tall modal keeps its footer within the height a phone shows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await gotoPage(page, "modal");

  const cdp = await page.context().newCDPSession(page);
  // Applied after navigating: a navigation clears it.
  await cdp.send("Emulation.setSmallViewportHeightDifferenceOverride", { difference: 120 });

  await page.getByRole("button", { name: "Open tall modal" }).click();
  const done = page.getByRole("button", { name: "Done" });
  await expect(done).toBeVisible();

  const { small, large } = await page.evaluate(() => {
    const measure = (unit: string) => {
      const probe = document.createElement("div");
      probe.style.cssText = `position:fixed;top:0;width:0;height:100${unit}`;
      document.body.append(probe);
      const height = probe.getBoundingClientRect().height;
      probe.remove();
      return height;
    };
    return { small: measure("svh"), large: measure("vh") };
  });
  expect(large, "the URL-bar allowance is in effect").toBeGreaterThan(small);

  const box = (await done.boundingBox())!;
  expect(box).not.toBeNull();
  expect(
    box.y + box.height,
    `the footer is within the ${small}px shown, not the ${large}px 100vh claims`,
  ).toBeLessThanOrEqual(small);

  // The body is what gives way, by scrolling.
  const scrolls = await page
    .locator(".kit-modal-body")
    .evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrolls, "the body scrolls rather than pushing the footer out").toBe(true);
});
