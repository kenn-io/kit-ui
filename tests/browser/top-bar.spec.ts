import { expect, test, type Locator, type Page } from "@playwright/test";
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

test("a page outside the tab set leaves every tab inactive in both modes", async ({ page }) => {
  await gotoPage(page, "top-bar");

  const host = page.locator(".bar-host").first();
  const bar = host.locator(".kit-top-bar");
  const tabs = bar.locator(".kit-top-bar__tabs");
  const dropdown = bar.locator(".kit-top-bar__nav-select");
  const slider = page.locator('input[type="range"]').first();

  await expect(tabs.locator('[aria-current="page"]')).toHaveText("Activity");

  // The demo's Settings button sets active to an id no tab has.
  await bar.getByRole("button", { name: "Settings" }).click();
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(tabs.locator(".kit-top-bar__tab.active")).toHaveCount(0);

  for (const width of [800, 680, 560, 440, 360]) {
    await setSlider(slider, width);
  }
  const trigger = dropdown.locator(".kit-select-dropdown__trigger");
  await expect(trigger).toHaveText("—");
  await expect(trigger).not.toContainText("Activity");

  // The placeholder cannot be picked; a real tab still can.
  await trigger.click();
  await expect(page.getByRole("option", { name: "—" })).toBeDisabled();
  await page.getByRole("option", { name: "Pulls" }).click();
  await expect(trigger).toHaveText("Pulls");

  for (const width of [440, 560, 680, 800, 920]) {
    await setSlider(slider, width);
  }
  await expect(tabs.locator('[aria-current="page"]')).toHaveText("Pulls");
});

test("an unset active starts on the first enabled tab", async ({ page }) => {
  await gotoPage(page, "top-bar");

  // The agentsview demo bar never sets active.
  const bar = page.locator(".bar-host").nth(1).locator(".kit-top-bar");
  await expect(bar.locator('[aria-current="page"]')).toHaveText("Sessions");
  await expect(bar.locator(".kit-top-bar__tab.active")).toHaveText("Sessions");
});

/** Inter ships as font-display: optional, so a cold load, like every test
 * page, keeps the fallback font for the page's lifetime. This applies the
 * loaded face, as a warm cache does, and waits for the bar to re-measure. */
async function useBrandFont(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (
          rule instanceof CSSFontFaceRule &&
          rule.style.getPropertyValue("font-family").includes("Inter")
        ) {
          rule.style.setProperty("font-display", "block");
        }
      }
    }
    await Promise.all([
      document.fonts.load("400 13px Inter"),
      document.fonts.load("500 13px Inter"),
    ]);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

test("compact tabs are quieter and the current one is the shared raised pill", async ({ page }) => {
  // The gallery's default window: all ten tabs open expanded in it, in
  // the brand font a returning visitor sees, which is wider than the
  // fallback a first load uses.
  await gotoPage(page, "top-bar");
  await useBrandFont(page);
  const bar = page.locator(".bar-host--many .kit-top-bar");
  await expect(bar.locator(".kit-top-bar__tabs")).toBeVisible();
  const current = bar.locator('.kit-top-bar__tabs [aria-current="page"]');
  await expect(current).toHaveText("Usage");

  const style = (el: Element) => {
    const s = getComputedStyle(el);
    return { size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor };
  };
  const other = await bar.getByRole("button", { name: "Pinned" }).evaluate(style);
  const active = await current.evaluate(style);
  const tokens = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.fontSize = "var(--font-size-sm)";
    probe.style.color = "var(--text-muted)";
    probe.style.backgroundColor = "var(--selected-strong-bg)";
    probe.style.fontWeight = "var(--selected-strong-weight)";
    document.body.append(probe);
    const s = getComputedStyle(probe);
    const out = {
      size: s.fontSize,
      muted: s.color,
      selected: s.backgroundColor,
      weight: s.fontWeight,
    };
    probe.remove();
    return out;
  });
  expect(other.size).toBe(tokens.size);
  expect(other.weight).toBe("400");
  expect(active.weight).toBe(tokens.weight);
  expect(active.weight).toBe("500");
  expect(other.color).toBe(tokens.muted);
  expect(active.bg).toBe(tokens.selected);

  // The flexible search sits a clear 24px from the tab strip.
  const gap = await bar.evaluate((el) => {
    const nav = el.querySelector(".kit-top-bar__nav")!.getBoundingClientRect();
    const search = el.querySelector(".kit-top-bar__search")!.getBoundingClientRect();
    return search.left - nav.right;
  });
  expect(gap).toBeGreaterThanOrEqual(23.5);

  await bar.getByRole("button", { name: "Settings" }).click();
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(0);
});

for (const host of [".bar-host--many", ".bar-host"] as const) {
  test(`no tab moves when the current tab changes · ${
    host === ".bar-host--many" ? "compact" : "regular"
  }`, async ({ page }) => {
    // Wide, so the ten compact tabs stay expanded at bold too.
    await page.setViewportSize({ width: 1700, height: 900 });
    await gotoPage(page, "top-bar");
    // A test machine's fallback font may draw medium as wide as regular,
    // which would let this pass with nothing reserved. Bold is wider in
    // every font, so select at bold.
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--selected-strong-weight", "700"),
    );
    const bar = page.locator(host).first().locator(".kit-top-bar");
    const tabs = bar.locator(".kit-top-bar__tabs .kit-top-bar__tab");
    const boxes = () =>
      tabs.evaluateAll((all) =>
        all.map((tab) => {
          const { left, width } = tab.getBoundingClientRect();
          return { left, width };
        }),
      );
    const weightOf = (tab: Locator) => tab.evaluate((el) => getComputedStyle(el).fontWeight);
    await expect(tabs.first()).toBeVisible();
    const count = await tabs.count();
    expect(count).toBeGreaterThan(2);

    const before = await boxes();
    const last = tabs.nth(count - 1);
    // Not yet current: its label box is already wider than its text.
    const slack = await last.locator(".kit-top-bar__tab-label").evaluate((label) => {
      const range = document.createRange();
      range.selectNodeContents(label);
      return label.getBoundingClientRect().width - range.getBoundingClientRect().width;
    });
    expect(slack).toBeGreaterThan(0.5);

    await last.click();
    await expect(last).toHaveAttribute("aria-current", "page");
    expect(await weightOf(last)).toBe("700");
    expect(await boxes()).toEqual(before);

    // The width-reserving copy of the label stays out of the name.
    const label = (await last.locator(".kit-top-bar__tab-label").textContent())!;
    await expect(bar.getByRole("button", { name: label, exact: true })).toHaveCount(1);
  });
}

test("the collapse probe measures the same tab widths the bar renders", async ({ page }) => {
  await gotoPage(page, "top-bar");
  const bar = page.locator(".bar-host--many .kit-top-bar");
  const widths = (selector: string) =>
    bar.locator(selector).evaluateAll((all) => all.map((tab) => tab.getBoundingClientRect().width));
  const rendered = await widths(".kit-top-bar__tabs .kit-top-bar__tab");
  expect(rendered.length).toBeGreaterThan(0);
  expect(await widths(".kit-top-bar__probe .kit-top-bar__tab")).toEqual(rendered);
});
