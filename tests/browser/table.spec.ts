import { expect, test } from "@playwright/test";
import { contrastBetween, gotoPage, luminanceOf, setTheme } from "./helpers.js";

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
      const label = button.querySelector(".kit-th__label")!;
      const text = [...label.childNodes].find(
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

test("a bare table renders only the table its rows describe", async ({ page }) => {
  const table = page.getByRole("table", { name: "Hosts by region" });
  await expect(table).toHaveClass(/\bregions\b/);
  expect(
    await table.evaluate((element) =>
      [...element.classList].filter((name) => name.startsWith("kit-")),
    ),
  ).toEqual([]);
  expect(
    await table.evaluate((element) =>
      element.parentElement?.classList.contains("kit-table-wrapper"),
    ),
  ).toBe(false);
  expect(await table.evaluate((element) => (element as HTMLTableElement).tBodies.length)).toBe(2);
  await expect(table.getByRole("rowheader", { name: "Frankfurt" })).toBeVisible();
});

// A neutral chip fills with the inset surface, so a stripe of that same color
// hid it. Stripes now tint toward the text color: lighter than the rows in a
// dark theme instead of sinking below them.
test("striped rows tint toward the text and keep neutral chips visible", async ({ page }) => {
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    const plain = await luminanceOf(jobs(page).getByRole("row", { name: /#412/ }));
    const striped = await luminanceOf(jobs(page).getByRole("row", { name: /#413/ }));
    const chip = await luminanceOf(jobs(page).getByText("queued", { exact: true }));

    const towardText = Math.sign(plain.text - plain.background);
    expect(Math.sign(striped.background - plain.background)).toBe(towardText);
    expect(contrastBetween(chip.background, striped.background)).toBeGreaterThan(1.05);
  }
});
