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

test("wheeling over host-mounted scrollbar tracks scrolls the inner viewport, respects deltaMode, and chains at boundaries", async ({
  page,
}) => {
  await gotoPage(page, "scroll-box");

  await page.evaluate(async () => {
    const { mount, createRawSnippet } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: ScrollBox } = await import("/src/lib/components/ScrollBox.svelte");

    const outer = document.createElement("div");
    outer.id = "wheel-outer-host";
    outer.style.cssText =
      "position:fixed;top:16px;left:16px;width:320px;height:260px;overflow-y:auto;z-index:2000;background:var(--bg-surface);border:1px solid var(--border-default)";

    const innerMount = document.createElement("div");
    innerMount.style.cssText = "display:flex;flex-direction:column;height:180px;margin:12px";
    outer.append(innerMount);

    const outerTail = document.createElement("div");
    outerTail.style.cssText = "height:600px";
    outer.append(outerTail);

    document.body.append(outer);

    const rows = Array.from(
      { length: 24 },
      (_, i) => `<div style="height:24px;line-height:24px">Row ${i + 1}</div>`,
    ).join("");

    mount(ScrollBox, {
      target: innerMount,
      props: {
        label: "Wheel inner box",
        axis: "y",
        visibility: "always",
        children: createRawSnippet(() => ({
          render: () => `<div>${rows}</div>`,
        })),
      },
    });
  });

  const outer = page.locator("#wheel-outer-host");
  const innerViewport = outer.locator('.kit-scrollbox__viewport[aria-label="Wheel inner box"]');
  const track = outer.locator('[data-kit-scrollbar="y"]');
  const thumb = track.locator(".kit-scrollbar__thumb");

  await expect(track).toHaveAttribute("data-visible", "true");

  // 1. Native mouse wheel over the visible thumb scrolls the inner viewport, not the outer container.
  const thumbBox = (await thumb.boundingBox())!;
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.wheel(0, 120);

  await expect.poll(() => innerViewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(80);
  expect(await outer.evaluate((el) => el.scrollTop)).toBe(0);

  // 2. DOM_DELTA_LINE and DOM_DELTA_PAGE units scale proportionally when dispatched over the track.
  const beforeLine = await innerViewport.evaluate((el) => el.scrollTop);
  await track.evaluate((el) => {
    el.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true }),
    );
  });
  const afterLine = await innerViewport.evaluate((el) => el.scrollTop);
  expect(afterLine - beforeLine).toBeGreaterThanOrEqual(30);

  await innerViewport.evaluate((el) => {
    el.scrollTop = 0;
  });
  await track.evaluate((el) => {
    el.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 1, deltaMode: 2, bubbles: true, cancelable: true }),
    );
  });
  const afterPage = await innerViewport.evaluate((el) => el.scrollTop);
  expect(afterPage).toBeGreaterThanOrEqual(140);

  // 3. At the bottom boundary, wheeling over the track chains to the outer scroll container.
  await innerViewport.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const trackBox = (await track.boundingBox())!;
  await page.mouse.move(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height / 2);
  await page.mouse.wheel(0, 140);

  await expect.poll(() => outer.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);

  // 4. Track clicks and thumb dragging remain functional.
  await outer.evaluate((el) => {
    el.scrollTop = 0;
  });
  const freshTrackBox = (await track.boundingBox())!;
  await page.mouse.click(freshTrackBox.x + freshTrackBox.width / 2, freshTrackBox.y + 4);
  const afterClick = await innerViewport.evaluate((el) => el.scrollTop);
  expect(afterClick).toBeLessThan(100);

  const freshThumbBox = (await thumb.boundingBox())!;
  await page.mouse.move(
    freshThumbBox.x + freshThumbBox.width / 2,
    freshThumbBox.y + freshThumbBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    freshThumbBox.x + freshThumbBox.width / 2,
    freshThumbBox.y + freshThumbBox.height / 2 + 60,
    { steps: 4 },
  );
  await page.mouse.up();
  expect(await innerViewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(afterClick + 80);
});

