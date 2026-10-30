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
  // The viewer seeks once the video's metadata loads; a test that seeks or
  // measures before then races it.
  await expect
    .poll(() =>
      expanded(page).evaluate((node, time) => {
        const media = node as HTMLVideoElement;
        return (
          media.readyState >= HTMLMediaElement.HAVE_METADATA && media.currentTime >= time - 0.05
        );
      }, time),
    )
    .toBe(true);
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

test("mute and volume carry into the viewer and back", async ({ page }) => {
  const video = inlinePlayer(page).locator("video");
  await video.evaluate((node) => {
    const media = node as HTMLVideoElement;
    media.muted = true;
    media.volume = 0.3;
  });
  await expandAt(page, 0, false);
  expect(
    await expanded(page).evaluate((node) => {
      const media = node as HTMLVideoElement;
      return { muted: media.muted, volume: media.volume };
    }),
  ).toEqual({ muted: true, volume: 0.3 });

  await expanded(page).evaluate((node) => {
    const media = node as HTMLVideoElement;
    media.muted = false;
    media.volume = 0.7;
  });
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  expect(
    await video.evaluate((node) => {
      const media = node as HTMLVideoElement;
      return { muted: media.muted, volume: media.volume };
    }),
  ).toEqual({ muted: false, volume: 0.7 });
});

test("mute and volume changed in the viewer survive paging away and back", async ({ page }) => {
  const video = await expandAt(page, 0, false);
  await expanded(page).evaluate((node) => {
    const media = node as HTMLVideoElement;
    media.muted = true;
    media.volume = 0.4;
  });

  await page.getByRole("button", { name: "Next item" }).click();
  await expect(viewer(page)).toHaveAccessibleName("Screenshot A (2 of 6)");
  await page.getByRole("button", { name: "Previous item" }).click();
  await expect(expanded(page)).toBeVisible();

  const audio = (media: Locator) =>
    media.evaluate((node) => {
      const element = node as HTMLVideoElement;
      return { muted: element.muted, volume: element.volume };
    });
  expect(await audio(expanded(page))).toEqual({ muted: true, volume: 0.4 });
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  expect(await audio(video)).toEqual({ muted: true, volume: 0.4 });
});

test("a chosen speed carries to every player, the viewer, and the next visit", async ({ page }) => {
  const speed = inlinePlayer(page).getByRole("button", { name: /^Playback rate/ });
  await expect(speed).toHaveAttribute("data-rate", "1");

  await speed.click();

  await expect(speed).toHaveAttribute("data-rate", "1.2");
  await expect(inlinePlayer(page).locator("video")).toHaveJSProperty("playbackRate", 1.2);

  // A new visit: both players on the page start at the chosen speed.
  await page.reload();
  await page.locator(".content__heading").waitFor();
  const videos = page.locator(".kit-video-player video");
  await expect(videos).toHaveCount(2);
  for (const video of await videos.all()) await expect(video).toHaveJSProperty("playbackRate", 1.2);

  // The viewer's player, too, and a change there is remembered.
  await expandAt(page, 0, false);
  await expect(expanded(page)).toHaveJSProperty("playbackRate", 1.2);
  await viewer(page)
    .getByRole("button", { name: /^Playback rate/ })
    .click();
  await expect(expanded(page)).toHaveJSProperty("playbackRate", 1.5);
  // The player saves on ratechange, which the browser fires as its own task.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("kit-ui:video-playback-rate")))
    .toBe("1.5");
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

  await viewer(page).getByRole("button", { name: "Play", exact: true }).focus();
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

test("a player with several sources plays the first the browser supports, expanded too", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const { mountVideoPlayer, clip } =
      await import("/tests/browser/fixtures/mount-video-player.svelte.ts");
    mountVideoPlayer({
      label: "Two-format video",
      preload: "metadata",
      sources: [
        { src: "/missing.mp4", type: "video/x-unsupported" },
        { src: clip, type: "video/webm" },
      ],
    });
  });
  const player = page
    .locator(".kit-video-player")
    .filter({ has: page.getByLabel("Two-format video") });
  const video = player.locator("video");
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentSrc))
    .toMatch(/media-viewer-demo\.webm/);

  await player.getByRole("button", { name: "Open video in expanded view" }).click();
  await expect(viewer(page)).toHaveAccessibleName(/^Two-format video/);
  expect(await expanded(page).evaluate((node) => (node as HTMLVideoElement).currentSrc)).toMatch(
    /media-viewer-demo\.webm/,
  );
});

