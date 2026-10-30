import { expect, test, type Locator } from "@playwright/test";
import { gotoPage } from "./helpers";

// Headless Chromium hides scrollbars by default, which would hide the
// scrollbar-width shift these tests guard against. Other browsers draw
// scrollbars their own way, so only Chromium has one that takes space here.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });
test.skip(({ browserName }) => browserName !== "chromium", "Needs Chromium's classic scrollbars");

async function overflows(scroller: Locator): Promise<boolean> {
  return scroller.evaluate((element) => element.scrollHeight > element.clientHeight);
}

async function scrollbarWidth(scroller: Locator): Promise<number> {
  return scroller.evaluate((element) => (element as HTMLElement).offsetWidth - element.clientWidth);
}

async function leftEdge(locator: Locator): Promise<number | undefined> {
  return (await locator.boundingBox())?.x;
}

test("a taller settings category keeps the centered panel in place", async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  await gotoPage(page, "settings-layout");
  const scroller = page.locator(".kit-settings__scroll");
  const firstHeading = page.locator(".kit-settings-section__header").first();
  expect(await overflows(scroller)).toBe(false);
  const before = await leftEdge(firstHeading);

  await page.getByRole("button", { name: /^Appearance/ }).click();
  await expect(page.getByText("Density", { exact: true })).toBeVisible();

  expect(await overflows(scroller)).toBe(true);
  expect(await scrollbarWidth(scroller)).toBeGreaterThan(0);
  expect(await leftEdge(firstHeading)).toBe(before);
});

test("opening example code keeps gallery content in place", async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await gotoPage(page, "status-bar");
  const scroller = page.locator(".content__body");
  const rightEdgeContent = page.locator(".kit-status-bar__section--right").first();
  expect(await overflows(scroller)).toBe(false);
  const before = await leftEdge(rightEdgeContent);

  await page.locator("summary", { hasText: "Example code" }).first().click();

  expect(await overflows(scroller)).toBe(true);
  expect(await scrollbarWidth(scroller)).toBeGreaterThan(0);
  expect(await leftEdge(rightEdgeContent)).toBe(before);
});

test("a section's views keep the sidebar's right-edge button in place", async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 400 });
  await page.goto("/?app-sidebar-frame=home");
  const scroller = page.locator(".kit-app-sidebar__scroll");
  const collapse = page.getByRole("button", { name: "Collapse sidebar" });
  await collapse.waitFor();
  expect(await overflows(scroller)).toBe(false);
  const before = await leftEdge(collapse);

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Reports", exact: true })
    .click();
  await expect(page.getByRole("list", { name: "Archive" })).toBeVisible();

  expect(await overflows(scroller)).toBe(true);
  expect(await scrollbarWidth(scroller)).toBeGreaterThan(0);
  expect(await leftEdge(collapse)).toBe(before);
});
