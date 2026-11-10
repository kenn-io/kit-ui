import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// VirtualTable's "Expandable rows" demo (docs/components/virtual-table.md):
// measured heights kept by rowKey across inserts and appends, columns nobody
// resized refitting to a new table width without a rebuild, and
// `oncolumnresize` naming the column a person changed.

const filesTable = (page: Page) => page.locator('table[aria-label="Recently edited files"]');
const dataRows = (table: Locator) => table.locator("tbody > tr:not(.kit-virtual-table__spacer)");
const readout = (page: Page) => page.getByTestId("file-resize");
const columnWidths = (table: Locator) =>
  table
    .locator("thead th")
    .evaluateAll((cells) => cells.map((c) => Math.round(c.getBoundingClientRect().width)));

/** Scroll the page so the table's top sits `by` px above the scroller's top. */
async function scrollToTable(page: Page, by: number): Promise<void> {
  await filesTable(page).evaluate((el, offset) => {
    const scroller = document.querySelector(".content__body")!;
    scroller.scrollTop +=
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + offset;
  }, by);
}

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      ),
  );

/** Open the first four files, which are taller than the estimate once open,
 * then scroll them well above the rendered window. Returns the path of a
 * file row in the middle of the view and a reader for its top edge. */
async function openFilesAboveTheView(page: Page) {
  await gotoPage(page, "virtual-table");
  const table = filesTable(page);
  // Scroll anchoring off, so only the table's own math places the rows.
  await page.locator(".content__body").evaluate((el) => {
    (el as HTMLElement).style.overflowAnchor = "none";
  });
  await scrollToTable(page, 0);
  await expect(dataRows(table).first()).toContainText("file-0.ts");
  for (let k = 0; k < 4; k += 1) {
    await table
      .locator("button.file-path")
      .nth(k)
      .evaluate((b: HTMLElement) => b.click());
  }
  await expect(table.locator("tr.edits-row")).toHaveCount(4);
  await settle(page);
  // In steps shorter than the view, so every row above it is rendered and
  // measured once; a row never rendered would enter the window later at
  // its real height instead of the estimate and move the rows a little.
  for (let by = 300; by <= 2400; by += 300) {
    await scrollToTable(page, by);
    await settle(page);
  }
  // The open files are out of the window, so only their kept heights place
  // the rows below them.
  await expect
    .poll(() => dataRows(table).first().getAttribute("aria-rowindex"))
    .not.toMatch(/^([2-9]|1\d)$/);
  await settle(page);
  const path = await table.evaluate((el) => {
    const middle =
      document.querySelector(".content__body")!.getBoundingClientRect().top +
      window.innerHeight / 2;
    const row = [...el.querySelectorAll("tr.file-row")].find(
      (r) => r.getBoundingClientRect().top > middle,
    )!;
    return row.querySelector("button.file-path")!.textContent!;
  });
  const row = table.locator("tr.file-row", { has: page.getByRole("button", { name: path }) });
  const top = () => row.evaluate((tr) => tr.getBoundingClientRect().top);
  return { table, row, top };
}

test("opening a row keeps the rows on screen in place", async ({ page }) => {
  const { row, top } = await openFilesAboveTheView(page);
  const before = await top();
  await row.locator("button.file-path").evaluate((b: HTMLElement) => b.click());
  await expect(row).toHaveClass(/file-row--open/);
  await settle(page);
  expect(Math.abs((await top()) - before)).toBeLessThan(1);
});

test("loading more rows keeps the rows on screen in place", async ({ page }) => {
  const { top } = await openFilesAboveTheView(page);
  const before = await top();
  await page.getByRole("button", { name: "Load 100 more" }).evaluate((b: HTMLElement) => b.click());
  await expect(page.getByText("300 files")).toBeVisible();
  await settle(page);
  expect(Math.abs((await top()) - before)).toBeLessThan(1);
});

test("a row inserted above the view moves the rows on screen by its estimate only", async ({
  page,
}) => {
  const { top } = await openFilesAboveTheView(page);
  const before = await top();
  await page
    .getByRole("button", { name: "Add a file at the top" })
    .evaluate((b: HTMLElement) => b.click());
  await expect(page.getByText("201 files")).toBeVisible();
  await settle(page);
  // The new row is not rendered, so it counts at estimateRowHeight (33px);
  // every row measured before keeps its height.
  expect(Math.abs((await top()) - before - 33)).toBeLessThan(1);
});