test("shrinking a deeply scrolled self-mode VirtualList clamps invalid scroll positions without spurious scrollbars and preserves valid positions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await gotoPage(page, "virtual-list");

  await page.evaluate(async () => {
    const { mount, createRawSnippet } = await import("/node_modules/.vite/deps/svelte.js");
    const { SvelteMap } = await import("/node_modules/.vite/deps/svelte_reactivity.js");
    const { default: VirtualList } = await import("/src/lib/components/VirtualList.svelte");

    const host = document.createElement("div");
    host.id = "shrink-virtual-list-host";
    host.style.cssText =
      "position:fixed;top:16px;left:16px;width:300px;height:200px;z-index:2000;background:var(--bg-surface)";
    document.body.append(host);

    const makeItems = (count: number) => Array.from({ length: count }, (_, i) => `Item ${i}`);
    const store = new SvelteMap<string, string[]>([["items", makeItems(2000)]]);
    const row = createRawSnippet((item: () => string) => ({
      render: () => `<div style="height:32px;line-height:32px">${item()}</div>`,
    }));

    const props = {
      get items() {
        return store.get("items") ?? [];
      },
      itemHeight: 32,
      height: "200px",
      ariaLabel: "Shrinkable virtual list",
      row,
    };

    const { unmount } = mount(VirtualList, { target: host, props });
    (window as unknown as Record<string, unknown>).__setVirtualListCount = (count: number) => {
      store.set("items", makeItems(count));
    };
    (window as unknown as Record<string, unknown>).__unmountShrinkTest = unmount;
  });

  const vlist = page.locator('.kit-virtual-list[aria-label="Shrinkable virtual list"]');
  const vtrack = vlist.locator('[data-kit-scrollbar="y"]');
  const vthumb = vtrack.locator(".kit-scrollbar__thumb");

  // Scroll deeply into the 2,000-item list so the self-mode track sits far down.
  await vlist.evaluate((el) => {
    el.scrollTop = 20000;
  });
  await vlist.hover();
  await expect(vtrack).toHaveAttribute("data-visible", "true");
  await expect
    .poll(() => vtrack.evaluate((el) => Number.parseFloat((el as HTMLElement).style.top || "0")))
    .toBeGreaterThan(19000);

  // 1. Shrink from 2,000 items (64,000px) to 30 items (960px, maxScrollY = 760):
  // scrollTop clamps immediately to 760, scrollHeight drops to 960, and bottom rows render.
  await page.evaluate(() => {
    (window as unknown as { __setVirtualListCount: (n: number) => void }).__setVirtualListCount(30);
  });
  await expect.poll(() => vlist.evaluate((el) => el.scrollHeight)).toBe(960);
  await expect.poll(() => vlist.evaluate((el) => el.scrollTop)).toBe(760);
  await expect(vlist).toContainText("Item 29");

  // 2. Scroll to a valid offset (200) and shrink from 30 items (960px) to 20 items (640px, maxScrollY = 440):
  // valid scroll position is preserved.
  await vlist.evaluate((el) => {
    el.scrollTop = 200;
  });
  await expect.poll(() => vlist.evaluate((el) => el.scrollTop)).toBe(200);
  await page.evaluate(() => {
    (window as unknown as { __setVirtualListCount: (n: number) => void }).__setVirtualListCount(20);
  });
  await expect.poll(() => vlist.evaluate((el) => el.scrollHeight)).toBe(640);
  expect(await vlist.evaluate((el) => el.scrollTop)).toBe(200);

  // Verify self-mode thumb dragging still works after shrinking.
  await vlist.hover();
  await expect(vtrack).toHaveAttribute("data-visible", "true");
  const thumbBox = (await vthumb.boundingBox())!;
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2 + 50, {
    steps: 4,
  });
  await page.mouse.up();
  expect(await vlist.evaluate((el) => el.scrollTop)).toBeGreaterThan(250);

  // 3. Shrink to 3 items (96px < 200px viewport): scrollTop clamps immediately to 0,
  // scrollHeight drops to <= 200, the spurious scrollbar disappears, and Item 0 is visible.
  await page.evaluate(() => {
    (window as unknown as { __setVirtualListCount: (n: number) => void }).__setVirtualListCount(3);
  });
  await expect.poll(() => vlist.evaluate((el) => el.scrollTop)).toBe(0);
  await expect.poll(() => vlist.evaluate((el) => el.scrollHeight)).toBeLessThanOrEqual(200);
  await expect(vtrack).toHaveCount(0);
  await expect(vlist).toContainText("Item 0");

  expect(errors).toEqual([]);
});

