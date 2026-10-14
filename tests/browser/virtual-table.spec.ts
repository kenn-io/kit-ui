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
  // The table fits its wrapper, so the wrapper must not become the header's
  // scroll container.
  await expect(table.locator("xpath=..")).not.toHaveClass(/kit-table-wrapper--contained/);
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
  await table.evaluate((el) => {
    const flow = el.closest(".flow") as HTMLElement;
    flow.style.display = "flex";
    flow.style.width = "260px";
  });
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const wrapper = el.parentElement!;
        return {
          fits: wrapper.getBoundingClientRect().width <= 262,
          scrolls: wrapper.scrollWidth > wrapper.clientWidth,
        };
      }),
    )
    .toEqual({ fits: true, scrolls: true });
});

test("pinned widths do not add padding again when the app uses content-box sizing", async ({
  page,
}) => {
  await gotoPage(page, "virtual-table");
  await page.addStyleTag({ content: ".kit-table th, .kit-table td { box-sizing: content-box; }" });
  const table = bounded(page);
  await expect(dataRows(table).first()).toContainText("#0");
  // Re-pin under the content-box rule.
  await page.setViewportSize({ width: 1180, height: 800 });
  await expect
    .poll(() => table.evaluate((el) => el.offsetWidth - el.parentElement!.clientWidth))
    .toBeLessThanOrEqual(0);
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

test("an ancestor that clips only sideways does not cut off rendered rows", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  await table.evaluate((el) => {
    const flow = el.closest(".flow") as HTMLElement;
    flow.style.overflowX = "clip";
    flow.style.overflowY = "visible";
    flow.style.height = "200px";
  });
  // Bring the table's top to the top of the scroller, so the rows past the
  // 200px box are on screen.
  await page.locator(".content__body").evaluate(
    (s, el) => {
      s.scrollTop += el!.getBoundingClientRect().top - s.getBoundingClientRect().top;
    },
    await table.elementHandle(),
  );
  // A window resize re-reads the clipping ancestors.
  await page.setViewportSize({ width: 1180, height: 800 });
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

test("rows fill the view when content above the table collapses", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  const scroller = page.locator(".content__body");
  // Put a tall block before the table and scroll until only the table's
  // first 100px show, then remove the block without scrolling.
  await table.evaluate((el) => {
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

// A sibling directly inside the fixed-height scroller resizes none of the
// table's ancestors. Scroll anchoring would hide the move, so it is off, as
// it is in browsers without anchoring.
test("rows fill the view when a sibling in a fixed-height scroller collapses", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = page.locator('table[aria-label="Reviews without overscan"]');
  await expect(table).toHaveAttribute("aria-rowcount", "301");
  const scroller = page.locator(".content__body");
  await scroller.evaluate(
    (s, el) => {
      (s as HTMLElement).style.overflowAnchor = "none";
      const block = document.createElement("div");
      block.id = "collapsible";
      block.style.height = "1000px";
      s.prepend(block);
      // Leave the table 300px below the visible area.
      s.scrollTop += el!.getBoundingClientRect().top - (s.getBoundingClientRect().bottom + 300);
    },
    await table.elementHandle(),
  );
  await page.waitForTimeout(100);
  await expect(dataRows(table)).toHaveCount(0);
  await page.locator("#collapsible").evaluate((block) => block.remove());
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const s = document.querySelector(".content__body")!.getBoundingClientRect();
        const rows = el.querySelectorAll("tbody > tr:not(.kit-virtual-table__spacer)");
        if (rows.length === 0) return false;
        const last = rows[rows.length - 1]!.getBoundingClientRect().bottom;
        return last >= Math.min(s.bottom, el.getBoundingClientRect().bottom) - 1;
      }),
    )
    .toBe(true);
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

test("rows follow a collapse above the table larger than the screen", async ({ page }) => {
  await gotoPage(page, "virtual-table");
  const table = inFlow(page);
  await expect(table).toHaveAttribute("aria-rowcount", "2001");
  const scroller = page.locator(".content__body");
  await scroller.evaluate(
    (s, el) => {
      (s as HTMLElement).style.overflowAnchor = "none";
      const block = document.createElement("div");
      block.id = "collapsible";
      block.style.height = "3000px";
      s.prepend(block);
      // View the middle of the table.
      s.scrollTop += el!.getBoundingClientRect().top - s.getBoundingClientRect().top + 20000;
    },
    await table.elementHandle(),
  );
  await page.waitForTimeout(100);
  await page.locator("#collapsible").evaluate((block) => block.remove());
  await expect
    .poll(() =>
      table.evaluate((el) => {
        const s = document.querySelector(".content__body")!.getBoundingClientRect();
        const rows = el.querySelectorAll("tbody > tr:not(.kit-virtual-table__spacer)");
        const first = rows[0]!.getBoundingClientRect().top;
        const last = rows[rows.length - 1]!.getBoundingClientRect().bottom;
        return first <= s.top + 1 && last >= s.bottom - 1;
      }),
    )
    .toBe(true);
});