test("columns nobody resized follow the table's width; a resized one keeps its own", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoPage(page, "virtual-table");
  const table = filesTable(page);
  await scrollToTable(page, 0);
  await expect(table).toHaveClass(/kit-virtual-table--pinned/);
  const firstRow = await dataRows(table).first().elementHandle();
  // Drag the File column down to its 120px minimum.
  const handle = table.getByRole("separator", { name: "Resize the File column" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 1000, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(readout(page)).toHaveText("Last resized: File column, 120px");
  expect((await columnWidths(table))[1]).toBe(120);

  const wrapperWidth = () => table.evaluate((el) => el.parentElement!.clientWidth);
  const project = async () => (await columnWidths(table))[0]!;
  const fits = () =>
    table.evaluate((el) => {
      const wrapper = el.parentElement!;
      return Math.abs(el.getBoundingClientRect().width - wrapper.clientWidth) <= 1;
    });
  const wideBox = await wrapperWidth();
  const wideProject = await project();
  // Narrower: the table refits to its box, and File stays at 120px.
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect.poll(wrapperWidth).toBeLessThan(wideBox - 100);
  await expect.poll(project).not.toBe(wideProject);
  await expect.poll(fits).toBe(true);
  expect((await columnWidths(table))[1]).toBe(120);
  const narrowProject = await project();
  // Wider again: the Project column, which nobody resized, takes a larger
  // share. Kept widths would leave it as it was, with only the last column
  // taking the new width.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(project).toBeGreaterThan(narrowProject + 20);
  await expect.poll(fits).toBe(true);
  expect((await columnWidths(table))[1]).toBe(120);
  // Refitting is not a person's choice, so nothing more is reported, and the
  // table was not rebuilt.
  await expect(readout(page)).toHaveAttribute("data-reports", "1");
  expect(
    await dataRows(table)
      .first()
      .evaluate((tr, kept) => tr === kept, firstRow),
  ).toBe(true);
});

test("a viewport resize keeps the rows, their scroll offsets, and a resized width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoPage(page, "virtual-table");
  const table = page.locator('table[aria-label="Reviews"]');
  await expect(dataRows(table).first()).toContainText("#0");
  // Widen Branch far past the box, so the table scrolls sideways.
  const handle = table.getByRole("separator", { name: "Resize the Branch column" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 800, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const branch = (await columnWidths(table))[3];
  await table.evaluate((el) => {
    const wrapper = el.parentElement!;
    wrapper.scrollLeft = 300;
    wrapper.scrollTop = 5000;
  });
  await settle(page);
  const scrolled = () =>
    table.evaluate((el) => ({
      left: el.parentElement!.scrollLeft,
      top: el.parentElement!.scrollTop,
    }));
  const before = await scrolled();
  const firstRow = await dataRows(table).first().elementHandle();
  const firstIndex = await dataRows(table).first().getAttribute("aria-rowindex");

  await page.setViewportSize({ width: 1100, height: 800 });
  await settle(page);
  await settle(page);
  expect(await scrolled()).toEqual(before);
  expect((await columnWidths(table))[3]).toBe(branch);
  expect(
    await dataRows(table)
      .first()
      .evaluate((tr, kept) => tr === kept, firstRow),
  ).toBe(true);
  await expect(dataRows(table).first()).toHaveAttribute("aria-rowindex", firstIndex!);
});

test("oncolumnresize names the column only when a person changes its width", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = filesTable(page);
  await scrollToTable(page, 0);
  await expect(table).toHaveClass(/kit-virtual-table--pinned/);
  const reports = () => readout(page).getAttribute("data-reports");

  // A click on a handle that does not move resizes nothing.
  await table.getByRole("separator", { name: "Resize the File column" }).click();
  await expect(readout(page)).toHaveText("");
  expect(await reports()).toBe("0");

  // Each arrow key that changes the width is reported, by column.
  const edits = table.getByRole("separator", { name: "Resize the Edits column" });
  await edits.focus();
  await page.keyboard.press("ArrowRight");
  await expect(readout(page)).toHaveText(/^Last resized: Edits column, \d+px$/);
  expect(await reports()).toBe("1");
  for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowLeft");
  await expect(readout(page)).toHaveText("Last resized: Edits column, 48px");
  // At the column's minimum another press changes nothing.
  const atMinimum = await reports();
  await page.keyboard.press("ArrowLeft");
  expect(await reports()).toBe(atMinimum);

  // A fit, by double-click or Enter, is reported once.
  await table.getByRole("separator", { name: "Resize the Project column" }).dblclick();
  await expect(readout(page)).toHaveText(/^Last resized: Project column, \d+px$/);
  expect(Number(await reports())).toBe(Number(atMinimum) + 1);
  await table.getByRole("separator", { name: "Resize the Last edit column" }).focus();
  await page.keyboard.press("Enter");
  await expect(readout(page)).toHaveText(/^Last resized: Last edit column, \d+px$/);
  expect(Number(await reports())).toBe(Number(atMinimum) + 2);
});

test("dragging a stretched last column back where it started keeps its width", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = filesTable(page);
  await scrollToTable(page, 0);
  await expect(table).toHaveClass(/kit-virtual-table--pinned/);
  const start = await columnWidths(table);

  // Narrowing the File column stretches the last column into the width it
  // gives up, past its 120px maxWidth.
  const file = table.getByRole("separator", { name: "Resize the File column" });
  await file.focus();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowLeft");
  await expect(readout(page)).toHaveAttribute("data-reports", "3");
  const stretched = await columnWidths(table);
  expect(stretched[3]).toBe(start[3]! + 72);
  expect(stretched[3]).toBeGreaterThan(120);

  // A drag out and back to where it started changes nothing.
  const box = (await table
    .getByRole("separator", { name: "Resize the Last edit column" })
    .boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, y, { steps: 5 });
  await page.mouse.move(box.x + box.width / 2, y, { steps: 5 });
  await page.mouse.up();
  expect(await columnWidths(table)).toEqual(stretched);
  await expect(readout(page)).toHaveAttribute("data-reports", "3");

  // The last column kept its own width, so widening the File column again
  // takes the stretch back instead of pushing the table past its box.
  await file.focus();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
  await expect.poll(() => columnWidths(table)).toEqual(start);
});
