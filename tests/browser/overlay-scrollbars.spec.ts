import { expect, test } from "@playwright/test";
import { gotoPage, useTheme } from "./helpers.js";

// Disable Chromium's --hide-scrollbars so classic scrollbars would take layout
// width anywhere native scrollbars are not properly suppressed.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });
test.skip(({ browserName }) => browserName !== "chromium", "Needs Chromium's classic scrollbars");

test("Table scroll='self' has zero gutter, edge-to-edge headers/dividers, sticky thead clearance, and draggable thumbs", async ({
  page,
}) => {
  await gotoPage(page, "table");
  const table = page.getByRole("table", { name: "Scrollable jobs" });
  const wrapper = table.locator("xpath=ancestor::div[contains(@class, 'kit-table-wrapper')]");
  const viewport = table.locator("xpath=parent::div[contains(@class, 'kit-table-viewport')]");

  // Outer frame owns border-radius and does not scroll; inner viewport scrolls with 0px gutter.
  const frameStats = await wrapper.evaluate((frame) => {
    const vp = frame.querySelector(".kit-table-viewport") as HTMLElement;
    const tbl = vp.querySelector("table") as HTMLTableElement;
    const lastTh = tbl.tHead!.rows[0]!.cells[tbl.tHead!.rows[0]!.cells.length - 1]!;
    const lastTd = tbl.tBodies[0]!.rows[0]!.cells[tbl.tBodies[0]!.rows[0]!.cells.length - 1]!;
    const vpRect = vp.getBoundingClientRect();
    return {
      frameOverflow: getComputedStyle(frame).overflow,
      frameRadius: Number.parseFloat(getComputedStyle(frame).borderTopRightRadius),
      gutterY: vp.offsetWidth - vp.clientWidth,
      gutterX: vp.offsetHeight - vp.clientHeight,
      overflowsY: vp.scrollHeight > vp.clientHeight,
      tableReachesRightEdge: Math.abs(tbl.getBoundingClientRect().right - vpRect.right),
      headerReachesRightEdge: Math.abs(lastTh.getBoundingClientRect().right - vpRect.right),
      cellReachesRightEdge: Math.abs(lastTd.getBoundingClientRect().right - vpRect.right),
    };
  });

  expect(frameStats.frameOverflow).toBe("clip");
  expect(frameStats.frameRadius).toBeGreaterThan(0);
  expect(frameStats.gutterY).toBe(0);
  expect(frameStats.gutterX).toBe(0);
  expect(frameStats.overflowsY).toBe(true);
  // Table may be wider than viewport (horizontal overflow) or exact width: either
  // way its header and cells reach at least the viewport's right edge with zero gap.
  expect(frameStats.headerReachesRightEdge).toBeLessThanOrEqual(
    frameStats.tableReachesRightEdge + 1,
  );
  expect(frameStats.cellReachesRightEdge).toBeLessThanOrEqual(frameStats.tableReachesRightEdge + 1);

  // Hover shows the vertical overlay thumb strictly below sticky <thead> and clear of bottom corner.
  await wrapper.hover();
  const yTrack = wrapper.locator('[data-kit-scrollbar="y"]');
  const yThumb = yTrack.locator(".kit-scrollbar__thumb");
  await expect(yTrack).toHaveAttribute("data-visible", "true");

  const clearance = await wrapper.evaluate((frame) => {
    const head = frame.querySelector("thead")!.getBoundingClientRect();
    const track = frame.querySelector('[data-kit-scrollbar="y"]')!.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return {
      belowHead: track.top - head.bottom,
      aboveBottomCorner: frameRect.bottom - track.bottom,
    };
  });
  expect(clearance.belowHead).toBeGreaterThanOrEqual(1);
  expect(clearance.aboveBottomCorner).toBeGreaterThanOrEqual(6);

  // Dragging the vertical thumb scrolls the inner viewport.
  const thumbBox = (await yThumb.boundingBox())!;
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2 + 60, {
    steps: 6,
  });
  await page.mouse.up();

  expect(await viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(80);
  expect(await wrapper.evaluate((el) => el.scrollTop)).toBe(0);
});

