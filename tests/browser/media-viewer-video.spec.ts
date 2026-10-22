import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// VideoPlayer (docs/components/video-player.md) and MediaViewer video
// items (docs/components/media-viewer.md), driven through the demo's
// inline player: its expand control opens the page gallery on it, and
// playback hands over to the viewer and back.

function viewer(page: Page) {
  return page.getByRole("dialog");
}

function expanded(page: Page) {
  return viewer(page).locator("video");
}

function inlinePlayer(page: Page) {
  return page.locator(".media-demo-video .kit-video-player").first();
}

function playback(video: Locator) {
  return video.evaluate((node) => {
    const media = node as HTMLVideoElement;
    return { time: media.currentTime, playing: !media.paused && !media.ended };
  });
}

async function seekTo(video: Locator, time: number, play: boolean) {
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
}

/** Seek the inline player, optionally start it, then expand it with the
 * control in its bar. */
async function expandAt(page: Page, time: number, play: boolean) {
  const video = inlinePlayer(page).locator("video");
  await seekTo(video, time, play);
  await inlinePlayer(page).getByRole("button", { name: "Open video in expanded view" }).click();
  await expect(expanded(page)).toBeVisible();
  return video;
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "media-viewer");
  // Mermaid renders asynchronously, and the diagram joins the gallery
  // once it has.
  await page.locator("pre.mermaid.kit-mermaid-viewer").waitFor({ timeout: 15_000 });
});

test("the expand control sits in the player's bar beside full screen", async ({ page }) => {
  const bar = inlinePlayer(page).getByRole("group", { name: "Video controls" });
  const names = await bar
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(names.slice(-2)).toEqual(["Open video in expanded view", "Enter fullscreen"]);
});

test("a video plays on in the viewer from where the inline player was", async ({ page }) => {
  const video = await expandAt(page, 2, true);

  await expect(viewer(page)).toHaveAccessibleName("Test pattern video (1 of 6)");
  expect(await expanded(page).evaluate((node) => (node as HTMLVideoElement).currentSrc)).toBe(
    await video.evaluate((node) => (node as HTMLVideoElement).currentSrc),
  );
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(true);
  const handedOver = await playback(expanded(page));
  expect(handedOver.time).toBeGreaterThanOrEqual(2);
  expect(handedOver.time).toBeLessThan(4);
  expect((await playback(video)).playing).toBe(false);
  // The viewer's player is already the expanded view.
  await expect(
    viewer(page).getByRole("button", { name: "Open video in expanded view" }),
  ).toHaveCount(0);
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

test("the gallery pages through the page's videos, images, and diagrams in order", async ({
  page,
}) => {
  await expandAt(page, 0, false);
  const seen: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    seen.push((await viewer(page).getAttribute("aria-label")) ?? "");
    await page.getByRole("button", { name: "Next item" }).click();
  }
  expect(seen).toEqual([
    "Test pattern video (1 of 6)",
    "Screenshot A (2 of 6)",
    "Mermaid diagram (3 of 6)",
    "Screenshot B (4 of 6)",
    "Second test pattern video (5 of 6)",
    "ImagePreview swatch (6 of 6)",
  ]);
  // Paging wraps back to the first video, shown in a player.
  await expect(viewer(page)).toHaveAccessibleName("Test pattern video (1 of 6)");
  await expect(viewer(page).locator(".kit-video-player")).toBeVisible();
});

test("paging away pauses the video, and paging back resumes there", async ({ page }) => {
  const video = await expandAt(page, 1, true);
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(true);

  await page.getByRole("button", { name: "Next item" }).click();
  await expect(viewer(page)).toHaveAccessibleName("Screenshot A (2 of 6)");
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

test("pointer input on the video plays it, and never pans, zooms, pages, or closes", async ({
  page,
}) => {
  await expandAt(page, 0, false);
  const counter = page.locator(".kit-media-viewer__counter");
  const pan = page.locator(".kit-media-viewer__pan");
  const box = (await expanded(page).boundingBox())!;
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 3 };

  // A click on the picture plays and pauses.
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
  await expect(counter).toHaveText("1 / 6");
  await expect(viewer(page)).toBeVisible();
  // With no pan or zoom there is nothing to reset.
  await expect(page.getByRole("button", { name: "Reset view" })).toHaveCount(0);
});

test("arrow keys seek a focused player by five seconds instead of paging", async ({ page }) => {
  await expandAt(page, 0.5, false);
  const counter = page.locator(".kit-media-viewer__counter");

  await viewer(page).getByRole("button", { name: "Play" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await playback(expanded(page))).time).toBeCloseTo(5.5, 1);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await playback(expanded(page))).time).toBeCloseTo(0.5, 1);
  await expect(counter).toHaveText("1 / 6");

  // With focus elsewhere in the viewer, they page as usual.
  await page.getByRole("button", { name: "Next item" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(counter).toHaveText("2 / 6");
});

test("the inline player's keyboard shortcuts play and mute", async ({ page }) => {
  const video = inlinePlayer(page).locator("video");
  await seekTo(video, 0, false);
  await inlinePlayer(page).getByRole("button", { name: "Mute" }).focus();

  await page.keyboard.press("k");
  await expect.poll(async () => (await playback(video)).playing).toBe(true);
  await page.keyboard.press("m");
  await expect(video).toHaveJSProperty("muted", true);
  await page.keyboard.press("k");
  await expect.poll(async () => (await playback(video)).playing).toBe(false);
});

for (const viewport of [
  { name: "wide", width: 1280, height: 800 },
  { name: "short", width: 1400, height: 500 },
]) {
  test(`a small video grows to fill a ${viewport.name} viewer, keeping its shape`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await expandAt(page, 0, false);
    // The demo clip is 320x180, far smaller than the viewer.
    expect(
      await expanded(page).evaluate((node) => {
        const media = node as HTMLVideoElement;
        return { width: media.videoWidth, height: media.videoHeight };
      }),
    ).toEqual({ width: 320, height: 180 });

    const area = (await page.locator(".kit-media-viewer__pan").boundingBox())!;
    const box = (await viewer(page).locator(".kit-video-player").boundingBox())!;
    // The player fits the viewer and fills it in one direction.
    expect(box.width).toBeLessThanOrEqual(area.width + 0.5);
    expect(box.height).toBeLessThanOrEqual(area.height + 0.5);
    const fillsWidth = Math.abs(box.width - area.width) <= 1;
    const fillsHeight = Math.abs(box.height - area.height) <= 1;
    expect(fillsWidth || fillsHeight).toBe(true);
    expect(box.width).toBeGreaterThan(320);
    // The player keeps the picture's 16:9 shape, so its controls sit on
    // the picture rather than on bars beside it.
    expect(box.width / box.height).toBeCloseTo(320 / 180, 2);
  });
}
