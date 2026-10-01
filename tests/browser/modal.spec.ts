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
test("a tall modal keeps its footer within the height a phone shows", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "the URL-bar override is a CDP call");
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

test("the backdrop closes only on a press that starts and ends on it", async ({ page }) => {
  await gotoPage(page, "modal");
  const dialog = page.getByRole("dialog");
  const open = async () => {
    await page.getByRole("button", { name: "Open modal" }).click();
    await expect(dialog).toBeVisible();
    return (await page.locator(".kit-modal-panel").boundingBox())!;
  };
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
  };

  // Backdrop to panel, and panel to backdrop: both keep the modal open.
  let panel = await open();
  const backdrop = { x: 10, y: 10 };
  const inside = { x: panel.x + panel.width / 2, y: panel.y + 10 };
  await drag(backdrop, inside);
  await expect(dialog).toBeVisible();
  await drag(inside, backdrop);
  await expect(dialog).toBeVisible();

  // A release off-screen (pointer capture keeps the backdrop as target)
  // hits nothing, so the click that follows does not close.
  await page.locator(".kit-modal-overlay").evaluate((overlay) => {
    const fire = (type: string, x: number, y: number) =>
      overlay.dispatchEvent(
        new PointerEvent(type, { pointerId: 9, clientX: x, clientY: y, bubbles: true }),
      );
    fire("pointerdown", 10, 10);
    fire("pointerup", -50, -50);
    overlay.dispatchEvent(new MouseEvent("click", { clientX: -50, clientY: -50, bubbles: true }));
  });
  await expect(dialog).toBeVisible();

  // A press that starts and ends on the backdrop closes it.
  await page.mouse.click(backdrop.x, backdrop.y);
  await expect(dialog).toBeHidden();
  panel = await open();
  expect(panel.width).toBeGreaterThan(0);
});