test("Table without horizontal overflow spans 100% of frame width so headers and row dividers hit the right border", async ({
  page,
}) => {
  await gotoPage(page, "table");
  const table = page.getByRole("table", { name: "Review jobs" });
  const host = table.locator("xpath=ancestor::div[contains(@class, 'table-host')]");
  const wrapper = table.locator("xpath=ancestor::div[contains(@class, 'kit-table-wrapper')]");
  const viewport = table.locator("xpath=parent::div[contains(@class, 'kit-table-viewport')]");

  // Constrain height so the table overflows vertically while fitting horizontally.
  await host.evaluate((el) => {
    (el as HTMLElement).style.maxHeight = "120px";
  });

  const stats = await wrapper.evaluate((frame) => {
    const vp = frame.querySelector(".kit-table-viewport") as HTMLElement;
    const tbl = vp.querySelector("table") as HTMLTableElement;
    const lastTh = tbl.tHead!.rows[0]!.cells[tbl.tHead!.rows[0]!.cells.length - 1]!;
    const lastTd = tbl.tBodies[0]!.rows[0]!.cells[tbl.tBodies[0]!.rows[0]!.cells.length - 1]!;
    const vpRect = vp.getBoundingClientRect();
    return {
      overflowsY: vp.scrollHeight > vp.clientHeight,
      gutterY: vp.offsetWidth - vp.clientWidth,
      tableWidthDiff: Math.abs(tbl.getBoundingClientRect().width - vpRect.width),
      headerRightGap: Math.abs(vpRect.right - lastTh.getBoundingClientRect().right),
      cellRightGap: Math.abs(vpRect.right - lastTd.getBoundingClientRect().right),
      tdBorderBottom: getComputedStyle(lastTd).borderBottomWidth,
    };
  });

  expect(stats.overflowsY).toBe(true);
  expect(stats.gutterY).toBe(0);
  expect(stats.tableWidthDiff).toBeLessThanOrEqual(1);
  expect(stats.headerRightGap).toBeLessThanOrEqual(1);
  expect(stats.cellRightGap).toBeLessThanOrEqual(1);
  expect(stats.tdBorderBottom).toBe("1px");
  expect(await viewport.evaluate((el) => el.clientWidth)).toBeGreaterThan(100);
});

test("VirtualTable keeps 0px gutter, sticky thead clearance, and pointer-draggable overlay thumb", async ({
  page,
}) => {
  await gotoPage(page, "virtual-table");
  const table = page.locator('table[aria-label="Reviews"]');
  const wrapper = table.locator("xpath=ancestor::div[contains(@class, 'kit-table-wrapper')]");
  const viewport = table.locator("xpath=parent::div[contains(@class, 'kit-table-viewport')]");

  await expect(table.locator("tbody tr:not(.kit-virtual-table__spacer)").first()).toBeVisible();

  const stats = await wrapper.evaluate((frame) => {
    const vp = frame.querySelector(".kit-table-viewport") as HTMLElement;
    return {
      gutterY: vp.offsetWidth - vp.clientWidth,
      overflowsY: vp.scrollHeight > vp.clientHeight,
    };
  });
  expect(stats.gutterY).toBe(0);
  expect(stats.overflowsY).toBe(true);

  await wrapper.hover();
  const yTrack = wrapper.locator('[data-kit-scrollbar="y"]');
  const yThumb = yTrack.locator(".kit-scrollbar__thumb");
  await expect(yTrack).toHaveAttribute("data-visible", "true");

  const clearance = await wrapper.evaluate((frame) => {
    const head = frame.querySelector("thead")!.getBoundingClientRect();
    const track = frame.querySelector('[data-kit-scrollbar="y"]')!.getBoundingClientRect();
    return track.top - head.bottom;
  });
  expect(clearance).toBeGreaterThanOrEqual(1);

  const thumbBox = (await yThumb.boundingBox())!;
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2 + 50, {
    steps: 6,
  });
  await page.mouse.up();

  expect(await viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
});

test("horizontally overflowing scroll='page' table keeps frame chrome and renders a draggable horizontal overlay thumb", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await gotoPage(page, "table");

  // Mount a compact scroll="page" table that overflows horizontally so its
  // rounded outer frame and horizontal overlay thumb sit completely on screen.
  await page.evaluate(async () => {
    const { mount } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: Table } = await import("/src/lib/components/Table.svelte");
    const { createRawSnippet } = await import("/node_modules/.vite/deps/svelte.js");
    const container = document.createElement("div");
    container.id = "wide-page-table-host";
    container.style.cssText =
      "position:fixed;top:16px;left:16px;width:280px;z-index:2000;background:var(--bg-surface)";
    document.body.append(container);
    mount(Table, {
      target: container,
      props: {
        scroll: "page",
        unsorted: true,
        ariaLabel: "Wide page table",
        class: "table-card",
        header: createRawSnippet(() => ({
          render: () =>
            `<th>Column A</th><th>Column B</th><th>Column C</th><th>Column D</th><th>Column E</th>`,
        })),
        children: createRawSnippet(() => ({
          render: () =>
            `<tr><td style="white-space:nowrap">alpha-long-value-1</td><td style="white-space:nowrap">beta-long-value-2</td><td style="white-space:nowrap">gamma-long-value-3</td><td style="white-space:nowrap">delta-long-value-4</td><td style="white-space:nowrap">epsilon-long-value-5</td></tr>` +
            `<tr><td style="white-space:nowrap">zeta-long-value-1</td><td style="white-space:nowrap">eta-long-value-2</td><td style="white-space:nowrap">theta-long-value-3</td><td style="white-space:nowrap">iota-long-value-4</td><td style="white-space:nowrap">kappa-long-value-5</td></tr>`,
        })),
      },
    });
  });

  const table = page.getByRole("table", { name: "Wide page table" });
  const wrapper = table.locator("xpath=ancestor::div[contains(@class, 'kit-table-wrapper')]");
  const viewport = table.locator("xpath=parent::div[contains(@class, 'kit-table-viewport')]");

  await expect(wrapper).toHaveClass(/kit-table-wrapper--wide/);

  const stats = await wrapper.evaluate((frame) => {
    const vp = frame.querySelector(".kit-table-viewport") as HTMLElement;
    return {
      frameOverflow: getComputedStyle(frame).overflow,
      frameRadius: Number.parseFloat(getComputedStyle(frame).borderBottomLeftRadius),
      gutterX: vp.offsetHeight - vp.clientHeight,
      overflowsX: vp.scrollWidth > vp.clientWidth,
    };
  });
  expect(stats.frameOverflow).toBe("clip");
  expect(stats.frameRadius).toBeGreaterThan(0);
  expect(stats.gutterX).toBe(0);
  expect(stats.overflowsX).toBe(true);

  await wrapper.hover();
  const xTrack = wrapper.locator('[data-kit-scrollbar="x"]');
  const xThumb = xTrack.locator(".kit-scrollbar__thumb");
  await expect(xTrack).toHaveAttribute("data-visible", "true");

  // Horizontal thumb stays clear of rounded bottom corners.
  const corners = await wrapper.evaluate((frame) => {
    const f = frame.getBoundingClientRect();
    const t = frame.querySelector('[data-kit-scrollbar="x"]')!.getBoundingClientRect();
    return { leftGap: t.left - f.left, rightGap: f.right - t.right };
  });
  expect(corners.leftGap).toBeGreaterThanOrEqual(6);
  expect(corners.rightGap).toBeGreaterThanOrEqual(6);

  const thumbBox = (await xThumb.boundingBox())!;
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumbBox.x + thumbBox.width / 2 + 60, thumbBox.y + thumbBox.height / 2, {
    steps: 6,
  });
  await page.mouse.up();

  expect(await viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(20);
});

