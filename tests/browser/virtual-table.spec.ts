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

test("a table the page scrolls keeps its header at the top of the page", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  // The page-scrolled wrapper must not become the header's scroll container.
  await expect(table.locator("xpath=..")).toHaveCSS("overflow-y", "clip");
  const scroller = await table.evaluateHandle((el) => {
    let s: Element | null = el.parentElement;
    while (s && s.scrollHeight <= s.clientHeight) s = s.parentElement;
    return s!;
  });
  await scroller.evaluate(
    (s, el) => {
      s.scrollTop += el!.getBoundingClientRect().top - s.getBoundingClientRect().top + 3000;
    },
    await table.elementHandle(),
  );
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const head = el.tHead!.getBoundingClientRect();
        let s: Element | null = el.parentElement;
        while (s && s.scrollHeight <= s.clientHeight) s = s.parentElement;
        return {
          atTop: Math.abs(head.top - s!.getBoundingClientRect().top) < 2,
          shadowed: el.classList.contains("kit-table--scrolled"),
        };
      }),
    )
    .toEqual({ atTop: true, shadowed: true });
});

test("an unbroken value outside the first rows wraps inside its pinned column", async ({
  page,
}) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  // Row heights vary, so step toward row 6000 until it renders.
  for (let step = 0; step < 8; step += 1) {
    const first = Number(await dataRows(table).first().getAttribute("aria-rowindex")) - 2;
    const last = Number(await dataRows(table).last().getAttribute("aria-rowindex")) - 2;
    if (first <= 6000 && 6000 < last) break;
    await table.evaluate((el, delta) => {
      const wrapper = el.parentElement!;
      wrapper.scrollTop += (delta * wrapper.scrollHeight) / 10000;
    }, 6000 - first);
    await page.waitForTimeout(50);
  }
  const cell = table.locator("td.branch", { hasText: "fix/anunbrokenname" });
  await expect(cell).toBeVisible();
  const box = await cell.evaluate((td) => ({
    overflow: td.scrollWidth - td.clientWidth,
    width: td.getBoundingClientRect().width,
  }));
  expect(box.overflow).toBeLessThanOrEqual(0);
});

// The page scroller in the gallery sets --kit-table-sticky-top: -20px for its
// padding; a table scrolling in its own box must not use it.
test("a table that scrolls in its own box sticks its header to the box's top", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  await scrollWrapper(table, "middle");
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const wrapper = el.parentElement!;
        return Math.round(
          el.tHead!.getBoundingClientRect().top -
            (wrapper.getBoundingClientRect().top + wrapper.clientTop),
        );
      }),
    )
    .toBe(0);
});

// The page-scrolled table clips without scrolling, so in a flex row only
// min-width: 0 stops it growing to the table's width.
test("a wide table in a flex row scrolls sideways instead of widening its box", async ({
  page,
}) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  // Columns re-pin to fit a narrower box and text wraps, so only a table
  // that cannot shrink below the box (here a minimum width) overflows it.
  await table.evaluate((el) => {
    el.style.minWidth = "800px";
    const flow = el.closest(".flow") as HTMLElement;
    flow.style.display = "flex";
    flow.style.width = "260px";
  });
  // A clipping box also reports scrollWidth > clientWidth, but it cannot be
  // scrolled, so only a real scroll shows the hidden columns are reachable.
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const wrapper = el.parentElement!;
        wrapper.scrollLeft = 100;
        return {
          fits: wrapper.getBoundingClientRect().width <= 262,
          scrolled: wrapper.scrollLeft > 0,
        };
      }),
    )
    .toEqual({ fits: true, scrolled: true });
});