// A 160px player is a small inline embed, or a 9:16 video in an 844x390
// landscape phone viewer. A 21:9 one is only 69px tall.
for (const shape of [
  { name: "16:9", ratio: null },
  { name: "portrait", ratio: "9 / 16" },
  { name: "21:9", ratio: "21 / 9" },
]) {
  test(`a 160px ${shape.name} player on a touch screen keeps every control on it, apart`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 844, height: 390 },
    });
    const page = await context.newPage();
    await gotoPage(page, "media-viewer");
    await page.evaluate(async (ratio) => {
      const { mountVideoPlayer, clip } =
        await import("/tests/browser/fixtures/mount-video-player.svelte.ts");
      const { host } = mountVideoPlayer({
        label: "Narrow video",
        src: clip,
        preload: "metadata",
      });
      host.style.width = "160px";
      // Shaped as the viewer shapes the player of a video of that shape.
      if (ratio) host.querySelector<HTMLElement>(".kit-video-player")!.style.aspectRatio = ratio;
    }, shape.ratio);
    const player = page
      .locator(".kit-video-player")
      .filter({ has: page.getByLabel("Narrow video") });
    const bar = player.getByRole("group", { name: "Video controls" });
    // Video.js labels its buttons once they connect.
    await expect(bar.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
    // The 16:9 player takes its height from the clip.
    await expect
      .poll(() => player.locator("video").evaluate((node) => (node as HTMLVideoElement).videoWidth))
      .toBeGreaterThan(0);

    const box = (await player.boundingBox())!;
    if (!shape.ratio) expect(box.height).toBeCloseTo(90, 0);
    // The seek bar's slider role is on its thumb, which shows only while
    // in use, so measure the bar itself.
    const controls = [
      ...(await bar.getByRole("button").all()),
      player.locator(".kit-video-player__seek"),
    ];
    expect(controls.length).toBe(6);
    const boxes = [];
    for (const control of controls) {
      const rect = (await control.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(box.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(rect.y).toBeGreaterThanOrEqual(box.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
      boxes.push(rect);
    }
    // No control covers another, and the seek bar is long enough to drag.
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        expect(
          a.x + a.width <= b.x + 0.5 ||
            b.x + b.width <= a.x + 0.5 ||
            a.y + a.height <= b.y + 0.5 ||
            b.y + b.height <= a.y + 0.5,
        ).toBe(true);
    expect(boxes.at(-1)!.width).toBeGreaterThanOrEqual(40);
    await context.close();
  });
}

type SwapWindow = typeof window & {
  swap: (sources: { src: string; type?: string }[]) => void;
  second: string;
};

/** Mount a player on `clip` whose sources a test can replace; `second`
 * is the same clip at another URL. */
async function mountSwappable(page: Page) {
  await page.evaluate(async () => {
    const { mountVideoPlayer, clip } =
      await import("/tests/browser/fixtures/mount-video-player.svelte.ts");
    const { update } = mountVideoPlayer({
      label: "Swapped video",
      preload: "metadata",
      sources: [{ src: clip, type: "video/webm" }],
    });
    const swap = window as SwapWindow;
    swap.swap = (sources) => update({ sources });
    swap.second = `${clip}?second`;
  });
  // The viewer's player carries the same label; the inline one comes first.
  const player = page
    .locator(".kit-video-player")
    .filter({ has: page.getByLabel("Swapped video") })
    .first();
  const video = player.locator("video");
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentSrc))
    .toMatch(/media-viewer-demo\.webm$/);
  return { player, video };
}

test("replacing a player's sources loads the new clip, expanded too", async ({ page }) => {
  const { player, video } = await mountSwappable(page);

  await page.evaluate(() => {
    const swap = window as SwapWindow;
    swap.swap([{ src: swap.second, type: "video/webm" }]);
  });

  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentSrc))
    .toMatch(/\?second$/);
  await player.getByRole("button", { name: "Open video in expanded view" }).click();
  await expect(viewer(page)).toHaveAccessibleName(/^Swapped video/);
  expect(await expanded(page).evaluate((node) => (node as HTMLVideoElement).currentSrc)).toMatch(
    /\?second$/,
  );
});

test("a full-screen player hides its expand control, whose viewer would open out of sight", async ({
  page,
}) => {
  const player = inlinePlayer(page);
  const expand = player.getByRole("button", { name: "Open video in expanded view" });
  await expect(expand).toBeVisible();

  await player.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);

  await expect(expand).toBeHidden();
  await player.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(expand).toBeVisible();
});

