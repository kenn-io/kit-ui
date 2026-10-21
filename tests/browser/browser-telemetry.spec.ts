import { expect, test, type Page } from "@playwright/test";
import type { BrowserTelemetryReporter } from "../../src/lib/utils/browser-telemetry.js";

// Telemetry claims across tabs (docs/utilities.md). Each page in a context
// shares localStorage but runs in its own renderer, so writes reach other
// tabs asynchronously, which a unit-test storage fake cannot reproduce.

const BEFORE = new Date("2026-10-03T23:59:59Z");
const AFTER = new Date("2026-10-04T00:00:01Z");
const ROLLBACK = new Date("2026-10-03T12:00:00Z");

/** Opens a tab at `time` and starts a reporter whose replies are `held` or answered with `status`. */
async function startTab(
  page: Page,
  time: Date,
  status: string,
  held: boolean,
  storageKey = "kit-ui.app-opened.example.web",
  url = "/blank",
) {
  await page.clock.setFixedTime(time);
  // A blank page on the dev server's origin; the gallery itself isn't needed.
  await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: "" }));
  await page.goto(url);
  await page.evaluate(
    async ({ status, held, storageKey }) => {
      const { startBrowserTelemetry } = await import("/src/lib/utils/browser-telemetry.ts");
      const w = window as unknown as Record<string, unknown[]>;
      w.posts = [];
      w.replies = [];
      w.quiet = [];
      const reply = { status: 202, data: { status } };
      const reporter = startBrowserTelemetry({
        route: "/api/v1/telemetry/events",
        surface: "web",
        storageKey,
        post: (_route, event) => {
          w.posts!.push(event.event);
          return held
            ? new Promise((resolve) => w.replies!.push(() => resolve(reply)))
            : Promise.resolve(reply);
        },
      });
      w.reporters = [reporter];
      reporter.onQuietChange((quiet) => w.quiet!.push(quiet));
      for (let i = 0; i < 20; i++) await Promise.resolve();
    },
    { status, held, storageKey },
  );
}
const read = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Record<string, unknown[]>;
    return { posts: w.posts, quiet: w.quiet };
  });

const holdVisit = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { reporters: BrowserTelemetryReporter[] };
    w.reporters[0]!.reportVisit(
      { event: "session_ended", properties: { duration: 42 } },
      { keepalive: true },
    );
  });
const releaseReplies = (page: Page) =>
  page.evaluate(async () => {
    for (const resolve of (window as unknown as { replies: (() => void)[] }).replies) resolve();
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

test("stored enabled permission drains a closed page's visit on plain HTTP", async ({
  context,
  baseURL,
}) => {
  // Proxy the test server through a non-loopback HTTP origin so secure-context APIs are absent.
  await context.route("http://telemetry.example/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  const before = await context.newPage();
  const key = "http-server";
  const url = "http://telemetry.example/blank";
  await startTab(before, BEFORE, "queued", true, key, url);
  expect(await before.evaluate(() => isSecureContext)).toBe(false);
  await holdVisit(before);
  await before.close();
  const enabled = await context.newPage();
  await startTab(enabled, BEFORE, "queued", true, key, url);
  // A receipt after stop still records permission, leaving delivery to the next page.
  await enabled.evaluate(() => {
    (window as unknown as { reporters: { stop(): void }[] }).reporters[0]!.stop();
  });
  await releaseReplies(enabled);
  expect((await read(enabled)).posts).toEqual(["app_opened"]);
  const reopened = await context.newPage();
  await startTab(reopened, BEFORE, "queued", false, key, url);
  expect((await read(reopened)).posts).toEqual(["session_ended"]);
});

for (const status of ["queued", "disabled"]) {
  test(`concurrent ${status} replies across midnight preserve claims on reload and rollback`, async ({
    context,
  }) => {
    const before = await context.newPage();
    const after = await context.newPage();
    await startTab(before, BEFORE, status, true);
    await startTab(after, AFTER, status, true);
    expect((await read(before)).posts).toEqual(["app_opened"]);
    expect((await read(after)).posts).toEqual(["app_opened"]);

    await Promise.all([before, after].map(releaseReplies));

    for (const time of [AFTER, ROLLBACK]) {
      const page = await context.newPage();
      await startTab(page, time, "queued", false);
      expect(await read(page), time.toISOString()).toEqual({
        posts: [],
        quiet: [status === "disabled"],
      });
    }
  });
}
