import { expect, test } from "@playwright/test";
import { gotoPage, setSlider, setTheme } from "./helpers";

const GALLERY = '[data-demo="harness-icon-gallery"]';

test("every registered harness renders a glyph", async ({ page }) => {
  await gotoPage(page, "harness-icon");
  const gallery = page.locator(GALLERY);

  await expect(gallery.locator(".kit-harness-icon")).toHaveCount(49);
  await expect(gallery.locator(".kit-harness-icon > svg")).toHaveCount(49);

  await expect(gallery.getByRole("img", { name: "Claude" })).toBeVisible();
  await expect(gallery.getByRole("img", { name: "OpenAI" })).toBeVisible();
  await expect(gallery.getByRole("img", { name: "Forge" })).toBeVisible();
});

test("glyphs follow the current text colour in both themes", async ({ page }) => {
  await gotoPage(page, "harness-icon");
  const openai = page.locator(`${GALLERY} .kit-harness-icon--openai`);

  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    const { fill, color } = await openai.evaluate((el) => ({
      fill: getComputedStyle(el.querySelector("path")!).fill,
      color: getComputedStyle(el).color,
    }));
    expect(fill).toBe(color);
  }
});

test("size sets a square box", async ({ page }) => {
  await gotoPage(page, "harness-icon");
  const claude = page.locator('[data-demo="harness-icon-sized"] .kit-harness-icon--claude');
  const hermes = page.locator('[data-demo="harness-icon-sized"] .kit-harness-icon--hermes');

  await setSlider(page.locator('[data-demo="harness-icon-size"]'), 32);

  for (const icon of [claude, hermes]) {
    const box = (await icon.boundingBox())!;
    expect(Math.round(box.height)).toBe(32);
    expect(Math.round(box.width)).toBe(32);
  }
});

test("decorative icons are hidden from assistive tech", async ({ page }) => {
  await gotoPage(page, "harness-icon");
  const inline = page.locator('[data-demo="harness-icon-inline"] .kit-harness-icon');

  await expect(inline).toHaveCount(2);
  for (const icon of await inline.all()) {
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).not.toHaveAttribute("role", "img");
  }
});
