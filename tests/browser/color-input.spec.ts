import { expect, test } from "@playwright/test";
import { mixHexColors } from "../../src/lib/utils/color-contrast.js";
import { gotoPage } from "./helpers.js";

test("hex field commits valid colors and rejects others", async ({ page }) => {
  await gotoPage(page, "color-input");
  const group = page.getByRole("group", { name: "Accent color" });
  const hex = group.getByRole("textbox", { name: "Hex color" });
  const shown = page.getByTestId("color-input-value");

  await hex.fill("D55E00");
  await hex.press("Enter");
  await expect(shown).toHaveText("#d55e00");
  await expect(hex).toHaveValue("#d55e00");
  await expect(group.getByRole("button", { name: "Vermillion" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await hex.fill("not a color");
  await hex.press("Enter");
  await expect(hex).toHaveAttribute("aria-invalid", "true");
  await expect(shown).toHaveText("#d55e00");

  // Typing again clears the rejection until the next commit.
  await hex.fill("#0");
  await expect(hex).not.toHaveAttribute("aria-invalid");
});

test("swatches set the color and the picker reflects it", async ({ page }) => {
  await gotoPage(page, "color-input");
  const group = page.getByRole("group", { name: "Accent color" });
  await group.getByRole("button", { name: "Bluish green" }).click();
  await expect(page.getByTestId("color-input-value")).toHaveText("#009e73");
  await expect(group.getByLabel("Open color picker")).toHaveValue("#009e73");
  await expect(group.getByRole("button", { name: "Bluish green" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(group.getByRole("button", { name: "Blue", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("native picker input updates the value", async ({ page }) => {
  await gotoPage(page, "color-input");
  const group = page.getByRole("group", { name: "Accent color" });
  await group.getByLabel("Open color picker").fill("#cc79a7");
  await expect(page.getByTestId("color-input-value")).toHaveText("#cc79a7");
  await expect(group.getByRole("textbox", { name: "Hex color" })).toHaveValue("#cc79a7");
});

test("app-supplied invalid state and description reach both inputs", async ({ page }) => {
  await gotoPage(page, "color-input");
  const group = page.getByRole("group", { name: "Text color" });
  const hex = group.getByRole("textbox", { name: "Hex color" });
  // Yellow on white is far below 4.5:1.
  await expect(hex).toHaveAttribute("aria-invalid", "true");
  await expect(hex).toHaveAccessibleDescription(/too faint for text/);
  await expect(group.getByLabel("Open color picker")).toHaveAccessibleDescription(
    /too faint for text/,
  );

  await group.getByRole("button", { name: "Blue", exact: true }).click();
  await expect(hex).not.toHaveAttribute("aria-invalid");
  await expect(page.getByTestId("color-input-ink-hint")).not.toContainText("too faint");
});

test("mixHexColors matches the browser's color-mix in srgb", async ({ page }) => {
  await gotoPage(page, "color-input");
  const pairs: [string, string, number][] = [
    ["#0072b2", "#ffffff", 0.1],
    ["#e69f00", "#16161e", 0.14],
    ["#cc79a7", "#f5f6f8", 0.5],
  ];
  for (const [a, b, weight] of pairs) {
    const rendered = await page.evaluate(
      ({ a, b, percent }) => {
        const probe = document.createElement("div");
        probe.style.background = `color-mix(in srgb, ${a} ${percent}%, ${b})`;
        document.body.append(probe);
        // Canvas resolves the computed color to sRGB bytes on every engine.
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        context.fillStyle = getComputedStyle(probe).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        probe.remove();
        const [r, g, b2] = context.getImageData(0, 0, 1, 1).data;
        return `#${[r, g, b2].map((v) => v!.toString(16).padStart(2, "0")).join("")}`;
      },
      { a, b, percent: weight * 100 },
    );
    // Engines round exact halves either way, so allow one step per channel.
    const channels = (hex: string) =>
      [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
    const expected = channels(mixHexColors(a, b, weight));
    channels(rendered).forEach((value, index) => {
      expect(Math.abs(value - expected[index]!)).toBeLessThanOrEqual(1);
    });
  }
});