test("keeps scrollbar thumbs visible with contrasting system colors in forced-colors mode", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await gotoPage(page, "scroll-box");

  const box = page.locator('.kit-scrollbox:has(.kit-scrollbox__viewport[aria-label="Demo log"])');
  const track = box.locator('[data-kit-scrollbar="y"]');
  const thumb = track.locator(".kit-scrollbar__thumb");

  await box.hover();
  await expect(track).toHaveAttribute("data-visible", "true");

  const resting = await thumb.evaluate((el) => {
    const thumbStyle = getComputedStyle(el);
    const canvasBg = getComputedStyle(document.body).backgroundColor;
    return {
      bg: thumbStyle.backgroundColor,
      canvasBg,
      borderStyle: thumbStyle.borderTopStyle,
      borderWidth: Number.parseFloat(thumbStyle.borderTopWidth),
      forcedColorAdjust: thumbStyle.forcedColorAdjust,
    };
  });

  expect(resting.forcedColorAdjust).toBe("none");
  expect(resting.bg).not.toBe(resting.canvasBg);
  expect(resting.borderStyle).toBe("solid");
  expect(resting.borderWidth).toBeGreaterThanOrEqual(1);

  // Hovering the track switches the thumb to the system selection color.
  const trackBox = (await track.boundingBox())!;
  await page.mouse.move(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height / 2);
  await expect(track).toHaveAttribute("data-hover", "true");
  const hoveredBg = await thumb.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(hoveredBg).not.toBe(resting.canvasBg);
});

test("CollapsibleSidebar, Modal, DetailDrawer, and BottomDock show draggable horizontal overlay scrollbars when content overflows horizontally", async ({
  page,
}) => {
  await gotoPage(page, "scroll-box");

  await page.evaluate(async () => {
    const { mount, unmount, createRawSnippet } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: CollapsibleSidebar } =
      await import("/src/lib/components/CollapsibleSidebar.svelte");
    const { default: BottomDock } = await import("/src/lib/components/BottomDock.svelte");
    const { default: Modal } = await import("/src/lib/components/Modal.svelte");
    const { default: DetailDrawer } = await import("/src/lib/components/DetailDrawer.svelte");

    const wide = () =>
      createRawSnippet(() => ({
        render: () => `<div style="width:900px;height:40px;white-space:nowrap">Wide content</div>`,
      }));
    const side = () =>
      createRawSnippet(() => ({
        render: () => `<div>Nav</div>`,
      }));

    // 1. CollapsibleSidebar with mainOverflow="auto"
    const csHost = document.createElement("div");
    csHost.id = "wide-collapsible-sidebar";
    csHost.style.cssText =
      "position:fixed;top:12px;left:12px;width:460px;height:140px;display:flex;z-index:2000;background:var(--bg-surface)";
    document.body.append(csHost);
    mount(CollapsibleSidebar, {
      target: csHost,
      props: {
        sidebarWidth: 120,
        minSidebarWidth: 100,
        mainOverflow: "auto",
        sidebar: side(),
        children: wide(),
      },
    });

    // 2. BottomDock
    const dockHost = document.createElement("div");
    dockHost.id = "wide-bottom-dock";
    dockHost.style.cssText =
      "position:fixed;top:164px;left:12px;width:320px;height:180px;z-index:2000";
    document.body.append(dockHost);
    mount(BottomDock, {
      target: dockHost,
      props: {
        open: true,
        onclose: () => {},
        ariaLabel: "Wide dock",
        initialHeight: "160px",
        minHeight: "120px",
        children: wide(),
      },
    });

    // Mount helpers for Modal and DetailDrawer so they don't overlap each other.
    const w = window as unknown as Record<string, unknown>;
    w.__openWideModal = () => {
      const mHost = document.createElement("div");
      mHost.id = "wide-modal-host";
      document.body.append(mHost);
      const instance = mount(Modal, {
        target: mHost,
        props: { title: "Wide modal", width: "300px", children: wide() },
      });
      w.__closeWideModal = () => {
        void unmount(instance);
        mHost.remove();
      };
    };
    w.__openWideDrawer = () => {
      const dHost = document.createElement("div");
      dHost.id = "wide-drawer-host";
      document.body.append(dHost);
      const instance = mount(DetailDrawer, {
        target: dHost,
        props: { title: "Wide drawer", width: "300px", children: wide() },
      });
      w.__closeWideDrawer = () => {
        void unmount(instance);
        dHost.remove();
      };
    };
  });

  const verifyHorizontalDrag = async (frameSelector: string, viewportSelector: string) => {
    const frame = page.locator(frameSelector);
    const vp = frame.locator(viewportSelector);
    const xTrack = frame.locator('[data-kit-scrollbar="x"]');
    const xThumb = xTrack.locator(".kit-scrollbar__thumb");

    await frame.hover();
    await expect(xTrack).toHaveAttribute("data-visible", "true");
    expect(await vp.evaluate((el) => (el as HTMLElement).offsetHeight - el.clientHeight)).toBe(0);

    const box = (await xThumb.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    expect(await vp.evaluate((el) => el.scrollLeft)).toBeGreaterThan(40);
  };

  await verifyHorizontalDrag("#wide-collapsible-sidebar", ".kit-sidebar-layout__main");
  await verifyHorizontalDrag("#wide-bottom-dock", ".kit-bottom-dock__body");

  await page.evaluate(() =>
    (window as unknown as { __openWideModal: () => void }).__openWideModal(),
  );
  await verifyHorizontalDrag("#wide-modal-host .kit-modal-panel", ".kit-modal-body");
  await page.evaluate(() =>
    (window as unknown as { __closeWideModal: () => void }).__closeWideModal(),
  );

  await page.evaluate(() =>
    (window as unknown as { __openWideDrawer: () => void }).__openWideDrawer(),
  );
  await verifyHorizontalDrag("#wide-drawer-host .kit-detail-drawer", ".kit-detail-drawer__body");
  await page.evaluate(() =>
    (window as unknown as { __closeWideDrawer: () => void }).__closeWideDrawer(),
  );
});