test("pinned widths do not add padding again when the app uses content-box sizing", async ({
  page,
}) => {
  // The app's content-box rule is in place before the columns are sized.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = ".kit-table th, .kit-table td { box-sizing: content-box; }";
      document.head.append(style);
    });
  });
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  // Each header cell is drawn at its pinned width, padding included, so the
  // table fills its box exactly.
  await expect
    .poll(() =>
      table.evaluate((el) => ({
        drawnAsPinned: [...el.tHead!.rows[0]!.cells].every(
          (c) => Math.abs(c.getBoundingClientRect().width - parseFloat(c.style.width)) < 1,
        ),
        overflow: el.offsetWidth - el.parentElement!.clientWidth,
      })),
    )
    .toEqual({ drawnAsPinned: true, overflow: 0 });
});

test("rows fill space revealed when a scroller above the table grows", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  const scroller = page.locator(".content__body");
  // Shrink the scroller, scroll into the table, then let it grow back with
  // no change to the table or the window.
  await scroller.evaluate((s) => ((s as HTMLElement).style.maxHeight = "200px"));
  await scroller.evaluate(
    (s, el) => {
      s.scrollTop += el!.getBoundingClientRect().top - s.getBoundingClientRect().top + 5000;
    },
    await table.elementHandle(),
  );
  await page.waitForTimeout(100);
  await scroller.evaluate((s) => ((s as HTMLElement).style.maxHeight = ""));
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const s = document.querySelector(".content__body")!.getBoundingClientRect();
        const rows = el.querySelectorAll("tbody > tr:not(.kit-virtual-table__spacer)");
        const last = rows[rows.length - 1]!.getBoundingClientRect().bottom;
        return last >= Math.min(s.bottom, el.getBoundingClientRect().bottom) - 1;
      }),
    )
    .toBe(true);
});

test("hiding a column re-pins the widths without a phantom column", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  await page.getByRole("checkbox", { name: "Show the Branch column" }).uncheck();
  await expect(table.locator("thead th")).toHaveCount(4);
  await expect
    .poll(() =>
      table.evaluate((el) => ({
        spacerColspan: el.querySelector<HTMLTableCellElement>(".kit-virtual-table__spacer td")!
          .colSpan,
        fills:
          Math.abs(
            [...el.tHead!.rows[0]!.cells].reduce(
              (sum, c) => sum + c.getBoundingClientRect().width,
              0,
            ) - el.getBoundingClientRect().width,
          ) < 2,
      })),
    )
    .toEqual({ spacerColspan: 4, fills: true });
});

// Content above the table collapsing neither scrolls nor resizes the
// scroller, so the app calls refresh(), as the demo's button does. Scroll
// anchoring would hide the move, so it is off here.
test("refresh() fills the view after content above the table collapses", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  const scroller = page.locator(".content__body");
  // Put a tall block before the table and scroll until only the table's
  // first 100px show, then remove the block without scrolling.
  await table.evaluate((el) => {
    (document.querySelector(".content__body") as HTMLElement).style.overflowAnchor = "none";
    const block = document.createElement("div");
    block.id = "collapsible";
    block.style.height = "600px";
    el.closest(".flow")!.before(block);
  });
  await scroller.evaluate(
    (s, el) => {
      const bottom = s.getBoundingClientRect().bottom;
      s.scrollTop += el!.getBoundingClientRect().top - (bottom - 100);
    },
    await table.elementHandle(),
  );
  await page.waitForTimeout(100);
  await page.locator("#collapsible").evaluate((block) => block.remove());
  await page.getByRole("button", { name: "Refresh the table" }).click();
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const s = document.querySelector(".content__body")!.getBoundingClientRect();
        const rows = el.querySelectorAll("tbody > tr:not(.kit-virtual-table__spacer)");
        const last = rows[rows.length - 1]!.getBoundingClientRect().bottom;
        return last >= Math.min(s.bottom, el.getBoundingClientRect().bottom) - 1;
      }),
    )
    .toBe(true);
});

