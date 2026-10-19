import { expect, test, type Page } from "@playwright/test";

// Telemetry claims across tabs (docs/utilities.md). Each page in a context
// shares localStorage but runs in its own renderer, so writes reach other
// tabs asynchronously, which a unit-test storage fake cannot reproduce.

const BEFORE = new Date("2026-10-03T23:59:59Z");
const AFTER = new Date("2026-10-04T00:00:01Z");
const ROLLBACK = new Date("2026-10-03T12:00:00Z");

/** Opens a tab at `time` and starts a reporter whose replies are `held` or answered with `status`. */
async function startTab(page: Page, time: Date, status: string, held: boolean) {
  await page.clock.setFixedTime(time);
  // A blank page on the dev server's origin; the gallery itself isn't needed.
  await page.route("/blank", (route) => route.fulfill({ contentType: "text/html", body: "" }));
  await page.goto("/blank");
  await page.evaluate(
    async ({ status, held }) => {
      const { startBrowserTelemetry } = await import("/src/lib/utils/browser-telemetry.ts");
      const w = window as unknown as Record<string, unknown[]>;
      w.posts = [];
      w.replies = [];
      w.quiet = [];
      const reply = { status: 202, data: { status } };
      const reporter = startBrowserTelemetry({
        route: "/api/v1/telemetry/events",
        surface: "web",
        storageKey: "kit-ui.app-opened.example.web",
        post: (_route, event) => {
          w.posts!.push(event.event);
          return held
            ? new Promise((resolve) => w.replies!.push(() => resolve(reply)))
            : Promise.resolve(reply);
        },
      });
      reporter.onQuietChange((quiet) => w.quiet!.push(quiet));
      for (let i = 0; i < 20; i++) await Promise.resolve();
    },
    { status, held },
  );
}
const read = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Record<string, unknown[]>;
    return { posts: w.posts, quiet: w.quiet };
  });

test("a daily action stays claimed after reloading the same page", async ({ page }) => {
  await page.clock.setFixedTime(BEFORE);
  await page.route("/blank", (route) => route.fulfill({ contentType: "text/html", body: "" }));
  await page.goto("/blank");
  for (const phase of ["initial", "reload"]) {
    if (phase === "reload") await page.reload();
    const posts = await page.evaluate(async () => {
      const { startBrowserTelemetry } = await import("/src/lib/utils/browser-telemetry.ts");
      const posts: string[] = [];
      const reporter = startBrowserTelemetry({
        route: "/api/v1/telemetry/events",
        surface: "web",
        storageKey: "kit-ui.app-opened.example.web",
        post: async (_route, event) => {
          posts.push(event.event);
          return { status: 202, data: { status: "queued" } };
        },
      });
      reporter.reportDaily("message", { event: "message_opened", properties: { surface: "web" } });
      for (let i = 0; i < 20; i++) await Promise.resolve();
      return posts;
    });
    expect(posts).toEqual(phase === "initial" ? ["app_opened", "message_opened"] : []);
  }
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

    await Promise.all(
      [before, after].map((page) =>
        page.evaluate(async () => {
          for (const resolve of (window as unknown as { replies: (() => void)[] }).replies)
            resolve();
          for (let i = 0; i < 20; i++) await Promise.resolve();
        }),
      ),
    );

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