test("RTL horizontal ScrollBox and self-mode containers place thumbs at the right start, drag/click into negative scrollLeft, and keep self-mode tracks aligned", async ({
  page,
}) => {
  await gotoPage(page, "scroll-box");

  await page.evaluate(async () => {
    const { mount, createRawSnippet } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: ScrollBox } = await import("/src/lib/components/ScrollBox.svelte");
    const { overlayScrollbars } = await import("/src/lib/utils/overlay-scrollbars.js");

    // 1. Host-mode RTL ScrollBox
    const rtlHost = document.createElement("div");
    rtlHost.id = "rtl-scrollbox-host";
    rtlHost.dir = "rtl";
    rtlHost.style.cssText =
      "position:fixed;top:16px;left:16px;width:300px;height:140px;display:flex;flex-direction:column;z-index:2000;background:var(--bg-surface);border:1px solid var(--border-default)";
    document.body.append(rtlHost);
    mount(ScrollBox, {
      target: rtlHost,
      props: {
        label: "RTL box",
        axis: "both",
        visibility: "always",
        children: createRawSnippet(() => ({
          render: () => `<div style="width:1200px;height:400px">RTL wide content</div>`,
        })),
      },
    });

    // 2. Self-mode RTL container
    const selfRtl = document.createElement("div");
    selfRtl.id = "rtl-self-scroller";
    selfRtl.dir = "rtl";
    selfRtl.style.cssText =
      "position:fixed;top:180px;left:16px;width:300px;height:140px;overflow:auto;z-index:2000;background:var(--bg-surface);border:1px solid var(--border-default)";
    const inner = document.createElement("div");
    inner.id = "rtl-self-inner";
    inner.style.cssText = "width:1200px;height:400px";
    inner.textContent = "RTL self-mode content";
    selfRtl.append(inner);
    document.body.append(selfRtl);
    overlayScrollbars({ axis: "both", visibility: "always" })(selfRtl);
  });

  // Verify host-mode RTL ScrollBox: thumb starts at the right end of the track.
  const rtlHost = page.locator("#rtl-scrollbox-host");
  const rtlViewport = rtlHost.locator(".kit-scrollbox__viewport");
  const rtlTrack = rtlHost.locator('[data-kit-scrollbar="x"]');
  const rtlThumb = rtlTrack.locator(".kit-scrollbar__thumb");

  await expect(rtlTrack).toHaveAttribute("data-visible", "true");
  const initialPos = await rtlHost.evaluate((el) => {
    const t = el.querySelector('[data-kit-scrollbar="x"]')!.getBoundingClientRect();
    const th = el
      .querySelector('[data-kit-scrollbar="x"] .kit-scrollbar__thumb')!
      .getBoundingClientRect();
    return {
      trackLeft: t.left,
      trackRight: t.right,
      thumbLeft: th.left,
      thumbRight: th.right,
    };
  });
  expect(Math.abs(initialPos.trackRight - initialPos.thumbRight)).toBeLessThanOrEqual(2);
  expect(initialPos.thumbLeft - initialPos.trackLeft).toBeGreaterThan(50);

  // Dragging the RTL thumb to the left scrolls scrollLeft negative and moves the thumb left.
  const thumbBox = (await rtlThumb.boundingBox())!;
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumbBox.x + thumbBox.width / 2 - 80, thumbBox.y + thumbBox.height / 2, {
    steps: 6,
  });
  await page.mouse.up();

  const afterDragLeft = await rtlViewport.evaluate((el) => el.scrollLeft);
  expect(afterDragLeft).toBeLessThan(-100);
  const movedThumbBox = (await rtlThumb.boundingBox())!;
  expect(movedThumbBox.x).toBeLessThan(thumbBox.x - 40);

  // Clicking near the left end of the RTL track jumps close to -maxScrollX.
  const trackBox = (await rtlTrack.boundingBox())!;
  await page.mouse.click(trackBox.x + 4, trackBox.y + trackBox.height / 2);
  const afterLeftClick = await rtlViewport.evaluate((el) => el.scrollLeft);
  expect(afterLeftClick).toBeLessThan(afterDragLeft);

  // Clicking near the right end of the RTL track jumps back toward 0.
  await page.mouse.click(trackBox.x + trackBox.width - 4, trackBox.y + trackBox.height / 2);
  const afterRightClick = await rtlViewport.evaluate((el) => el.scrollLeft);
  expect(afterRightClick).toBeGreaterThan(-50);

  // Verify self-mode RTL container keeps tracks aligned inside the visible viewport
  // at negative scrollLeft, supports dragging, and clamps cleanly when shrunk.
  const selfRtl = page.locator("#rtl-self-scroller");
  const selfInner = page.locator("#rtl-self-inner");
  const selfXTrack = selfRtl.locator('[data-kit-scrollbar="x"]');
  const selfXThumb = selfXTrack.locator(".kit-scrollbar__thumb");

  await selfRtl.evaluate((el) => {
    el.scrollLeft = -350;
  });
  await expect(selfXTrack).toHaveAttribute("data-visible", "true");

  const alignment = await selfRtl.evaluate((vp) => {
    const vpRect = vp.getBoundingClientRect();
    const xRect = vp.querySelector('[data-kit-scrollbar="x"]')!.getBoundingClientRect();
    const yRect = vp.querySelector('[data-kit-scrollbar="y"]')!.getBoundingClientRect();
    return {
      xInsideLeft: xRect.left >= vpRect.left - 1,
      xInsideRight: xRect.right <= vpRect.right + 1,
      yAlignedRight: Math.abs(vpRect.right - yRect.right) <= 3,
    };
  });
  expect(alignment.xInsideLeft).toBe(true);
  expect(alignment.xInsideRight).toBe(true);
  expect(alignment.yAlignedRight).toBe(true);

  const selfThumbBox = (await selfXThumb.boundingBox())!;
  await page.mouse.move(
    selfThumbBox.x + selfThumbBox.width / 2,
    selfThumbBox.y + selfThumbBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    selfThumbBox.x + selfThumbBox.width / 2 - 40,
    selfThumbBox.y + selfThumbBox.height / 2,
    { steps: 4 },
  );
  await page.mouse.up();
  expect(await selfRtl.evaluate((el) => el.scrollLeft)).toBeLessThan(-400);

  // Shrinking the wide RTL content removes the horizontal scrollbar and clamps scrollLeft to 0.
  await selfInner.evaluate((el) => {
    (el as HTMLElement).style.width = "200px";
  });
  await expect.poll(() => selfRtl.evaluate((el) => el.scrollLeft)).toBe(0);
  await expect(selfXTrack).toHaveCount(0);
});