test("a populated table below the fold never shows its empty row", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = page.locator('table[aria-label="Reviews without overscan"]');
  await expect(table).toHaveAttribute("aria-rowcount", "301");
  await expect(table.getByText("No reviews")).toHaveCount(0);
  await table.evaluate((el) => {
    const s = document.querySelector(".content__body")!;
    s.scrollTop += el.getBoundingClientRect().top - s.getBoundingClientRect().top;
  });
  await expect(dataRows(table).first()).toContainText("#0");
  await expect(table.getByText("No reviews")).toHaveCount(0);
  // Data rows give the ID column only its numbers' width; headers alone
  // would split the width between the two short labels.
  const id = await table
    .locator("thead th")
    .first()
    .evaluate((th) => th.getBoundingClientRect().width);
  expect(id).toBeLessThan(150);
});

test("a resize while no rows render does not pin widths from the header", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = page.locator('table[aria-label="Reviews without overscan"]');
  await expect(table).toHaveAttribute("aria-rowcount", "301");
  const scroller = page.locator(".content__body");
  const toTable = async () =>
    scroller.evaluate(
      (s, el) => {
        s.scrollTop += el!.getBoundingClientRect().top - s.getBoundingClientRect().top;
      },
      await table.elementHandle(),
    );
  await toTable();
  await expect(dataRows(table).first()).toContainText("#0");
  // Scroll far above the table so its rows unmount, then resize.
  await scroller.evaluate((s) => (s.scrollTop = 0));
  await expect(dataRows(table)).toHaveCount(0);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(200);
  await toTable();
  await expect(dataRows(table).first()).toContainText("#0");
  // Data rows give the ID column only its numbers' width; headers alone
  // would split the width between the two short labels.
  const id = await table
    .locator("thead th")
    .first()
    .evaluate((th) => th.getBoundingClientRect().width);
  expect(id).toBeLessThan(150);
});

test("a visible row growing deep in the table does not move the rows above it", async ({
  page,
}) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  // Jump deep so thousands of rows above are unmeasured, with anchoring off.
  await table.evaluate((el) => {
    const wrapper = el.parentElement!;
    wrapper.style.overflowAnchor = "none";
    wrapper.scrollTop = wrapper.scrollHeight / 2;
  });
  await page.waitForTimeout(200);
  const topIndex = () =>
    table.evaluate((el) => {
      const top = el.parentElement!.getBoundingClientRect().top + el.tHead!.offsetHeight;
      const row = [...el.querySelectorAll("tbody > tr:not(.kit-virtual-table__spacer)")].find(
        (r) => r.getBoundingClientRect().bottom > top,
      )!;
      return Number(row.getAttribute("aria-rowindex"));
    });
  const before = await topIndex();
  // Grow a row lower in the view.
  await table.evaluate((el) => {
    const rows = el.querySelectorAll<HTMLElement>("tbody > tr:not(.kit-virtual-table__spacer)");
    rows[Math.floor(rows.length / 2)]!.style.height = "400px";
  });
  await page.waitForTimeout(300);
  expect(Math.abs((await topIndex()) - before)).toBeLessThanOrEqual(1);
});

