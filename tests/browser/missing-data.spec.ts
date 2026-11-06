import { expect, test } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme } from "./helpers.js";

test("a missing-data state sits a fixed step below the page header", async ({ page }) => {
  await gotoPage(page, "missing-data");
  const frame = page.getByTestId("missing-data-pinned");
  const header = frame.locator(".kit-page-header");
  const state = frame.locator(".kit-missing-data");
  await expect(state.getByText("No pinned messages")).toBeVisible();

  const gap = await page.evaluate(
    ([h, s]) => {
      const title = s!.querySelector(".kit-missing-data__icon")!.getBoundingClientRect();
      return title.top - h!.getBoundingClientRect().bottom;
    },
    [await header.elementHandle(), await state.elementHandle()],
  );
  // 48px of padding above the icon, whatever the header's margin.
  expect(gap).toBeGreaterThanOrEqual(48);
  expect(gap).toBeLessThan(80);

  // The icon renders at 24px; it has no frame or fill.
  await expect(state.locator("svg")).toHaveCSS("width", "24px");
  await expect(state).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(state).toHaveCSS("border-top-style", "none");
});

for (const dark of [false, true]) {
  test(`missing-data text uses primary and muted ink · ${dark ? "dark" : "light"}`, async ({
    page,
  }) => {
    await gotoPage(page, "missing-data");
    await setTheme(page, { dark });
    const state = page.getByTestId("missing-data-pinned").locator(".kit-missing-data");
    await expect(state.locator(".kit-missing-data__title")).toHaveCSS(
      "color",
      await resolvedStyle(page, "color", "var(--text-primary)"),
    );
    await expect(state.locator(".kit-missing-data__description")).toHaveCSS(
      "color",
      await resolvedStyle(page, "color", "var(--text-muted)"),
    );
  });
}

test("a status state is announced and actions render below the text", async ({ page }) => {
  await gotoPage(page, "missing-data");
  await expect(page.getByRole("status").filter({ hasText: "No matches" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Build now" })).toBeVisible();
});