test("SelectDropdown, MenuContent, and VirtualList render draggable horizontal overlay scrollbars when rows exceed container width", async ({
  page,
}) => {
  const longLabel =
    "very-long-non-wrapping-label-that-exceeds-the-popover-max-width-to-trigger-horizontal-overflow-0123456789";

  const verifySelfHorizontalDrag = async (viewportSelector: string) => {
    const vp = page.locator(viewportSelector);
    const xTrack = vp.locator('[data-kit-scrollbar="x"]');
    const xThumb = xTrack.locator(".kit-scrollbar__thumb");

    await vp.hover();
    await expect(xTrack).toHaveAttribute("data-visible", "true");
    const gutter = await vp.evaluate((el) => {
      const s = getComputedStyle(el);
      return (
        (el as HTMLElement).offsetHeight -
        el.clientHeight -
        Number.parseFloat(s.borderTopWidth) -
        Number.parseFloat(s.borderBottomWidth)
      );
    });
    expect(gutter).toBe(0);

    const box = (await xThumb.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    expect(await vp.evaluate((el) => el.scrollLeft)).toBeGreaterThan(30);
  };

  await gotoPage(page, "scroll-box");

  // 1. Wide VirtualList
  await page.evaluate(async (label) => {
    const { mount, createRawSnippet } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: VirtualList } = await import("/src/lib/components/VirtualList.svelte");
    const host = document.createElement("div");
    host.id = "wide-vlist-host";
    host.style.cssText =
      "position:fixed;top:16px;left:16px;width:240px;height:140px;z-index:2000;background:var(--bg-surface)";
    document.body.append(host);
    mount(VirtualList, {
      target: host,
      props: {
        items: [label, "Row 2", "Row 3"],
        itemHeight: 28,
        height: "140px",
        ariaLabel: "Wide virtual list",
        row: createRawSnippet((item: () => string) => ({
          render: () => `<div style="white-space:nowrap;width:max-content">${item()}</div>`,
        })),
      },
    });
  }, longLabel);
  await verifySelfHorizontalDrag('.kit-virtual-list[aria-label="Wide virtual list"]');
  await page.evaluate(() => document.querySelector("#wide-vlist-host")?.remove());

  // 2. Wide SelectDropdown
  await page.evaluate(async (label) => {
    const { mount } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: SelectDropdown } = await import("/src/lib/components/SelectDropdown.svelte");
    const host = document.createElement("div");
    host.id = "wide-select-host";
    host.style.cssText = "position:fixed;top:16px;left:16px;z-index:2000";
    document.body.append(host);
    mount(SelectDropdown, {
      target: host,
      props: {
        value: "a",
        options: [
          { value: "a", label },
          { value: "b", label: "Short option" },
        ],
        onchange: () => {},
      },
    });
  }, longLabel);
  await page.locator("#wide-select-host .kit-select-dropdown__trigger").click();
  await verifySelfHorizontalDrag(".kit-select-dropdown__list");
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.querySelector("#wide-select-host")?.remove());

  // 3. Wide MenuContent on the Menu demo page
  await gotoPage(page, "menu");
  await page.getByRole("button", { name: "Task actions" }).click();
  const menuContent = page.getByRole("menu", { name: "Task actions" });
  await expect(menuContent).toBeVisible();
  await menuContent
    .locator('[role="menuitem"]')
    .first()
    .evaluate((el, label) => {
      (el as HTMLElement).style.whiteSpace = "nowrap";
      el.textContent = label;
    }, longLabel);
  await verifySelfHorizontalDrag('.kit-menu__content[aria-label="Task actions"]');
  await page.keyboard.press("Escape");
});
