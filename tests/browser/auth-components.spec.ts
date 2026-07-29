import { expect, test } from "@playwright/test";
import { contrastOf, gotoPage, setTheme } from "./helpers";

test("FormField keeps validation and callbacks connected to its control", async ({ page }) => {
  await gotoPage(page, "form-field");

  const email = page.getByLabel("Work email");
  const control = email.locator("xpath=..");
  const error = page.getByText("Enter a complete email address.");
  const errorId = await error.getAttribute("id");

  expect(errorId).not.toBeNull();
  await expect(email).toHaveValue("name@");
  await expect(control).toHaveCSS("height", "44px");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", errorId!);

  await email.fill("person@example.com");
  await email.blur();

  await expect(page.getByTestId("auth-field-value")).toHaveText("person@example.com");
  await expect(page.getByTestId("auth-input-callbacks")).not.toHaveText("0");
  await expect(page.getByTestId("auth-blur-callbacks")).toHaveText("1");
  await expect(error).toHaveCount(0);
});

test("Notice exposes its severity and action", async ({ page }) => {
  await gotoPage(page, "notice");

  await expect(page.getByText("Warning", { exact: true })).toBeVisible();
  await expect(page.getByText("Session paused", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("auth-notice-callbacks")).toHaveText("1");
});

test("PageFrame preserves a custom brand's authored case in its mark", async ({ page }) => {
  await gotoPage(page, "page-frame");

  await expect(page.locator(".kit-page-frame__mark")).toHaveText("a");
  await expect(page.getByText("acme", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue to acme" })).toBeVisible();
});

test("keeps the PageFrame brand readable in every base theme", async ({ page }) => {
  await gotoPage(page, "page-frame");

  const brandName = page.locator(".kit-page-frame__brand-name");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    expect(await contrastOf(brandName)).toBeGreaterThanOrEqual(4.5);
  }
});

test("the theme pack preserves generated high-contrast colors", async ({ page }) => {
  await gotoPage(page, "page-frame");

  const root = page.locator("html");
  const brandName = page.locator(".kit-page-frame__brand-name");
  await root.evaluate((element) => element.setAttribute("data-kit-theme", "control-room"));

  for (const { dark, source, value, expected } of [
    {
      dark: false,
      source: "--kit-brand-hc-light-text-primary",
      value: "#123456",
      expected: "rgb(18, 52, 86)",
    },
    {
      dark: true,
      source: "--kit-brand-hc-dark-text-primary",
      value: "#fedcba",
      expected: "rgb(254, 220, 186)",
    },
  ]) {
    await setTheme(page, { dark, highContrast: true });
    await root.evaluate((element, token) => element.style.setProperty(token.source, token.value), {
      source,
      value,
    });
    await expect(brandName).toHaveCSS("color", expected);
  }
});

test("keeps notice actions readable in every base theme", async ({ page }) => {
  await gotoPage(page, "notice");

  const notice = page.locator(".kit-notice").first();
  const action = notice.getByRole("button", { name: "Try again" });

  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    for (const tone of ["info", "success", "warning", "error"]) {
      await notice.evaluate((element, value) => element.setAttribute("data-tone", value), tone);
      expect(await contrastOf(action)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("keeps a visible form-control outline in forced-colors mode", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await gotoPage(page, "form-field");

  const email = page.getByLabel("Work email");
  const wrapper = email.locator("xpath=..");
  await email.focus();
  const outline = await wrapper.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });

  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});
