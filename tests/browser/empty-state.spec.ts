import { expect, test } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme } from "./helpers.js";

test("align top sits a fixed step below the page header", async ({ page }) => {
  await gotoPage(page, "empty-state");
  const frame = page.getByTestId("empty-state-page");
  const state = frame.locator(".kit-empty-state");
  await expect(state.getByText("No pinned messages")).toBeVisible();

  const gapAt = async (minHeight: number) => {
    await frame.evaluate((el, height) => {
      (el as HTMLElement).style.minHeight = `${height}px`;
    }, minHeight);
    return frame.evaluate((el) => {
      const header = el.querySelector(".kit-page-header")!.getBoundingClientRect();
      const icon = el.querySelector(".kit-empty-state__icon")!.getBoundingClientRect();
      return icon.top - header.bottom;
    });
  };
  // 48px of padding above the icon, whatever the header's margin.
  const gap = await gapAt(240);
  expect(gap).toBeGreaterThanOrEqual(48);
  expect(gap).toBeLessThan(80);
  // A taller page does not move it: it is not centered.
  expect(await gapAt(700)).toBe(gap);

  // No frame or fill.
  await expect(state).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(state).toHaveCSS("border-top-style", "none");
});

test("the default centers in its pane, at any height", async ({ page }) => {
  await gotoPage(page, "empty-state");
  const host = page.getByTestId("empty-state-centered");
  await expect(host.getByText("No sessions yet")).toBeVisible();
  const offsets = async (minHeight: number) => {
    await host.evaluate((el, height) => {
      (el as HTMLElement).style.minHeight = `${height}px`;
    }, minHeight);
    return host.evaluate((el) => {
      const pane = el.getBoundingClientRect();
      const state = el.querySelector(".kit-empty-state")!;
      const first = state.firstElementChild!.getBoundingClientRect();
      const last = state.lastElementChild!.getBoundingClientRect();
      return { above: first.top - pane.top, below: pane.bottom - last.bottom };
    });
  };
  for (const height of [320, 640]) {
    const { above, below } = await offsets(height);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
  }
});

test("the icon keeps the size its caller gave it", async ({ page }) => {
  await gotoPage(page, "empty-state");
  const svg = page.getByTestId("empty-state-page").locator(".kit-empty-state__icon svg");
  await expect(svg).toHaveCSS("width", "24px");
  await svg.evaluate((el) => {
    el.setAttribute("width", "40");
    el.setAttribute("height", "40");
  });
  await expect(svg).toHaveCSS("width", "40px");
});

for (const dark of [false, true]) {
  test(`title is primary ink, description and icon are muted · ${dark ? "dark" : "light"}`, async ({
    page,
  }) => {
    await gotoPage(page, "empty-state");
    await setTheme(page, { dark });
    const state = page.getByTestId("empty-state-page").locator(".kit-empty-state");
    const muted = await resolvedStyle(page, "color", "var(--text-muted)");
    await expect(state.locator(".kit-empty-state__title")).toHaveCSS(
      "color",
      await resolvedStyle(page, "color", "var(--text-primary)"),
    );
    await expect(state.locator(".kit-empty-state__description")).toHaveCSS("color", muted);
    await expect(state.locator(".kit-empty-state__icon")).toHaveCSS("color", muted);
    // Title at the body size, description one step smaller.
    await expect(state.locator(".kit-empty-state__title")).toHaveCSS("font-size", "13px");
    await expect(state.locator(".kit-empty-state__description")).toHaveCSS("font-size", "12px");
  });
}

test("a status state is announced and actions render below the text", async ({ page }) => {
  await gotoPage(page, "empty-state");
  await expect(page.getByRole("status").filter({ hasText: "No matches" })).toBeVisible();

  const build = page.getByRole("button", { name: "Build now" });
  await expect(build).toBeVisible();
  const text = page.getByText("Prepare past sessions for search by meaning.", { exact: true });
  expect((await build.boundingBox())!.y).toBeGreaterThan((await text.boundingBox())!.y);
});
