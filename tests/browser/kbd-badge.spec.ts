import { expect, test } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers.js";

test("a chord has a separate cap for each key and one accessible name", async ({ page }) => {
  await gotoPage(page, "kbd-badge");
  await setTheme(page, { dark: true });
  const chord = page.locator('.kit-kbd-badge[data-joiner="keys"][aria-label="Ctrl Shift P"]');
  await expect(chord).toHaveAccessibleName("Ctrl Shift P");
  const caps = chord.locator(".kit-kbd-badge__key");
  await expect(caps).toHaveCount(3);
  await expect(caps).toHaveText(["Ctrl", "⇧", "P"]);
  for (const cap of await caps.all()) {
    await expect(cap).toBeVisible();
  }
  const bounds = await caps.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    }),
  );
  expect(bounds[1]!.left - bounds[0]!.right).toBeCloseTo(4, 1);
  expect(bounds[2]!.left - bounds[1]!.right).toBeCloseTo(4, 1);
});
