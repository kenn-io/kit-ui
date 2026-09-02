import { expect, test } from "@playwright/test";
import { gotoPage, setSlider, setTheme } from "./helpers";

const GALLERY = '[data-demo="harness-gallery"]';

test("every registered harness renders a mark", async ({ page }) => {
  await gotoPage(page, "harness-mark");
  const gallery = page.locator(GALLERY);

  await expect(gallery.locator(".kit-harness-mark")).toHaveCount(20);
  await expect(gallery.locator(".kit-harness-mark > svg")).toHaveCount(6);
  await expect(gallery.locator(".kit-harness-mark > img")).toHaveCount(1);
  await expect(gallery.locator(".kit-harness-mark__text")).toHaveCount(13);

  await expect(gallery.getByRole("img", { name: "Claude Code" })).toBeVisible();
  await expect(gallery.getByRole("img", { name: "Forge" }).locator("img")).toHaveAttribute(
    "src",
    /^data:image\/png/,
  );
  await expect(gallery.getByRole("img", { name: "Hermes" })).toHaveText("Hermes");
});

test("vector marks follow the current text colour in both themes", async ({ page }) => {
  await gotoPage(page, "harness-mark");
  const codex = page.locator(`${GALLERY} .kit-harness-mark--codex`);

  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    const { fill, color } = await codex.evaluate((el) => ({
      fill: getComputedStyle(el.querySelector("path")!).fill,
      color: getComputedStyle(el).color,
    }));
    expect(fill).toBe(color);
  }
});

test("size sets the height and width follows the artwork", async ({ page }) => {
  await gotoPage(page, "harness-mark");
  const codex = page.locator('[data-demo="harness-sized"] .kit-harness-mark--codex');
  const hermes = page.locator('[data-demo="harness-sized"] .kit-harness-mark--hermes');

  await setSlider(page.locator('[data-demo="harness-size"]'), 32);

  for (const mark of [codex, hermes]) {
    const box = (await mark.boundingBox())!;
    expect(Math.round(box.height)).toBe(32);
    expect(box.width).toBeGreaterThan(box.height);
  }
});

test("mono flattens brand colours to currentColor", async ({ page }) => {
  await gotoPage(page, "harness-mark");
  const claude = page.locator('[data-demo="harness-sized"] .kit-harness-mark--claude-code');
  const hermes = page.locator('[data-demo="harness-sized"] .kit-harness-mark--hermes');

  const asteriskFill = (mark: typeof claude) =>
    mark.evaluate((el) => getComputedStyle(el.querySelector("path")!).fill);
  const textColor = (mark: typeof hermes) =>
    mark.evaluate((el) => getComputedStyle(el.querySelector("span")!).color);
  const rootColor = (mark: typeof claude) => mark.evaluate((el) => getComputedStyle(el).color);

  expect(await asteriskFill(claude)).not.toBe(await rootColor(claude));
  expect(await textColor(hermes)).not.toBe(await rootColor(hermes));

  await page.locator('[data-demo="harness-mono"] input').check();

  expect(await asteriskFill(claude)).toBe(await rootColor(claude));
  expect(await textColor(hermes)).toBe(await rootColor(hermes));
});

test("decorative marks are hidden from assistive tech", async ({ page }) => {
  await gotoPage(page, "harness-mark");
  const inline = page.locator('[data-demo="harness-inline"] .kit-harness-mark');

  await expect(inline).toHaveCount(2);
  for (const mark of await inline.all()) {
    await expect(mark).toHaveAttribute("aria-hidden", "true");
    await expect(mark).not.toHaveAttribute("role", "img");
  }
});
