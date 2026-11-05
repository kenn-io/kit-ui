import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "search-by-meaning");
});

test("shows setup states and keyword-only hint", async ({ page }) => {
  for (const [id, chip, text] of [
    ["off", "Off", "Downloads 290 MB once, shared by all Kenn apps"],
    ["remote", "Off", "Downloads 290 MB once to host.example"],
    ["downloaded", "Off", "Already on this computer"],
    ["ollama", "On · Ollama", "Switching keeps your index"],
    [
      "ollama-other",
      "On · Ollama",
      "Switching rebuilds the index, about 20 minutes for 48,000 messages",
    ],
    ["downloading", "Turning on", "Downloading 120 MB of 290 MB · Keyword search works meanwhile"],
    [
      "indexing",
      "Turning on",
      "Indexing 12,000 of 48,000 messages · about 15 minutes left · Keyword search works meanwhile",
    ],
  ]) {
    const row = page.getByTestId(`meaning-${id}`);
    await expect(row.locator(".kit-chip")).toHaveText(chip!);
    await expect(row.getByText(text!, { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("meaning-on").locator(".kit-chip")).toHaveText("On");
  await expect(page.getByTestId("meaning-hint").locator(".kit-search-by-meaning-hint")).toHaveText(
    "Search by meaning is off · Turn on",
  );
  for (const id of ["on", "downloading", "indexing"]) {
    await expect(page.getByTestId(`meaning-${id}`).getByRole("button")).toHaveCount(0);
  }
});

test("each action fires once per click", async ({ page }) => {
  for (const id of ["off", "remote", "downloaded", "ollama", "ollama-other", "hint"]) {
    const row = page.getByTestId(`meaning-${id}`);
    await expect(row.getByTestId("clicks")).toHaveText("Clicks: 0");
    await row.getByRole("button").click();
    await expect(row.getByTestId("clicks")).toHaveText("Clicks: 1");
    await row.getByRole("button").click();
    await expect(row.getByTestId("clicks")).toHaveText("Clicks: 2");
  }
});

test("exposes progress values and text", async ({ page }) => {
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
      nameBottom: name.bottom,
      buttonTop: button.top,
      nameLeft: name.left,
      buttonLeft: button.left,
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    };
  });
  expect(bounds.buttonTop).toBeGreaterThanOrEqual(bounds.nameBottom);
  expect(bounds.buttonTop).toBeGreaterThan(bounds.descriptionBottom);
  expect(bounds.buttonLeft).toBeCloseTo(bounds.nameLeft, 0);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  expect(bounds.buttonRight).toBeLessThanOrEqual(bounds.hostRight);
});
