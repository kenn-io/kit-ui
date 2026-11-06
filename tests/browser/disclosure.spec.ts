import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.beforeEach(({ page }) => gotoPage(page, "disclosure"));

test("a card disclosure toggles from the mouse and the keyboard", async ({ page }) => {
  const seats = page.getByTestId("disclosure-card").locator("details").first();
  const summary = seats.locator("summary");
  const body = seats.getByText("Guests with read-only access");

  await expect(seats).not.toHaveAttribute("open");
  await expect(body).toBeHidden();
  await summary.click();
  await expect(seats).toHaveAttribute("open");
  await expect(body).toBeVisible();

  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(body).toBeHidden();
  await page.keyboard.press("Space");
  await expect(body).toBeVisible();
});

test("open starts expanded", async ({ page }) => {
  const plans = page.getByTestId("disclosure-card").locator("details").nth(1);
  await expect(plans).toHaveAttribute("open");
  await expect(plans.getByText("next billing period")).toBeVisible();
});

test("bound open stays in sync both ways and reports toggles", async ({ page }) => {
  const plain = page.getByTestId("disclosure-plain");
  const details = plain.locator("details");
  const openState = page.getByTestId("disclosure-open");

  await details.locator("summary").click();
  await expect(openState).toHaveText("true");
  await expect(page.getByTestId("disclosure-toggles")).toHaveText("1");

  await plain.getByRole("button", { name: "Toggle from outside" }).click();
  await expect(details).not.toHaveAttribute("open");
  await expect(openState).toHaveText("false");
  await expect(page.getByTestId("disclosure-toggles")).toHaveText("2");
});

test("a matching URL hash opens the disclosure", async ({ page }) => {
  const seats = page.locator("#disclosure-seats");
  await expect(seats).not.toHaveAttribute("open");
  await page.evaluate(() => (location.hash = "disclosure-seats"));
  await expect(seats).toHaveAttribute("open");
});

test("a direct link to a disclosure opens its gallery page and the disclosure", async ({
  page,
}) => {
  await page.goto("/#disclosure-seats");
  await expect(page.locator(".content__heading")).toHaveText("Disclosure");
  await expect(page.locator("#disclosure-seats")).toHaveAttribute("open");

  await page.reload();
  await expect(page.locator(".content__heading")).toHaveText("Disclosure");
  await expect(page.locator("#disclosure-seats")).toHaveAttribute("open");
});

test("Back to a disclosure anchor returns to its gallery page", async ({ page }) => {
  await page.evaluate(() => (location.hash = "disclosure-seats"));
  await page.evaluate(() => (location.hash = "notice"));
  await expect(page.locator(".content__heading")).toHaveText("Notice");
  await page.goBack();
  await expect(page.locator(".content__heading")).toHaveText("Disclosure");
  await expect(page.locator("#disclosure-seats")).toHaveAttribute("open");
});

test("an exclusive accordion keeps one item open", async ({ page }) => {
  const items = page.getByTestId("accordion-exclusive").locator(".kit-accordion > details");
  await expect(items).toHaveCount(3);

  await items.nth(0).locator("summary").click();
  await expect(items.nth(0)).toHaveAttribute("open");
  await items.nth(2).locator("summary").click();
  await expect(items.nth(2)).toHaveAttribute("open");
  await expect(items.nth(0)).not.toHaveAttribute("open");

  // Items share one generated group name.
  const names = await items.evaluateAll((els) => els.map((el) => el.getAttribute("name")));
  expect(new Set(names).size).toBe(1);
  expect(names[0]).toMatch(/^kit-accordion-/);
});

test("a disclosure nested in an accordion item leaves its parent open", async ({ page }) => {
  const accordion = page.getByTestId("accordion-exclusive");
  const security = accordion.locator("details").filter({ hasText: "Security" }).first();
  const advanced = security.locator("details");

  await security.locator("> summary").click();
  await advanced.locator("summary").click();
  await expect(advanced).toHaveAttribute("open");
  await expect(security).toHaveAttribute("open");
  await expect(advanced).not.toHaveAttribute("name");
});

test("accordion items share the frame and are divided by rules", async ({ page }) => {
  const items = page.getByTestId("accordion-exclusive").locator(".kit-accordion > details");
  await expect(items.nth(0)).toHaveCSS("border-top-width", "0px");
  await expect(items.nth(1)).not.toHaveCSS("border-top-width", "0px");
});

test("the summary has a visible keyboard focus ring", async ({ page }) => {
  const summary = page.getByTestId("disclosure-card").locator("summary").first();
  await summary.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(summary).toBeFocused();
  await expect(summary).not.toHaveCSS("outline-style", "none");
});

test("a card nested in a plain disclosure keeps its own card styles", async ({ page }) => {
  await page.evaluate(async () => {
    const { mountNestedDisclosure } =
      await import("/tests/browser/fixtures/mount-nested-disclosure.ts");
    mountNestedDisclosure();
  });
  const styles = (selector: string) =>
    page.locator(selector).evaluate((details) => {
      const summary = details.querySelector(":scope > summary")!;
      const content = details.querySelector(":scope > .kit-disclosure__content")!;
      return {
        summaryPadding: getComputedStyle(summary).padding,
        contentPadding: getComputedStyle(content).padding,
      };
    });
  expect(await styles(".fixture-inner")).toEqual(await styles(".fixture-reference"));
});
