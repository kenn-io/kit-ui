import { expect, test, type Locator } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

// One selected idiom across choice groups: the raised pill drawn from the
// --selected-strong-* tokens in theme.css, in light and dark.

async function expectSelectedPill(locator: Locator): Promise<void> {
  // Resolve the tokens beside the element: a popover retunes them.
  const style = await locator.evaluate((el) => {
    // Finish the theme-switch transition before reading the settled style.
    for (const animation of el.getAnimations()) animation.finish();
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--selected-strong-bg)";
    probe.style.boxShadow = "var(--selected-strong-edge)";
    el.parentElement!.append(probe);
    const want = getComputedStyle(probe);
    const s = getComputedStyle(el);
    const out = {
      bg: s.backgroundColor,
      shadow: s.boxShadow,
      opacity: s.opacity,
      wantBg: want.backgroundColor,
      wantShadow: want.boxShadow,
    };
    probe.remove();
    return out;
  });
  expect(style.bg).toBe(style.wantBg);
  expect(style.shadow).toBe(style.wantShadow);
  expect(style.opacity).toBe("1");
}

for (const dark of [false, true]) {
  const mode = dark ? "dark" : "light";

  test(`segmented control uses the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "segmented-control");
    await setTheme(page, { dark, highContrast: false });
    await expectSelectedPill(
      page
        .locator(".kit-segmented:not(.kit-segmented--borderless) .kit-segmented__btn.active")
        .first(),
    );
    // A read-only control keeps its chosen option at full strength.
    await expectSelectedPill(
      page.getByTestId("segmented-readonly").locator(".kit-segmented__btn.active"),
    );
  });

  test(`date presets hang from the mode tabs as a narrower tray · ${mode}`, async ({ page }) => {
    await gotoPage(page, "date-range-picker");
    await setTheme(page, { dark, highContrast: false });
    await page.locator(".kit-date-range-picker__trigger").first().click();
    const panel = page.locator(".kit-date-range-picker__panel");
    await expect(panel.locator(".kit-date-range-picker__pills")).toBeVisible();

    // Relative, then Calendar: both option rows hang from the mode tabs.
    for (const tab of [0, 1]) {
      await panel.locator(".kit-segmented__btn").nth(tab).click();
      const geometry = await panel.evaluate((el) => {
        for (const animation of el.getAnimations({ subtree: true })) animation.finish();
        const track = el.querySelector(".kit-date-range-picker__tabs .kit-segmented")!;
        const tray = el.querySelector(".kit-date-range-picker__pills")!;
        const chosenMode = track.querySelector(".kit-segmented__btn.active")!;
        const chosenOption = tray.querySelector(".kit-date-range-picker__pill.active");
        const t = track.getBoundingClientRect();
        const r = tray.getBoundingClientRect();
        const style = (node: Element) => getComputedStyle(node);
        return {
          gap: r.top - t.bottom,
          insetLeft: r.left - t.left,
          insetRight: t.right - r.right,
          trayTopCorners: [style(tray).borderTopLeftRadius, style(tray).borderTopRightRadius],
          trayBottomCorner: style(tray).borderBottomLeftRadius,
          trayFill: style(tray).backgroundColor,
          trackFill: style(track).backgroundColor,
          modeShadow: style(chosenMode).boxShadow,
          optionShadow: chosenOption ? style(chosenOption).boxShadow : "none",
          optionHeight: chosenOption?.getBoundingClientRect().height ?? 0,
          modeHeight: chosenMode.getBoundingClientRect().height,
        };
      });
      const info = JSON.stringify(geometry);
      // Joined to the track's bottom edge, inset from both ends, square on
      // top and rounded below, in the track's fill: one shape.
      expect(Math.abs(geometry.gap), info).toBeLessThanOrEqual(0.5);
      expect(geometry.insetLeft, info).toBeGreaterThanOrEqual(8);
      expect(geometry.insetRight, info).toBeGreaterThanOrEqual(8);
      expect(geometry.trayTopCorners, info).toEqual(["0px", "0px"]);
      expect(geometry.trayBottomCorner, info).not.toBe("0px");
      expect(geometry.trayFill, info).toBe(geometry.trackFill);
      // Only the chosen mode is raised; the chosen option is a flat tint.
      expect(geometry.modeShadow, info).not.toBe("none");
      expect(geometry.optionShadow, info).toBe("none");
    }
  });

  test(`top bar current tab uses the shared selected pill · ${mode}`, async ({ page }) => {
    await gotoPage(page, "top-bar");
    await setTheme(page, { dark, highContrast: false });
    await expectSelectedPill(page.locator('.kit-top-bar__tab[aria-current="page"]').first());
  });
}
