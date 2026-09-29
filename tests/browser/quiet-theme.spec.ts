import { expect, test, type Page } from "@playwright/test";
import { contrastOf, gotoPage, setTheme } from "./helpers.js";

// The quiet theme drops uppercase label styling through the
// --label-transform token; the default Workbench pair must keep it.

async function useTheme(page: Page, name: string | null): Promise<void> {
  await page.evaluate((themeName) => {
    if (themeName) document.documentElement.dataset.kitTheme = themeName;
    else delete document.documentElement.dataset.kitTheme;
  }, name);
}

async function labelStyle(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { transform: style.textTransform, spacing: style.letterSpacing };
    });
}

test("default theme keeps uppercase chip and eyebrow labels", async ({ page }) => {
  await gotoPage(page, "chip");
  await useTheme(page, null);
  expect((await labelStyle(page, ".kit-chip:not(.kit-chip--plain-case)")).transform).toBe(
    "uppercase",
  );

  await gotoPage(page, "card");
  await useTheme(page, null);
  expect((await labelStyle(page, ".kit-card__eyebrow")).transform).toBe("uppercase");
});

test("quiet theme renders chip and eyebrow labels in sentence case", async ({ page }) => {
  await gotoPage(page, "chip");
  await useTheme(page, "quiet");
  expect(await labelStyle(page, ".kit-chip:not(.kit-chip--plain-case)")).toEqual({
    transform: "none",
    spacing: "normal",
  });

  await gotoPage(page, "card");
  await useTheme(page, "quiet");
  expect(await labelStyle(page, ".kit-card__eyebrow")).toEqual({
    transform: "none",
    spacing: "normal",
  });
});

for (const dark of [false, true]) {
  test(`quiet muted text clears AA on both surfaces (${dark ? "dark" : "light"})`, async ({
    page,
  }) => {
    await gotoPage(page, "chip");
    await useTheme(page, "quiet");
    await setTheme(page, { dark });
    for (const surface of ["--bg-surface", "--bg-primary"]) {
      const probe = await page.evaluate((background) => {
        document.querySelector("[data-quiet-muted-probe]")?.remove();
        const host = document.createElement("div");
        host.dataset.quietMutedProbe = "";
        host.style.background = `var(${background})`;
        host.style.position = "fixed";
        host.style.inset = "0 auto auto 0";
        const text = document.createElement("span");
        text.textContent = "Muted";
        text.style.color = "var(--text-muted)";
        host.append(text);
        document.body.append(host);
        return "[data-quiet-muted-probe] span";
      }, surface);
      expect(await contrastOf(page.locator(probe)), surface).toBeGreaterThanOrEqual(4.5);
    }
  });
}
