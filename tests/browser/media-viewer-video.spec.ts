import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// MediaViewer video items (docs/components/media-viewer.md), driven
// through the demo's inline player, which hands its position and play
// state to the viewer and takes them back when the video leaves.

function viewer(page: Page) {
  return page.getByRole("dialog");
}

function expanded(page: Page) {
  return viewer(page).locator("video");
}

function playback(video: Locator) {
  return video.evaluate((node) => {
    const media = node as HTMLVideoElement;
    return { time: media.currentTime, playing: !media.paused && !media.ended };
  });
}

/** Seek the inline player, optionally start it, then expand it. */
async function expandAt(page: Page, time: number, play: boolean) {
  const video = page.getByLabel("Inline test pattern video");
  await video.evaluate(
    async (node, { time, play }) => {
      const media = node as HTMLVideoElement;
      if (media.readyState < HTMLMediaElement.HAVE_METADATA)
        await new Promise((resolve) => media.addEventListener("loadedmetadata", resolve));
      media.currentTime = time;
      if (play) await media.play();
    },
    { time, play },
  );
  await page.getByRole("button", { name: "Expand video" }).click();
  await expect(expanded(page)).toBeVisible();
  return video;
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "media-viewer");
});

test("a video plays on in the viewer from where the inline player was", async ({ page }) => {
  const video = await expandAt(page, 2, true);

  await expect(viewer(page)).toHaveAccessibleName("Test pattern video (1 of 2)");
  await expect(expanded(page)).toHaveJSProperty("controls", true);
  expect(await expanded(page).evaluate((node) => (node as HTMLVideoElement).currentSrc)).toBe(
    await video.evaluate((node) => (node as HTMLVideoElement).currentSrc),
  );
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(true);
  const handedOver = await playback(expanded(page));
  expect(handedOver.time).toBeGreaterThanOrEqual(2);
  expect(handedOver.time).toBeLessThan(4);
  expect((await playback(video)).playing).toBe(false);
});

test("closing hands the position back, and playback resumes inline", async ({ page }) => {
  const video = await expandAt(page, 1, true);
  await expect.poll(async () => (await playback(expanded(page))).time).toBeGreaterThan(1.5);

  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  const resumed = await playback(video);
  expect(resumed.time).toBeGreaterThan(1.5);
  await expect.poll(async () => (await playback(video)).playing).toBe(true);
});

test("a paused video stays paused at its new position after closing", async ({ page }) => {
  const video = await expandAt(page, 1, false);
  expect((await playback(expanded(page))).playing).toBe(false);
  await expanded(page).evaluate((node) => {
    (node as HTMLVideoElement).currentTime = 4;
  });

  await page.getByRole("button", { name: "Close expanded view" }).click();
  await expect(viewer(page)).toHaveCount(0);
  expect(await playback(video)).toEqual({ time: 4, playing: false });
});

test("paging away pauses the video, and paging back resumes there", async ({ page }) => {
  const video = await expandAt(page, 1, true);
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(true);

  await page.getByRole("button", { name: "Next item" }).click();
  await expect(viewer(page)).toHaveAccessibleName("First swatch (2 of 2)");
  await expect(expanded(page)).toHaveCount(0);
  // The inline player has the position, but the user paged away, so it
  // does not start playing behind the viewer.
  const left = await playback(video);
  expect(left.time).toBeGreaterThanOrEqual(1);
  expect(left.playing).toBe(false);

  await page.getByRole("button", { name: "Previous item" }).click();
  await expect(expanded(page)).toBeVisible();
  await expect.poll(async () => (await playback(expanded(page))).time).toBe(left.time);
  expect((await playback(expanded(page))).playing).toBe(false);

  // Closing now does not resume inline playback either.
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  expect((await playback(video)).playing).toBe(false);
});

test("pointer input on the video works its controls, not pan, zoom, paging, or close", async ({
  page,
}) => {
  await expandAt(page, 0, false);
  const counter = page.locator(".kit-media-viewer__counter");
  const pan = page.locator(".kit-media-viewer__pan");
  const box = (await expanded(page).boundingBox())!;
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // A click on the picture toggles playback (Chromium's native control).
  await page.mouse.click(mid.x, mid.y);
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(true);
  await page.mouse.click(mid.x, mid.y);
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(false);

  // A drag and a wheel over the video, and a double-click, move nothing.
  await page.mouse.move(mid.x + 100, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x - 100, mid.y, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -300);
  await page.mouse.dblclick(mid.x, mid.y);
  await expect(pan).toHaveCSS("transform", "none");
  await expect(page.locator(".kit-media-viewer__viewport")).not.toHaveAttribute("data-zoomed");
  await expect(counter).toHaveText("1 / 2");
  await expect(viewer(page)).toBeVisible();
  // With no pan or zoom there is nothing to reset.
  await expect(page.getByRole("button", { name: "Reset view" })).toHaveCount(0);
});

test("arrow keys seek a focused video instead of paging", async ({ page }) => {
  await expandAt(page, 0, false);
  const counter = page.locator(".kit-media-viewer__counter");

  await expanded(page).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toHaveText("1 / 2");

  // With focus elsewhere in the viewer, they page as usual.
  await page.getByRole("button", { name: "Next item" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(counter).toHaveText("2 / 2");
});

test("a video keeps its natural size when it fits", async ({ page }) => {
  await expandAt(page, 0, false);
  const box = (await expanded(page).boundingBox())!;
  expect({ width: box.width, height: box.height }).toEqual({ width: 320, height: 180 });
});
