import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "table");
});

const jobs = (page: import("@playwright/test").Page) =>
  page.getByRole("table", { name: "Review jobs" });

async function ids(page: import("@playwright/test").Page): Promise<string[]> {
  return jobs(page).locator("tbody tr td:first-child").allInnerTexts();
}

test("TableSort sorts on header clicks and reports aria-sort", async ({ page }) => {
  const cost = jobs(page).getByRole("columnheader", { name: "Cost" });
  await cost.getByRole("button").click();
  await expect(cost).toHaveAttribute("aria-sort", "descending");
  // The row without a cost stays last.
  expect(await ids(page)).toEqual(["#416", "#412", "#414", "#415", "#413"]);

  await cost.getByRole("button").click();
  await expect(cost).toHaveAttribute("aria-sort", "ascending");
  expect(await ids(page)).toEqual(["#415", "#414", "#412", "#416", "#413"]);
  await expect(jobs(page).getByRole("columnheader", { name: "ID" })).not.toHaveAttribute(
    "aria-sort",
  );
});

// A numeric header reverses its sort button, which once moved the button's
// baseline to the empty arrow slot and dropped the label below the row.
test("numeric and text header labels share a baseline", async ({ page }) => {
  const top = async (name: string) => {
    const header = jobs(page).getByRole("columnheader", { name });
    return header.getByRole("button").evaluate((button) => {
      const text = [...button.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== "",
      )!;
      const range = document.createRange();
      range.selectNodeContents(text);
      return range.getBoundingClientRect().bottom;
    });
  };
  const repo = await top("Repo");
  expect(Math.abs((await top("Cost")) - repo)).toBeLessThan(1);
  expect(Math.abs((await top("Elapsed")) - repo)).toBeLessThan(1);
});