// One row grows while another shrinks by the same amount, so the body keeps
// its size and only per-row observation measures the trade. With stale
// heights the grown first row counts as short, and scrolling inside it
// drops it from the window.
test("two rows trading height are both measured again", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = page.locator('table[aria-label="Reviews without overscan"]');
  await expect(table).toHaveAttribute("aria-rowcount", "301");
  const scroller = page.locator(".content__body");
  const toTable = async (by: number) =>
    scroller.evaluate(
      (s, [el, offset]) => {
        s.scrollTop +=
          (el as Element).getBoundingClientRect().top - s.getBoundingClientRect().top + offset;
      },
      [await table.elementHandle(), by] as const,
    );
  await toTable(0);
  const rows = dataRows(table);
  await expect(rows.first()).toContainText("#0");
  // Explicit heights, taller than either row's content, make the trade exact.
  const setHeights = (first: string, second: string) =>
    table.evaluate(
      (el, [a, b]) => {
        const [one, two] = el.querySelectorAll<HTMLElement>(
          "tbody > tr:not(.kit-virtual-table__spacer)",
        );
        one!.style.height = a!;
        two!.style.height = b!;
      },
      [first, second],
    );
  await setHeights("80px", "600px");
  await page.waitForTimeout(200);
  await setHeights("600px", "80px");
  await page.waitForTimeout(200);
  // The first row now spans the table's first 600px; a view 300px down is
  // inside it. With stale heights the first row is dropped and scroll
  // anchoring pulls the view away from where it was scrolled.
  await toTable(300);
  await expect(rows.first()).toHaveAttribute("aria-rowindex", "2");
  await expect
    .poll(() =>
      rows.first().evaluate((tr) => {
        const top = document.querySelector(".content__body")!.getBoundingClientRect().top;
        return tr.getBoundingClientRect().top < top;
      }),
    )
    .toBe(true);
});

test("rows cover the view while the wheel scrolls quickly", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  const box = (await table.locator("xpath=..").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  let worst = 0;
  for (let i = 0; i < 30; i += 1) {
    await page.mouse.wheel(0, i < 20 ? 300 : -300);
    const gap = await table.evaluate(
      (el) =>
        new Promise<number>((resolve) =>
          requestAnimationFrame(() => {
            const wrapper = el.parentElement!.getBoundingClientRect();
            const head = el.tHead!.getBoundingClientRect().bottom;
            const rows = el.querySelectorAll("tbody > tr:not(.kit-virtual-table__spacer)");
            const first = rows[0]!.getBoundingClientRect().top;
            const last = rows[rows.length - 1]!.getBoundingClientRect().bottom;
            resolve(Math.max(0, first - head, wrapper.bottom - last));
          }),
        ),
    );
    worst = Math.max(worst, gap);
  }
  expect(worst).toBeLessThanOrEqual(1);
});

// A self-scrolling table whose rows were last computed while it was off
// screen must render its whole box once the page brings it back, without
// scrolling the box itself.
test("a bounded table scrolled into view by the page fills its box", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  const scroller = page.locator(".content__body");
  // Scroll the page far past the table, then resize the window so the
  // table recomputes its rows while off screen.
  await scroller.evaluate((s) => (s.scrollTop = s.scrollHeight));
  await expect(table.locator("xpath=..")).not.toBeInViewport();
  await page.setViewportSize({ width: 1180, height: 760 });
  await page.waitForTimeout(200);
  await table.locator("xpath=..").evaluate((wrapper) => {
    const s = document.querySelector(".content__body")!;
    s.scrollTop += wrapper.getBoundingClientRect().top - s.getBoundingClientRect().top;
  });
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const wrapper = el.parentElement!;
        const top = el.tHead!.getBoundingClientRect().bottom;
        const bottom =
          wrapper.getBoundingClientRect().top + wrapper.clientTop + wrapper.clientHeight;
        const rows = el.querySelectorAll("tbody > tr:not(.kit-virtual-table__spacer)");
        const first = rows[0]!.getBoundingClientRect().top;
        const last = rows[rows.length - 1]!.getBoundingClientRect().bottom;
        return first <= top + 1 && last >= bottom - 1;
      }),
    )
    .toBe(true);
});