test("identity themes' scrollbar-color does not restore classic scrollbars on overlay-scrolled components", async ({
  page,
}) => {
  await gotoPage(page, "modal");
  await useTheme(page, "quiet");

  // Confirm theme's scrollbar-color is active on :root while modal body stays 0px gutter.
  const rootColor = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollbarColor,
  );
  expect(rootColor).not.toBe("auto");

  await page.getByRole("button", { name: "Open tall modal" }).click();
  const body = page.locator(".kit-modal-body");
  await expect(body).toBeVisible();

  const modalStats = await body.evaluate((el) => ({
    scrollbarWidth: getComputedStyle(el).scrollbarWidth,
    scrollbarColor: getComputedStyle(el).scrollbarColor,
    gutter: (el as HTMLElement).offsetWidth - el.clientWidth,
    overflows: el.scrollHeight > el.clientHeight,
  }));
  expect(modalStats.scrollbarWidth).toBe("none");
  expect(modalStats.scrollbarColor).toBe("auto");
  expect(modalStats.gutter).toBe(0);
  expect(modalStats.overflows).toBe(true);
});

test("DetailDrawer, Typeahead, SelectDropdown, FilterDropdown, Menu, and CommandPalette suppress native scrollbar gutters", async ({
  page,
}) => {
  const checkZeroGutter = async (selector: string) => {
    const el = page.locator(selector).first();
    await expect(el).toBeVisible();
    const result = await el.evaluate((node) => {
      const style = getComputedStyle(node);
      const borders =
        Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth);
      return {
        scrollbarWidth: style.scrollbarWidth,
        gutter: (node as HTMLElement).offsetWidth - node.clientWidth - borders,
      };
    });
    expect(result.scrollbarWidth, selector).toBe("none");
    expect(result.gutter, selector).toBe(0);
  };

  await gotoPage(page, "detail-drawer");
  await page.getByRole("button", { name: "Open drawer" }).first().click();
  await checkZeroGutter(".kit-detail-drawer__body");
  await page.keyboard.press("Escape");

  await gotoPage(page, "typeahead");
  await page.locator(".kit-typeahead__trigger").first().click();
  await checkZeroGutter(".kit-typeahead__body");
  await page.keyboard.press("Escape");

  await gotoPage(page, "select-dropdown");
  await page.locator(".kit-select-dropdown__trigger").first().click();
  await checkZeroGutter(".kit-select-dropdown__list");
  await page.keyboard.press("Escape");

  await gotoPage(page, "filter-dropdown");
  await page.locator(".kit-filter-dropdown__btn").first().click();
  await checkZeroGutter(".kit-filter-dropdown__panel");
  await page.keyboard.press("Escape");

  await gotoPage(page, "menu");
  await page.locator(".kit-menu__trigger").first().click();
  await checkZeroGutter(".kit-menu__content");
  await page.keyboard.press("Escape");

  await gotoPage(page, "command-palette");
  await page
    .getByRole("button", { name: /Open palette/i })
    .first()
    .click();
  await checkZeroGutter(".kit-command-palette__list");
  await page.keyboard.press("Escape");
});
