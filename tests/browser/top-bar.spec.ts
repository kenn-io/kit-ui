import { expect, test } from "@playwright/test";
import { gotoPage, setSlider } from "./helpers.js";

// TopBar collapses its tab group into a SelectDropdown by measurement
// (with an expand latch so it doesn't oscillate). The demo hosts the bar
// in a slider-controlled container, so we sweep real widths.

test("tabs collapse into a dropdown when narrow and expand back when wide", async ({ page }) => {
  await gotoPage(page, "top-bar");

  const host = page.locator(".bar-host").first();
  const bar = host.locator(".kit-top-bar");
  const tabs = bar.locator(".kit-top-bar__tabs");
  // Scoped to the nav's collapse target — the demo bar also carries an
  // unrelated SelectDropdown (repo picker) in its right region.
  const dropdown = bar.locator(".kit-top-bar__nav-select");
  const slider = page.locator('input[type="range"]').first();

  // Wide: the full tab row fits.
  await expect(tabs).toBeVisible();
  await expect(dropdown).not.toBeVisible();

  // Sweep down in steps (the collapse is measured, not a breakpoint).
  for (const width of [800, 680, 560, 440, 360]) {
    await setSlider(slider, width);
  }
  await expect(dropdown).toBeVisible();
  await expect(tabs).not.toBeVisible();

  // Collapsed dropdown still switches tabs.
  await dropdown.locator(".kit-select-dropdown__trigger").click();
  await page.getByRole("option", { name: "Issues" }).click();
  await expect(dropdown).toContainText("Issues");

  // Sweep back up — the latch releases once the full row fits again.
  for (const width of [440, 560, 680, 800, 920]) {
    await setSlider(slider, width);
  }
  await expect(tabs).toBeVisible();
  await expect(dropdown).not.toBeVisible();
  // The selection made while collapsed is preserved.
  await expect(tabs.locator(".kit-top-bar__tab.active")).toHaveText("Issues");
});

test("per-tab indicator dot renders on the tab, in the probe, and survives collapse", async ({
  page,
}) => {
  await gotoPage(page, "top-bar");

  const host = page.locator(".bar-host").first();
  const bar = host.locator(".kit-top-bar");
  const slider = page.locator('input[type="range"]').first();

  // Expanded: the Reviews tab carries the dot, title included.
  const tabDot = bar.getByRole("button", { name: "Reviews" }).locator(".kit-top-bar__tab-dot");
  await expect(tabDot).toBeVisible();
  await expect(tabDot).toHaveAttribute("title", "roborev daemon unreachable");

  // The hidden measurement probe renders it too, so the dot participates
  // in the collapse math (probe is visibility:hidden — count, not visible).
  await expect(bar.locator(".kit-top-bar__probe .kit-top-bar__tab-dot")).toHaveCount(1);

  // The demo toggle drops the indicator from the tab and the probe alike.
  const toggle = page.getByRole("checkbox", { name: "Reviews indicator" });
  await toggle.uncheck();
  await expect(bar.locator(".kit-top-bar__tab-dot")).toHaveCount(0);
  await toggle.check();
  await expect(tabDot).toBeVisible();

  // Collapse: the dropdown option shows the dot…
  for (const width of [800, 680, 560, 440, 360]) {
    await setSlider(slider, width);
  }
  const dropdown = bar.locator(".kit-top-bar__nav-select");
  await expect(dropdown).toBeVisible();
  await dropdown.locator(".kit-select-dropdown__trigger").click();
  const reviewsOption = page.getByRole("option", { name: "Reviews" });
  await expect(reviewsOption.locator(".kit-select-dropdown__indicator")).toBeVisible();

  // …and once that tab is the selection, the closed trigger shows it too.
  await reviewsOption.click();
  const triggerDot = dropdown.locator(
    ".kit-select-dropdown__trigger .kit-select-dropdown__indicator",
  );
  await expect(triggerDot).toBeVisible();
  await expect(triggerDot).toHaveAttribute("title", "roborev daemon unreachable");
});

test("the hidden measurement probe adds no sideways scroll to a narrow container", async ({
  page,
}) => {
  await gotoPage(page, "top-bar");

  // The demo host clips (overflow: hidden), which makes it a scroll
  // container: anything the bar spills past its edge shows up in its
  // scrollWidth, the same way it would on a phone-width page. The second
  // (search) demo is used because its collapsed bar still fits at 360px;
  // the first demo's side regions alone overflow there.
  const host = page.locator(".bar-host").nth(1);
  const bar = host.locator(".kit-top-bar");
  const tabs = bar.locator(".kit-top-bar__tabs");
  const dropdown = bar.locator(".kit-top-bar__nav-select");
  const probe = bar.locator(".kit-top-bar__probe");
  const slider = page.locator('input[type="range"]').nth(1);
  const overflow = () =>
    host.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));

  for (const width of [800, 680, 560, 440, 360]) {
    await setSlider(slider, width);
  }
  await expect(dropdown).toBeVisible();

  // The probe still lays out the full row, wider than the bar…
  const probeWidth = await probe.evaluate((el) => (el as HTMLElement).offsetWidth);
  const barWidth = await bar.evaluate((el) => el.clientWidth);
  expect(probeWidth).toBeGreaterThan(barWidth);
  // …without pushing the container's scrollable area past its edge.
  const collapsed = await overflow();
  expect(collapsed.scrollWidth).toBeLessThanOrEqual(collapsed.clientWidth);

  for (const width of [440, 560, 680, 800, 920]) {
    await setSlider(slider, width);
  }
  await expect(tabs).toBeVisible();
  await expect(dropdown).not.toBeVisible();
  const expanded = await overflow();
  expect(expanded.scrollWidth).toBeLessThanOrEqual(expanded.clientWidth);
});
