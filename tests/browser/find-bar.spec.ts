import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("incomplete counts", async ({ page }) => {
  await gotoPage(page, "find-bar");
  await page.evaluate(async () => {
    const [{ mount }, { default: FindBar }] = await Promise.all([
      import("/node_modules/.vite/deps/svelte.js"),
      import("/src/lib/components/FindBar.svelte"),
    ]);
    mount(FindBar, {
      target: document.body,
      props: {
        ariaLabel: "Custom find",
        query: "read",
        matchCount: 3,
        currentIndex: 0,
        resultsComplete: false,
        matchCountLabel: "Match {current}",
      },
    });
    for (const [ariaLabel, matchCount, resultsComplete] of [
      ["Partial find", 3, false],
      ["Partial empty find", 0, false],
      ["Complete empty find", 0, true],
    ] as const) {
      mount(FindBar, {
        target: document.body,
        props: { ariaLabel, query: "read", matchCount, currentIndex: 0, resultsComplete },
      });
    }
  });
  const counter = page
    .getByRole("search", { name: "Custom find" })
    .locator(".kit-find-bar__counter");
  await expect(counter).toHaveText("Match 1 (3+)");
  const partial = page.getByRole("search", { name: "Partial find" });
  await expect(partial.locator(".kit-find-bar__counter")).toHaveText("1 of 3+");
  await expect(partial.locator("[aria-live]")).toHaveText("1 of 3+ so far");
  const partialEmpty = page.getByRole("search", { name: "Partial empty find" });
  await expect(partialEmpty.locator(".kit-find-bar__counter")).toHaveText("0 of 0+");
  await expect(partialEmpty).not.toHaveClass(/kit-find-bar--no-results/);
  const completeEmpty = page.getByRole("search", { name: "Complete empty find" });
  await expect(completeEmpty.locator(".kit-find-bar__counter")).toHaveText("No matches");
  await expect(completeEmpty).toHaveClass(/kit-find-bar--no-results/);
});

test("demo passes results completeness to FindBar", async ({ page }) => {
  await gotoPage(page, "find-bar");
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Pinned (default)" }) });
  const bar = section.getByRole("search", { name: "Find" });
  const complete = section.getByRole("checkbox", { name: "Results complete" });
  const counter = bar.locator(".kit-find-bar__counter");
  const input = bar.getByRole("textbox", { name: "Search query" });

  await input.fill("read");
  await expect(counter).toHaveText("1 of 3");
  await complete.uncheck();
  await expect(counter).toHaveText("1 of 3+");
  await complete.check();
  await expect(counter).toHaveText("1 of 3");
});
