import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "search-by-meaning");
});

test.describe("selected locale", () => {
  test.use({ locale: "en-US" });

  test("forwards the selected French locale in an English browser", async ({ page }) => {
    expect(await page.evaluate(() => navigator.language)).toBe("en-US");
    await page.getByRole("checkbox", { name: "French", exact: true }).check();
    await expect(
      page.getByTestId("meaning-indexing").locator(".kit-search-by-meaning__line"),
    ).toContainText("heures");
  });
});

test("shows setup states and keyword-only hint", async ({ page }) => {
  for (const [id, chip, text] of [
    [
      "ollama-other",
      "On · Ollama",
      "Switching rebuilds the index, about 20 minutes for 48,000 messages",
    ],
    ["downloading", "Turning on", "Downloading 120 MB of 290 MB · Keyword search works meanwhile"],
  ]) {
    const row = page.getByTestId(`meaning-${id}`);
    await expect(row.locator(".kit-chip")).toHaveText(chip!);
    await expect(row.getByText(text!, { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("meaning-hint").locator(".kit-search-by-meaning-hint")).toHaveText(
    "Search by meaning is off · Turn on",
  );
  for (const id of ["on", "downloading", "indexing"]) {
    await expect(page.getByTestId(`meaning-${id}`).getByRole("button")).toHaveCount(0);
  }
});

test("each action fires once per click", async ({ page }) => {
  for (const [id, turnOn, useBuiltIn] of [
    ["off", "1", "0"],
    ["ollama", "0", "1"],
    ["hint", "1", "0"],
  ]) {
    const row = page.getByTestId(`meaning-${id}`);
    const counter = row.getByTestId("clicks");
    await expect(counter).toHaveAttribute("data-turn-on", "0");
    await expect(counter).toHaveAttribute("data-use-built-in", "0");
    await row.getByRole("button").click();
    await expect(counter).toHaveAttribute("data-turn-on", turnOn!);
    await expect(counter).toHaveAttribute("data-use-built-in", useBuiltIn!);
  }
});

test("status only hides every action", async ({ page }) => {
  const toggle = page.getByTestId("meaning-readonly").getByRole("checkbox");
  await toggle.check();
  for (const id of ["off", "ollama"]) {
    const row = page.getByTestId(`meaning-${id}`);
    await expect(row.getByRole("button")).toHaveCount(0);
    await expect(row.locator(".kit-chip")).toBeVisible();
    await expect(row.locator(".kit-search-by-meaning__line")).toBeVisible();
    const edges = await row.evaluate((el) => ({
      chip: el.querySelector(".kit-chip")!.getBoundingClientRect().right,
      row: el.getBoundingClientRect().right,
    }));
    expect(edges.chip).toBeCloseTo(edges.row, 0);
  }
});

test("exposes progress values and text with status aligned to the bar", async ({ page }) => {
  for (const [id, current, max] of [
    ["downloading", "120000000", "290000000"],
    ["indexing", "12000", "48000"],
  ]) {
    const row = page.getByTestId(`meaning-${id}`);
    const progress = row.getByRole("progressbar", { name: "Search by meaning setup" });
    await expect(progress).toHaveAttribute("aria-valuenow", current!);
    await expect(progress).toHaveAttribute("aria-valuemax", max!);
    await expect(progress).toHaveAttribute(
      "aria-valuetext",
      (await row.locator(".kit-search-by-meaning__line").textContent())!,
    );
    const edges = await row.evaluate((el) => ({
      chip: el.querySelector(".kit-chip")!.getBoundingClientRect().right,
      bar: el.querySelector('[role="progressbar"]')!.getBoundingClientRect().right,
    }));
    expect(edges.chip).toBeCloseTo(edges.bar, 0);
  }
});

test("shows a spinner and no count until the total is known", async ({ page }) => {
  const row = page.getByTestId("meaning-scanning");
  await expect(row.getByRole("progressbar")).toHaveCount(0);
  await expect(row.getByRole("status", { name: "Search by meaning setup" })).toBeVisible();
});

test("wraps actions within the row at the mobile breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 844 });
  const row = page.getByTestId("meaning-ollama-other");
  await row.scrollIntoViewIfNeeded();
  const bounds = await row.evaluate((el) => {
    const name = el.querySelector(".kit-search-by-meaning__name")!.getBoundingClientRect();
    const button = el.querySelector("button")!.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    const description = el
      .querySelector(".kit-search-by-meaning__warning")!
      .getBoundingClientRect();
    return {
      descriptionBottom: description.bottom,
      buttonRight: button.right,
      hostRight: host.right,
      buttonTop: button.top,
      nameLeft: name.left,
      buttonLeft: button.left,
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    };
  });
  expect(bounds.buttonTop).toBeGreaterThan(bounds.descriptionBottom);
  expect(bounds.buttonLeft).toBeCloseTo(bounds.nameLeft, 0);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  expect(bounds.buttonRight).toBeLessThanOrEqual(bounds.hostRight);
});
