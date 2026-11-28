import { expect, test } from "@playwright/test";
import { contrastOf, gotoPage, setTheme } from "./helpers.js";

test.describe("Avatar", () => {
  test("shows initials named by the person", async ({ page }) => {
    await gotoPage(page, "avatar");
    const row = page.getByTestId("avatar-initials");
    await expect(row.getByRole("img", { name: "Ada Lovelace" })).toHaveText("AL");
    await expect(row.getByRole("img", { name: "jane.doe@example.com" })).toHaveText("JD");
  });

  test("falls back to initials when the picture is missing or broken", async ({ page }) => {
    await gotoPage(page, "avatar");
    const row = page.getByTestId("avatar-picture");
    await expect(row.getByRole("img", { name: "Ada Lovelace" }).locator("img")).toBeVisible();
    const broken = row.getByRole("img", { name: "Grace Hopper" });
    await expect(broken.locator("img")).toHaveCount(0);
    await expect(broken).toHaveText("GH");
    await expect(row.getByRole("img", { name: "Alan Turing" })).toHaveText("AT");
  });

  test("keeps a key's color and sizes the box in pixels", async ({ page }) => {
    await gotoPage(page, "avatar");
    const sizes = page.getByTestId("avatar-sizes").locator(".kit-avatar");
    const boxes = await sizes.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return [rect.width, rect.height, getComputedStyle(node).backgroundColor];
      }),
    );
    expect(boxes.map(([width, height]) => [width, height])).toEqual([
      [16, 16],
      [20, 20],
      [24, 24],
      [32, 32],
      [40, 40],
    ]);
    expect(new Set(boxes.map(([, , background]) => background)).size).toBe(1);
  });

  test("decorative avatars stay out of the accessibility tree", async ({ page }) => {
    await gotoPage(page, "avatar");
    const list = page.getByTestId("avatar-list");
    await expect(list.getByRole("img")).toHaveCount(0);
    await expect(list.locator(".kit-avatar").first()).toHaveAttribute("aria-hidden", "true");
  });

  for (const dark of [false, true]) {
    test(`initials meet AA contrast in ${dark ? "dark" : "light"}`, async ({ page }) => {
      await gotoPage(page, "avatar");
      await setTheme(page, { dark });
      const avatars = page.getByTestId("avatar-initials").locator(".kit-avatar__initials");
      const count = await avatars.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect.poll(() => contrastOf(avatars.nth(i))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