// Rows sampled across the list set the pinned widths, so a value far down
// the list fits its column even though the columns were pinned at the top.
test("pinned columns fit values from the whole list, not only the first rows", async ({ page }) => {
  // A narrow window leaves the columns no spare width to hide the problem.
  await page.setViewportSize({ width: 700, height: 800 });
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  // The total height grows as taller rows near the end are measured, so
  // keep scrolling to the bottom until the last row renders.
  const last = dataRows(table).last();
  await expect
    .poll(async () => {
      await scrollWrapper(table, "bottom");
      return last.textContent();
    })
    .toContain("#9999");
  const lines = await last
    .locator("td")
    .first()
    .evaluate((td) => {
      const range = document.createRange();
      range.selectNodeContents(td);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
  expect(lines).toBe(1);
});

// In a bounded flex column that scrolls, a page-scrolled table must keep its
// full height; a shrunk, clipping wrapper would hide the rows below.
test("a page-scrolled table keeps its full height in a bounded flex column", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  await table.evaluate((el) => {
    const flow = el.closest(".flow") as HTMLElement;
    flow.style.display = "flex";
    flow.style.flexDirection = "column";
    flow.style.height = "400px";
    flow.style.overflowY = "auto";
  });
  await expect
    .poll(() => table.evaluate((el) => el.parentElement!.clientHeight - el.offsetHeight))
    .toBeGreaterThanOrEqual(-1);
});

// Sampled rows exist only while the columns are pinned, so none remain to
// submit form fields or show up in queries for the table's rows.
test("no sampled rows remain once the columns are pinned", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  await expect(table.locator("tbody > tr.kit-virtual-table__end ~ tr")).toHaveCount(0);
  await expect(table).toHaveClass(/kit-virtual-table--pinned/);
});

test("new items keep the columns' widths", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  const widths = () =>
    table
      .locator("thead th")
      .evaluateAll((cells) => cells.map((c) => c.getBoundingClientRect().width));
  const before = await widths();
  await page.getByRole("checkbox", { name: "Use longer project names" }).check();
  await expect(dataRows(table).first()).toContainText("with-a-longer-name");
  expect(await widths()).toEqual(before);
});

const notesTable = (page: Page) => page.locator('table[aria-label="Review notes"]');
const columnWidths = (table: Locator) =>
  table
    .locator("thead th")
    .evaluateAll((cells) => cells.map((c) => Math.round(c.getBoundingClientRect().width)));

test("dragging a header edge resizes the column", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  const before = await columnWidths(table);
  const handle = table.getByRole("separator", { name: "Resize the Project column" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const after = await columnWidths(table);
  expect(after[2]! - before[2]!).toBeGreaterThanOrEqual(98);
  // The table grows past its box rather than squeezing the other columns.
  expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
  expect(after[3]).toBe(before[3]);
});

test("arrow keys on a header edge resize the column", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  const before = await columnWidths(table);
  await table.getByRole("separator", { name: "Resize the ID column" }).focus();
  await page.keyboard.press("ArrowRight");
  expect((await columnWidths(table))[0]).toBe(before[0]! + 24);
});

test("double-clicking a header edge fits the column to its widest value", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  // Squeeze the Branch column so its long values wrap, then fit it.
  const handle = table.getByRole("separator", { name: "Resize the Branch column" });
  await handle.focus();
  for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowLeft");
  await handle.dblclick();
  const lines = await table
    .locator("td.branch", { hasText: "feature/a-much-longer" })
    .first()
    .evaluate((td) => {
      const range = document.createRange();
      range.selectNodeContents(td);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
  expect(lines).toBe(1);
});

test("a header's width and limits size its column", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = notesTable(page);
  await expect(dataRows(table).first()).toContainText("#0");
  expect((await columnWidths(table))[0]).toBe(90);
  // Dragging far left stops at the Project column's 80px minimum.
  const handle = table.getByRole("separator", { name: "Resize the Project column" });
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 400, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect((await columnWidths(table))[1]).toBe(80);
  // The app is told the widths after a resize.
  await expect(page.locator(".saved-widths")).toContainText(/Saved widths: 90, 80, /);
});

test("fitColumn supplies the content width for a fit", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = notesTable(page);
  await expect(dataRows(table).first()).toContainText("#0");
  await table.getByRole("separator", { name: "Resize the ID column" }).dblclick();
  // 40px of content plus the header cell's 10px padding on each side.
  await expect.poll(async () => (await columnWidths(table))[0]).toBe(60);
});
