import { expect, test, type Page } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

// DateRangePicker's presets (7d … All, Day / Week / Month) are a lower tier
// of the mode tabs: tucked flush under them, inset so the tabs overhang,
// with a quieter fill, smaller options, and the shared selected pill.

async function openPicker(page: Page, dark: boolean) {
  await gotoPage(page, "date-range-picker");
  await setTheme(page, { dark, highContrast: false });
  const trigger = page.locator(".kit-date-range-picker__trigger").first();
  await trigger.click();
  const panel = page.locator(".kit-date-range-picker__panel");
  await expect(panel).toBeVisible();
  return { trigger, panel };
}

for (const dark of [false, true]) {
  test(`date presets are a lower tier tucked under the mode tabs · ${dark ? "dark" : "light"}`, async ({
    page,
  }) => {
    const { panel } = await openPicker(page, dark);

    for (const mode of [0, 1]) {
      await panel.locator(".kit-segmented__btn").nth(mode).click();
      const geometry = await panel.evaluate((el) => {
        for (const animation of el.getAnimations({ subtree: true })) animation.finish();
        const track = el.querySelector(".kit-date-range-picker__tabs .kit-segmented")!;
        const presets = el.querySelector(".kit-date-range-picker__pills")!;
        const chosenMode = track.querySelector(".kit-segmented__btn.active")!;
        const otherMode = track.querySelector(".kit-segmented__btn:not(.active)")!;
        const chosenOption = presets.querySelector(".kit-date-range-picker__pill.active")!;
        const otherOption = presets.querySelector(".kit-date-range-picker__pill:not(.active)")!;
        const t = track.getBoundingClientRect();
        const p = presets.getBoundingClientRect();
        const style = (node: Element) => getComputedStyle(node);
        const corners = (node: Element) => {
          const s = style(node);
          return [
            s.borderTopLeftRadius,
            s.borderTopRightRadius,
            s.borderBottomRightRadius,
            s.borderBottomLeftRadius,
          ];
        };
        return {
          gap: p.top - t.bottom,
          left: p.left - t.left,
          right: t.right - p.right,
          trackCorners: corners(track),
          presetCorners: corners(presets),
          trackFill: style(track).backgroundColor,
          presetFill: style(presets).backgroundColor,
          presetBorders: [
            style(presets).borderTopWidth,
            style(presets).borderRightWidth,
            style(presets).borderBottomWidth,
            style(presets).borderLeftWidth,
          ],
          presetShadow: style(presets).boxShadow,
          roomAbove: chosenOption.getBoundingClientRect().top - p.top,
          roomBelow: p.bottom - chosenOption.getBoundingClientRect().bottom,
          modeButtonCorners: corners(chosenMode),
          optionCorners: corners(chosenOption),
          modeHeight: chosenMode.getBoundingClientRect().height,
          optionHeight: chosenOption.getBoundingClientRect().height,
          modeFontSize: parseFloat(style(chosenMode).fontSize),
          optionFontSize: parseFloat(style(chosenOption).fontSize),
          chosenMode: [
            style(chosenMode).backgroundColor,
            style(chosenMode).boxShadow,
            style(chosenMode).fontWeight,
          ],
          chosenOption: [
            style(chosenOption).backgroundColor,
            style(chosenOption).boxShadow,
            style(chosenOption).fontWeight,
          ],
          otherModeFill: style(otherMode).backgroundColor,
          otherOptionFill: style(otherOption).backgroundColor,
          ornaments: [presets, track, el.querySelector(".kit-date-range-picker__tabs")!].flatMap(
            (node) => [
              getComputedStyle(node, "::before").content,
              getComputedStyle(node, "::after").content,
            ],
          ),
        };
      });
      const info = JSON.stringify(geometry);
      // Flush with the track's bottom edge, inset so the track overhangs it
      // by the same amount on both sides.
      expect(Math.abs(geometry.gap), info).toBeLessThanOrEqual(1);
      expect(geometry.left, info).toBeGreaterThanOrEqual(12);
      expect(geometry.left, info).toBeLessThanOrEqual(20);
      expect(geometry.right, info).toBeCloseTo(geometry.left, 0);
      // A straight square top with no ornament at the join; the bottom
      // corners use the track's radius.
      for (const ornament of geometry.ornaments) {
        expect(["none", "normal"], info).toContain(ornament);
      }
      expect(geometry.presetCorners.slice(0, 2), info).toEqual(["0px", "0px"]);
      expect(geometry.presetCorners.slice(2), info).toEqual(geometry.trackCorners.slice(2));
      expect(geometry.trackCorners[2], info).not.toBe("0px");
      // Its own quieter fill inside a hairline ring, with one contact line
      // painted over the ring's top row, so the line runs the full width and
      // the top corners stay square. Borders would leave a mitred corner
      // pixel, so the tier has none.
      expect(geometry.presetFill, info).not.toBe(geometry.trackFill);
      expect(geometry.presetBorders, info).toEqual(["0px", "0px", "0px", "0px"]);
      const [contactLine, ring, ...extra] = geometry.presetShadow
        .split(/,(?![^(]*\))/)
        .map((s) => s.trim());
      expect(extra, info).toEqual([]);
      expect(contactLine, info).toMatch(/ 0px 1px 0px 0px inset$/);
      expect(ring, info).toMatch(/ 0px 0px 0px 1px inset$/);
      // Tier fill shows above and below the chosen preset.
      expect(geometry.roomAbove, info).toBeGreaterThanOrEqual(3);
      expect(geometry.roomBelow, info).toBeGreaterThanOrEqual(3);
      // Options shaped like the mode tabs, unselected ones flat.
      expect(geometry.optionCorners, info).toEqual(geometry.modeButtonCorners);
      expect(geometry.otherOptionFill, info).toBe(geometry.otherModeFill);
      // The chosen preset uses the same selected pill as the chosen mode…
      expect(geometry.chosenOption, info).toEqual(geometry.chosenMode);
      // …and stays subordinate through size: shorter, in smaller type.
      expect(geometry.optionHeight, info).toBeLessThan(geometry.modeHeight);
      expect(geometry.optionFontSize, info).toBeLessThan(geometry.modeFontSize);
    }
  });
}

