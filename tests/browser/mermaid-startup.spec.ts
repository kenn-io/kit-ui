import { expect, test } from "@playwright/test";

for (const [dependency, url] of [
  ["icons", /maximize-2/],
  ["metadata", /mermaid\/package\.json/],
] as const) {
  test(`renders a complete viewer when ${dependency} arrive after window.load`, async ({
    page,
  }) => {
    const loaded = page.waitForEvent("load");
    await page.route("**/startup-load.svg", async (route) => {
      await page.waitForFunction(() => document.body.dataset.mermaidLoaded === "true");
      await route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      });
    });
    let heldDependency = false;
    await page.route(url, async (route) => {
      heldDependency = true;
      const response = await route.fetch();
      // Keep shared initialization pending while Mermaid's real load listener runs.
      await loaded;
      await route.fulfill({ response });
    });
    await page.route(/flowDiagram-.*\.js/, async (route) => {
      // A slow diagram chunk keeps an automatic render in progress until kit-ui
      // initializes. Release it at that boundary, without replacing Mermaid.
      await page.waitForFunction(() => document.body.dataset.mermaidInitialized === "true");
      await route.continue();
    });

    await page.goto("/tests/browser/fixtures/mermaid-startup.html");
    expect(heldDependency).toBe(true);

    const viewer = page.locator("pre.mermaid.kit-mermaid-viewer");
    const flowchart = viewer.locator(".kit-mermaid-viewer__pan svg.flowchart");
    await expect(flowchart).toBeVisible();
    await expect(flowchart.locator(".node")).toHaveCount(2);
    await expect(flowchart.locator(".edgePath path, path.flowchart-link")).toHaveCount(1);
    await expect(flowchart).toContainText("Start");
    await expect(flowchart).toContainText("Finish");
    await expect(viewer.locator(".kit-mermaid-viewer__button svg.lucide")).toHaveCount(3);

    await viewer.getByRole("button", { name: "Open diagram in expanded view" }).click();
    const lightbox = page.getByRole("dialog");
    await expect(lightbox.locator("svg.flowchart .node")).toHaveCount(2);
    await lightbox.getByRole("button", { name: "Close expanded diagram" }).click();
    await expect(lightbox).toHaveCount(0);
  });
}