test("replacing the sources while expanded leaves the new clip alone on close", async ({
  page,
}) => {
  const { player, video } = await mountSwappable(page);
  await seekTo(video, 1, false);
  await player.getByRole("button", { name: "Open video in expanded view" }).click();
  await expect(viewer(page)).toHaveAccessibleName(/^Swapped video/);
  // Playing when the viewer closes, so the handover would resume playback.
  await expanded(page).evaluate(async (node) => {
    const media = node as HTMLVideoElement;
    media.muted = true;
    if (media.readyState < HTMLMediaElement.HAVE_METADATA)
      await new Promise((resolve) => media.addEventListener("loadedmetadata", resolve));
    await media.play();
  });

  await page.evaluate(() => {
    const swap = window as SwapWindow;
    swap.swap([{ src: swap.second, type: "video/webm" }]);
  });
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentSrc))
    .toMatch(/\?second$/);
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);

  // The old clip's position and playback do not carry into the new one.
  expect(await playback(video)).toEqual({ time: 0, playing: false });
});

test("a chosen speed survives the player loading again", async ({ page }) => {
  const { player, video } = await mountSwappable(page);
  const speed = player.getByRole("button", { name: /^Playback rate/ });
  await speed.click();
  await expect(video).toHaveJSProperty("playbackRate", 1.2);
  // Let the control show the choice before the host reloads the source.
  // The native property changes before the browser delivers ratechange.
  await expect(speed).toHaveAccessibleName("Playback rate 1.2");

  // A host reloading the video, then new sources.
  await video.evaluate((node) => (node as HTMLVideoElement).load());
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  await expect(video).toHaveJSProperty("playbackRate", 1.2);
  await page.evaluate(() => {
    const swap = window as SwapWindow;
    swap.swap([{ src: swap.second, type: "video/webm" }]);
  });
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentSrc))
    .toMatch(/\?second$/);

  await expect(video).toHaveJSProperty("playbackRate", 1.2);
  // The player saves on ratechange, which the browser fires as its own task.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("kit-ui:video-playback-rate")))
    .toBe("1.2");
});

test("a video item with no chosen source plays the first its sources the browser supports", async ({
  page,
}) => {
  // An idle inline player can be expanded before it has picked a source.
  await page.evaluate(async () => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    const { clip } = await import("/tests/browser/fixtures/mount-video-player.svelte.ts");
    mountMediaViewer(
      [
        {
          kind: "video",
          src: "",
          sources: [
            { src: "/missing.mp4", type: "video/x-unsupported" },
            { src: clip, type: "video/webm" },
          ],
          label: "Unpicked video",
        },
      ],
      0,
    );
  });
  await expect
    .poll(() => expanded(page).evaluate((node) => (node as HTMLVideoElement).currentSrc))
    .toMatch(/media-viewer-demo\.webm/);
});

test("a viewer reopened by refilling its items starts the video afresh", async ({ page }) => {
  // A host may close the viewer by emptying `items` and keep it mounted.
  await page.evaluate(async () => {
    const { mountMediaViewer } =
      await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
    const { clip } = await import("/tests/browser/fixtures/mount-video-player.svelte.ts");
    const left: { currentTime: number; playing: boolean }[] = [];
    const video = {
      kind: "video" as const,
      src: clip,
      label: "Session video",
      currentTime: 1,
      playing: true,
      onleave: (state: { currentTime: number; playing: boolean }) => left.push(state),
    };
    const image = {
      kind: "image" as const,
      src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'/%3E",
      alt: "Swatch",
    };
    const host = mountMediaViewer([video, image], 0);
    Object.assign(window, { __session: { host, video, image, left } });
  });
  type Session = {
    host: { replaceItems: (items: unknown[]) => void };
    video: { currentTime: number };
    image: unknown;
    left: { currentTime: number; playing: boolean }[];
  };
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(true);

  // Close with the video showing, then empty the items.
  await page.keyboard.press("Escape");
  await page.evaluate(() =>
    (window as unknown as { __session: Session }).__session.host.replaceItems([]),
  );
  await expect(viewer(page)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { __session: Session }).__session.left.at(-1)?.playing,
    ),
  ).toBe(true);

  // Reopen the same item from a new position.
  await page.evaluate(() => {
    const { host, video, image } = (window as unknown as { __session: Session }).__session;
    video.currentTime = 3;
    host.replaceItems([video, image]);
  });
  await expect.poll(async () => (await playback(expanded(page))).playing).toBe(true);
  expect((await playback(expanded(page))).time).toBeGreaterThanOrEqual(3);

  // Paging away in the new open pauses; it does not report the old close.
  await page.getByRole("button", { name: "Next item" }).click();
  await expect(expanded(page)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { __session: Session }).__session.left.at(-1)?.playing,
    ),
  ).toBe(false);
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