test("a picker that opens upward keeps the preset tier clear of its trigger", async ({ page }) => {
  await gotoPage(page, "date-range-picker");
  // Pin the first picker near the bottom of the window so its panel opens
  // upward. The gallery has several pickers; move only this one.
  await page
    .locator(".kit-date-range-picker")
    .first()
    .evaluate((el) => {
      el.dataset.testPinned = "";
    });
  await page.addStyleTag({
    content:
      "[data-test-pinned] { position: fixed !important; left: 48px; bottom: 20px; top: auto; z-index: 50; }",
  });
  const trigger = page.locator("[data-test-pinned] .kit-date-range-picker__trigger");
  await trigger.click();
  const panel = page.locator("[data-test-pinned] .kit-date-range-picker__panel");
  await expect(panel).toBeVisible();

  for (const mode of [0, 1]) {
    await panel.locator(".kit-segmented__btn").nth(mode).click();
    // The panel re-anchors on the next frame after its height changes.
    const bottoms = async () => {
      const triggerBox = (await trigger.boundingBox())!;
      const panelBox = (await panel.boundingBox())!;
      const presetBox = (await panel.locator(".kit-date-range-picker__pills").boundingBox())!;
      return {
        triggerTop: triggerBox.y,
        panelBottom: panelBox.y + panelBox.height,
        presetBottom: presetBox.y + presetBox.height,
      };
    };
    await expect
      .poll(async () => {
        const b = await bottoms();
        return b.panelBottom <= b.triggerTop;
      })
      .toBe(true);
    const b = await bottoms();
    const info = JSON.stringify(b);
    expect(b.presetBottom, info).toBeLessThanOrEqual(b.panelBottom);
    expect(b.presetBottom, info).toBeLessThan(b.triggerTop);
  }
});

