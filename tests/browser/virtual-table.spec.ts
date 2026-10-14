import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// VirtualTable (docs/components/virtual-table.md): only on-screen rows are in
// the DOM, whichever container scrolls the table, while stripes, column
// widths, and row numbering match a full table.

const bounded = (page: Page) => page.locator('table[aria-label="Reviews"]');
const inFlow = (page: Page) => page.locator('table[aria-label="Reviews on the page"]');
const dataRows = (table: Locator) => table.locator("tbody > tr:not(.kit-virtual-table__spacer)");

async function scrollWrapper(table: Locator, to: "middle" | "bottom"): Promise<void> {
  await table.evaluate((el, where) => {
    const wrapper = el.parentElement!;
    wrapper.scrollTop =
      where === "bottom" ? wrapper.scrollHeight : (wrapper.scrollHeight - wrapper.clientHeight) / 2;
  }, to);
}

test("renders a window of 10k rows and reaches the last one", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  const rendered = await dataRows(table).count();
  expect(rendered).toBeGreaterThan(5);
  expect(rendered).toBeLessThan(60);
  await expect(table).toHaveAttribute("aria-rowcount", "10001");

  await scrollWrapper(table, "bottom");
  const last = dataRows(table).last();
  await expect(last).toContainText("#9999");
  await expect(last).toHaveAttribute("aria-rowindex", "10001");
  // The last row sits at the bottom of the scrolled wrapper, not past it.
  const gap = await last.evaluate((row) => {
    const wrapper = row.closest(".kit-table-wrapper")!;
    return wrapper.getBoundingClientRect().bottom - row.getBoundingClientRect().bottom;
  });
  expect(Math.abs(gap)).toBeLessThan(2);
});

test("stripes rows by their index and keeps column widths while scrolling", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  const widths = () =>
    table
      .locator("thead th")
      .evaluateAll((cells) => cells.map((c) => c.getBoundingClientRect().width));
  const before = await widths();

  const stripes = () =>
    dataRows(table).evaluateAll((rows) =>
      rows.map((row) => ({
        index: Number(row.getAttribute("aria-rowindex")) - 2,
        background: getComputedStyle(row).backgroundColor,
      })),
    );
  const top = await stripes();
  const plain = top.find((r) => r.index % 2 === 0)!.background;
  const striped = top.find((r) => r.index % 2 === 1)!.background;
  expect(striped).not.toBe(plain);

  // Windows starting on odd and even indexes stripe the same rows.
  for (const step of [1, 2]) {
    await table.evaluate((el, by) => (el.parentElement!.scrollTop += 37 * by * 101), step);
    await page.mouse.move(0, 0);
    await expect
      .poll(async () =>
        (await stripes()).every((r) => r.background === (r.index % 2 ? striped : plain)),
      )
      .toBe(true);
  }

  await scrollWrapper(table, "middle");
  await expect.poll(widths).toEqual(before);
});

test("keeps links in rows and re-windows after sorting", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first().getByRole("link")).toBeVisible();
  await table.getByRole("button", { name: "ID" }).click();
  await expect(dataRows(table).first()).toContainText("#9999");
  await expect(dataRows(table).first()).toHaveAttribute("aria-rowindex", "2");
});

test("follows the page's scroll container when the table is unbounded", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  // Bring the table's middle on screen by scrolling whatever scrolls it.
  await table.evaluate((el) => {
    const middle = el.querySelector("tbody")!;
    const rect = middle.getBoundingClientRect();
    let scroller: Element | null = el.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight)
      scroller = scroller.parentElement;
    scroller!.scrollTop += rect.top + rect.height / 2;
  });
  await expect
    .poll(() =>
      dataRows(table).evaluateAll((rows) => {
        const indexes = rows.map((r) => Number(r.getAttribute("aria-rowindex")) - 2);
        const visible = rows.some((r) => {
          const box = r.getBoundingClientRect();
          return box.bottom > 0 && box.top < window.innerHeight;
        });
        return { first: indexes[0]! > 500, few: rows.length < 80, visible };
      }),
    )
    .toEqual({ first: true, few: true, visible: true });
});

test("lays out a table that was hidden when it rendered", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  await page.getByText("Show 2,000 reviews").click();
  const table = page.locator('table[aria-label="Hidden reviews"]');
  await expect(dataRows(table).first()).toBeVisible();
  const widths = await table
    .locator("thead th")
    .evaluateAll((cells) => cells.map((c) => c.getBoundingClientRect().width));
  for (const width of widths) expect(width).toBeGreaterThan(40);
  const rendered = await dataRows(table).count();
  expect(rendered).toBeGreaterThan(5);
  expect(rendered).toBeLessThan(80);
});
