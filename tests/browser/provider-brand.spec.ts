import { expect, test, type Locator } from "@playwright/test";
import { gotoPage, setTheme } from "./helpers";

const actionSystemProperties = [
  "height",
  "borderRadius",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "columnGap",
  "paddingInlineStart",
  "paddingInlineEnd",
  "borderColor",
] as const;

async function actionSystemStyle(button: Locator): Promise<Record<string, string>> {
  return button.evaluate((element, properties) => {
    const style = getComputedStyle(element);
    return Object.fromEntries(properties.map((property) => [property, style[property]]));
  }, actionSystemProperties);
}

test("provider marks choose official, configured, and neutral sources", async ({ page }) => {
  await gotoPage(page, "provider-brand");

  const google = page.getByRole("img", { name: "Google" });
  await expect(google.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(google).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  const enterprise = page.getByRole("img", { name: "Enterprise SSO" });
  await expect(enterprise.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
  expect(
    await enterprise.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBe(20);

  await expect(page.getByRole("img", { name: "Neutral SSO" }).locator("svg")).toBeVisible();
  await expect(
    page.locator('[data-demo="decorative-provider-mark"] .kit-provider-brand-mark'),
  ).toHaveAttribute("aria-hidden", "true");
});

test("provider buttons keep a coherent Google surface in every state", async ({ page }) => {
  await gotoPage(page, "provider-brand");
  await setTheme(page, { dark: true });

  const enabled = page.getByRole("button", { name: "Continue with Google" });
  const disabled = page.getByRole("button", { name: "Unavailable Google" });
  await expect(enabled).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const restingColor = await enabled.evaluate((element) => getComputedStyle(element).color);
  await enabled.hover();
  await expect(enabled).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(enabled).toHaveCSS("color", restingColor);
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(disabled).toHaveCSS("opacity", "1");

  for (const button of [enabled, disabled]) {
    const mark = button.locator(".kit-provider-brand-mark");
    await expect(mark).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(mark).toHaveCSS("opacity", "1");
  }

  await enabled.click();
  await disabled.click({ force: true });
  await expect(page.locator('[data-demo="provider-activations"]')).toHaveText("1");
});

test("provider buttons use the large kit action geometry and type", async ({ page }) => {
  await gotoPage(page, "button");
  const systemStyle = await actionSystemStyle(
    page.getByRole("button", { name: "Large", exact: true }),
  );

  await gotoPage(page, "provider-brand");
  const provider = page.getByRole("button", { name: "Continue with Google" });
  await expect(provider).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect(await actionSystemStyle(provider)).toEqual(systemStyle);
});

test("configured image failure and public surface variables remain functional", async ({
  page,
}) => {
  await gotoPage(page, "provider-brand");

  const missing = page.getByRole("button", { name: "Continue with SSO" });
  await expect(missing.locator(".kit-provider-brand-mark svg")).toBeVisible();

  const custom = page.getByRole("button", { name: "Styled provider" });
  await expect(custom).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(custom).toHaveCSS("border-color", "rgb(8, 145, 178)");
  await expect(custom).toHaveCSS("color", "rgb(37, 99, 235)");

  const customDisabled = page.getByRole("button", { name: "Styled unavailable provider" });
  await expect(customDisabled).toHaveCSS("background-color", "rgb(245, 246, 248)");
  await expect(customDisabled).toHaveCSS("border-color", "rgb(228, 230, 236)");
  await expect(customDisabled).toHaveCSS("color", "rgb(135, 142, 160)");
});