for (const scenario of [
  {
    name: "play pressed before the metadata loads still plays inline after closing",
    action: "Play",
    openingPlaying: false,
    expectedPlaying: true,
  },
  {
    name: "pause pressed before the metadata loads stays paused after closing",
    action: "Pause",
    openingPlaying: true,
    expectedPlaying: false,
  },
]) {
  test(scenario.name, async ({ page }) => {
    // The clip's request never answers, so the viewer never gets metadata.
    await page.route(/\?stalled$/, () => {});
    await page.evaluate(async (openingPlaying) => {
      const { mountMediaViewer } =
        await import("/tests/browser/fixtures/media-viewer-host.svelte.ts");
      const { clip } = await import("/tests/browser/fixtures/mount-video-player.svelte.ts");
      const left: { currentTime: number; playing: boolean }[] = [];
      const video = {
        kind: "video" as const,
        src: `${clip}?stalled`,
        label: "Session video",
        currentTime: 2,
        playing: openingPlaying,
        onleave: (state: { currentTime: number; playing: boolean }) => left.push(state),
      };
      const host = mountMediaViewer([video], 0);
      Object.assign(window, { __stalled: { host, left } });
    }, scenario.openingPlaying);

    await viewer(page).getByRole("button", { name: scenario.action, exact: true }).click();
    await expect
      .poll(async () => (await playback(expanded(page))).playing)
      .toBe(scenario.expectedPlaying);
    type Stalled = {
      host: { replaceItems: (items: unknown[]) => void };
      left: { currentTime: number; playing: boolean }[];
    };
    // Close, then empty the items as the host does.
    await page.keyboard.press("Escape");
    await page.evaluate(() =>
      (window as unknown as { __stalled: Stalled }).__stalled.host.replaceItems([]),
    );
    await expect(viewer(page)).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        (window as unknown as { __stalled: Stalled }).__stalled.left.map(
          ({ currentTime, playing }) => ({ currentTime, playing }),
        ),
      ),
    ).toEqual([{ currentTime: 2, playing: scenario.expectedPlaying }]);
  });
}

/** Mounts an idle player with no known length, then gives it one, as a host
 * that reads the length elsewhere does. 12:34 is far from the clip's own. */
async function mountWithKnownLength(page: Page) {
  const mediaRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "media") mediaRequests.push(request.url());
  });
  await page.evaluate(async () => {
    const { mountVideoPlayer, clip } =
      await import("/tests/browser/fixtures/mount-video-player.svelte.ts");
    const { update } = mountVideoPlayer({
      label: "Idle video",
      preload: "none",
      sources: [{ src: clip, type: "video/webm" }],
    });
    (window as KnownLengthWindow).knowLength = (duration) => update({ duration });
  });
  const player = page.locator(".kit-video-player").filter({ has: page.getByLabel("Idle video") });
  return { player, video: player.locator("video"), mediaRequests };
}

type KnownLengthWindow = typeof window & { knowLength: (duration: number) => void };

test("an idle player shows the length its host knows without fetching anything", async ({
  page,
}) => {
  const { player, mediaRequests } = await mountWithKnownLength(page);
  const lengths = player.locator(".kit-video-player__time").getByText(/^\d+:\d+$/);

  // No known length yet: both clocks read zero, as they always have.
  await expect(lengths).toHaveText(["0:00", "0:00"]);

  await page.evaluate(() => (window as KnownLengthWindow).knowLength(754.9));

  await expect(player.locator(".kit-video-player__time").getByText("12:34")).toBeVisible();
  await expect(player.locator(".kit-video-player__length")).toBeHidden();
  // A length alone gives nothing to seek in.
  await expect(player.locator("media-time-slider")).toHaveAttribute("data-disabled");
  expect(mediaRequests).toEqual([]);
});

test("the video's own length replaces a known one that differs", async ({ page }) => {
  const { player, video } = await mountWithKnownLength(page);
  await page.evaluate(() => (window as KnownLengthWindow).knowLength(754));
  await expect(player.locator(".kit-video-player__time").getByText("12:34")).toBeVisible();

  await video.evaluate((node) => {
    const media = node as HTMLVideoElement;
    media.muted = true;
    return media.play();
  });

  await expect(player.locator(".kit-video-player__time").getByText("12:34")).toBeHidden();
  await expect(player.locator(".kit-video-player__length")).toHaveText("0:06");
  // The seek bar spans the video's own length, not the known one.
  const length = await video.evaluate((node) => (node as HTMLVideoElement).duration);
  await expect(player.getByRole("slider", { name: "Seek" })).toHaveAttribute(
    "aria-valuemax",
    String(length),
  );
});
