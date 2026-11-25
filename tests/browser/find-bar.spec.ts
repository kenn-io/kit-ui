import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("incomplete results remain navigable until the count is final", async ({ page }) => {
  await gotoPage(page, "find-bar");
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Pinned (default)" }) });
  const bar = section.getByRole("search", { name: "Find" });
  const complete = section.getByRole("checkbox", { name: "Results complete" });
  const counter = bar.locator(".kit-find-bar__counter");
  const input = bar.getByRole("textbox", { name: "Search query" });
  const next = bar.getByRole("button", { name: "Next match" });
  const previous = bar.getByRole("button", { name: "Previous match" });

  await input.fill("read");
  await expect(counter).toHaveText("1 of 3");
  await complete.uncheck();
  await expect(counter).toHaveText("1 of 3+");
  await expect(bar).not.toHaveClass(/kit-find-bar--no-results/);
  await next.click();
  await expect(counter).toHaveText("2 of 3+");
  await expect(section.locator(".find-demo__line.current")).toHaveText(
    "Read docs/components/date-range-picker.md",
  );
  await input.fill("missing");
  await expect(counter).toHaveText("0 of 0+");
  await expect(bar).not.toHaveClass(/kit-find-bar--no-results/);
  await expect(next).toBeDisabled();
  await expect(previous).toBeDisabled();
  await complete.check();
  await expect(counter).toHaveText("No matches");
  await expect(bar).toHaveClass(/kit-find-bar--no-results/);
});
