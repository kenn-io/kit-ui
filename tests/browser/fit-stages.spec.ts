import { expect, test } from "@playwright/test";
import { gotoPage, setSlider } from "./helpers.js";

// FitStages picks the richest stage that fits by probe measurement. The
// demo binds the active stage index and shows it in a readout.

test("stage transitions follow width and recover without oscillation", async ({ page }) => {
  await gotoPage(page, "fit-stages");

  const readout = page.locator(".control-note", { hasText: "stage:" }).first();
  const slider = page.locator('input[type="range"]').first();

  // Wide (880px default): richest stage.
  await expect(readout).toContainText("stage: 0");

  // Narrow: icons-only fallback.
  await setSlider(slider, 330);
  await expect(readout).toContainText("stage: 2");

  // Stages are monotonic in width: mid-width never shows a richer stage
  // than a wider pane nor a poorer one than a narrower pane.
  await setSlider(slider, 600);
  const midText = await readout.textContent();
  const mid = Number(midText?.match(/stage: (\d)/)?.[1]);
  expect(mid).toBeGreaterThanOrEqual(0);
  expect(mid).toBeLessThanOrEqual(2);

  // Back to wide: fully recovers stage 0 (probes are stable, no latch-stick).
  await setSlider(slider, 880);
  await expect(readout).toContainText("stage: 0");
});
