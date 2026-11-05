import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("a chord has a separate cap for each key", async ({ page }) => {
  await gotoPage(page, "kbd-badge");
  const chord = page.locator(".demo-section").first().locator('[data-joiner="keys"]').nth(1);
  const caps = chord.locator(".kit-kbd-badge__key");
  await expect(caps).toHaveCount(3);
  const bounds = await caps.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    }),
  );
  expect(bounds[1]!.left - bounds[0]!.right).toBeCloseTo(4, 1);
  expect(bounds[2]!.left - bounds[1]!.right).toBeCloseTo(4, 1);
});

test("glyphs have readable names once in every badge format", async ({ page }) => {
  await gotoPage(page, "kbd-badge");
  const badges = page
    .locator(".demo-section")
    .filter({ has: page.getByRole("heading", { name: "Key glyphs", exact: true }) })
    .locator(".kit-kbd-badge");
  await expect(badges).toHaveCount(3);
  for (const badge of await badges.all()) {
    await expect(badge).toHaveAccessibleName(
      "Command Option Control Shift Enter Arrow up Arrow down Arrow left Arrow right",
    );
    await expect(badge).toMatchAriaSnapshot(
      `- text: Command Option Control Shift Enter Arrow up Arrow down Arrow left Arrow right`,
    );
  }
  const custom = page.locator('.kit-kbd-badge[aria-label="g then i"]');
  await expect(custom).toHaveAccessibleName("g then i");
  await expect(custom).toMatchAriaSnapshot(`- text: g then i`);
});

test("symbol caps center their cap-height glyphs", async ({ page }) => {
  await gotoPage(page, "kbd-badge");
  const caps = page.locator(".demo-section").nth(1).locator(".kit-kbd-badge__key");
  const bounds = await caps.evaluateAll((elements) =>
    elements.map((element) => {
      const cap = element.getBoundingClientRect();
      const symbol = element.querySelector("svg")!.getBoundingClientRect();
      const probe = document.createElement("span");
      probe.style.height = "1cap";
      probe.style.display = "inline-block";
      element.append(probe);
      const capHeight = probe.getBoundingClientRect().height;
      probe.remove();
      return {
        height: symbol.height,
        capHeight,
        offset: symbol.y + symbol.height / 2 - (cap.y + cap.height / 2),
      };
    }),
  );
  expect(bounds).toHaveLength(9);
  for (const bound of bounds) {
    expect(bound.height).toBeCloseTo(bound.capHeight, 1);
    expect(bound.offset).toBeCloseTo(0, 1);
  }
});