// Text is rem and grows with the touch scale and the reader's browser font
// size; the tier's chrome is px. The tier keeps its short default row, and
// only enlarged labels may grow it.
test("enlarged touch labels fit their preset buttons and the tier", async ({ page }) => {
  await gotoPage(page, "date-range-picker");
  await page.evaluate(() => document.documentElement.classList.add("kit-type-touch"));
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.locator(".kit-date-range-picker__trigger").first().click();
  const panel = page.locator(".kit-date-range-picker__panel");
  await expect(panel).toBeVisible();

  for (const mode of [0, 1]) {
    await panel.locator(".kit-segmented__btn").nth(mode).click();
    const measured = await panel.evaluate((el) => {
      // A label's own box: the text inside a button, not the button.
      const textBox = (button: Element) => {
        const range = document.createRange();
        range.selectNodeContents(button);
        return range.getBoundingClientRect();
      };
      const inside = (inner: DOMRect, outer: DOMRect) =>
        inner.top >= outer.top - 0.5 &&
        inner.bottom <= outer.bottom + 0.5 &&
        inner.left >= outer.left - 0.5 &&
        inner.right <= outer.right + 0.5;
      const report = (buttons: Element[], container: Element) => {
        const outer = container.getBoundingClientRect();
        return buttons.map((button) => {
          const box = button.getBoundingClientRect();
          const text = textBox(button);
          return {
            label: button.textContent!.trim(),
            fontSize: parseFloat(getComputedStyle(button).fontSize),
            buttonHeight: box.height,
            textHeight: text.height,
            textWidth: text.width,
            buttonWidth: box.width,
            textFits: inside(text, box),
            buttonFits: inside(box, outer),
          };
        });
      };
      const presets = el.querySelector(".kit-date-range-picker__pills")!;
      const track = el.querySelector(".kit-date-range-picker__tabs .kit-segmented")!;
      const panelBox = el.getBoundingClientRect();
      return {
        presetHeight: presets.getBoundingClientRect().height,
        trackHeight: track.getBoundingClientRect().height,
        presets: report([...presets.querySelectorAll(".kit-date-range-picker__pill")], presets),
        modes: report([...track.querySelectorAll(".kit-segmented__btn")], track),
        tierInsidePanel: inside(presets.getBoundingClientRect(), panelBox),
        trackInsidePanel: inside(track.getBoundingClientRect(), panelBox),
        gap: presets.getBoundingClientRect().top - track.getBoundingClientRect().bottom,
      };
    });
    const info = JSON.stringify(measured);
    // The labels really are enlarged: well past the 17px default row.
    for (const preset of measured.presets) {
      expect(preset.fontSize, info).toBeGreaterThan(20);
      expect(preset.textFits, `${preset.label} label inside its button: ${info}`).toBe(true);
      expect(preset.buttonFits, `${preset.label} button inside the tier: ${info}`).toBe(true);
    }
    // The mode tabs above face the same enlarged text.
    for (const modeTab of measured.modes) {
      expect(modeTab.textFits, `${modeTab.label} label inside its tab: ${info}`).toBe(true);
      expect(modeTab.buttonFits, `${modeTab.label} tab inside the track: ${info}`).toBe(true);
    }
    expect(measured.tierInsidePanel, info).toBe(true);
    expect(measured.trackInsidePanel, info).toBe(true);
    // Still one tier hanging flush under the track.
    expect(Math.abs(measured.gap), info).toBeLessThanOrEqual(1);
  }
});

// The floor that enlarged text grows from: at the desktop base, and at the
// touch scale on its own, the row keeps its short fixed size.
for (const touch of [false, true]) {
  test(`the preset row keeps its short default size · ${touch ? "touch scale" : "desktop scale"}`, async ({
    page,
  }) => {
    await gotoPage(page, "date-range-picker");
    await page.evaluate(
      (on) => document.documentElement.classList.toggle("kit-type-touch", on),
      touch,
    );
    await page.locator(".kit-date-range-picker__trigger").first().click();
    const panel = page.locator(".kit-date-range-picker__panel");
    await expect(panel).toBeVisible();
    for (const mode of [0, 1]) {
      await panel.locator(".kit-segmented__btn").nth(mode).click();
      const heights = await panel.evaluate((el) => ({
        options: [...el.querySelectorAll(".kit-date-range-picker__pill")].map(
          (option) => option.getBoundingClientRect().height,
        ),
        tier: el.querySelector(".kit-date-range-picker__pills")!.getBoundingClientRect().height,
        tabRows: new Set(
          [...el.querySelectorAll(".kit-segmented__btn")].map(
            (tab) => tab.getBoundingClientRect().top,
          ),
        ).size,
      }));
      expect(new Set(heights.options), JSON.stringify(heights)).toEqual(new Set([17]));
      expect(heights.tier, JSON.stringify(heights)).toBe(23);
      // The mode tabs stay on one row while their labels fit.
      expect(heights.tabRows, JSON.stringify(heights)).toBe(1);
    }
  });
}
