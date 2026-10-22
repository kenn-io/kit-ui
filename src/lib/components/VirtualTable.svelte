<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { setContext, untrack } from "svelte";
  import Table from "./Table.svelte";
  import {
    columnSizingContext,
    DEFAULT_MAX_COLUMN_WIDTH,
    DEFAULT_MIN_COLUMN_WIDTH,
    type ColumnSizing,
  } from "./table-columns.js";
  import { scrollerOf, virtualSlice, visibleWindow } from "./virtual.js";

  interface Props {
    /** Every row's data; only the rows on screen are rendered. */
    items: T[];
    /** Header cells — <TableHeaderCell> (or <th>) elements. */
    header: Snippet;
    /** Renders exactly one `<tr>` for `items[index]`. */
    row: Snippet<[T, number]>;
    /** A `<tr>` shown in the body when `items` is empty. */
    empty?: Snippet;
    /** Stable identity of a row, for keyed rendering. Defaults to the index. */
    rowKey?: (item: T, index: number) => unknown;
    /** What scrolls the rows: the table's own wrapper (give it a bounded
     * height), or the page or panel the table sits in. */
    scroll?: "self" | "page";
    /** With `scroll="page"`, the element that scrolls the table. Defaults to
     * the nearest scrolling ancestor, or the document. */
    scrollElement?: () => HTMLElement | null;
    /** Height in px of rows not yet rendered. Set it near the real row
     * height: it sizes the scrollbar and places unmeasured rows. The window
     * follows measured heights one frame later, so an estimate far above the
     * real height, with little overscan, can show a gap for that frame. */
    estimateRowHeight?: number;
    /** Rows rendered beyond each edge of the visible area. They also cover
     * the frame before the window follows newly measured heights. */
    overscan?: number;
    /** Keep the header visible while the body scrolls. */
    stickyHeader?: boolean;
    /** Stripe even rows. */
    zebra?: boolean;
    ariaLabel?: string;
    /** Opts this table out of sorting, as on Table. */
    unsorted?: boolean;
    /** The width in px the content of column `column` needs, for fitting it
     * when its resize handle is double-clicked; undefined measures the
     * column's rows sampled across the list. The table adds the header
     * cell's padding and clamps to the column's limits. */
    fitColumn?: (column: number) => number | undefined;
    /** Called with every column's width, in order, after a resize or fit,
     * for an app to keep them. */
    oncolumnwidthschange?: (widths: number[]) => void;
    class?: string;
  }

  let {
    items,
    header,
    row,
    empty = undefined,
    rowKey = (_item: T, index: number) => index,
    scroll = "self",
    scrollElement = undefined,
    estimateRowHeight = 36,
    overscan = 8,
    stickyHeader = true,
    zebra = true,
    ariaLabel = undefined,
    unsorted = false,
    fitColumn = undefined,
    oncolumnwidthschange = undefined,
    class: className = "",
  }: Props = $props();

  const SPACER = "kit-virtual-table__spacer";
  // Rows sampled across the whole list for column widths (see `measuredRows`).
  const SAMPLE_ROWS = 50;
  const PINNED = "kit-virtual-table--pinned";
  const SPACER_ROW = "border: 0; background: none;";
  const SPACER_CELL = "padding: 0; border: 0;";

  // Rows and widths are refreshed after every scroll, resize, and row
  // resize, and most refreshes change nothing. Rewriting an unchanged value
  // is still a DOM change: observers see it, and the browser styles and
  // paints another frame, so only changed values are written.
  function setAttribute(el: Element, name: string, value: string): void {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }

  let body: HTMLTableSectionElement | undefined;
  let scroller: HTMLElement | undefined;
  let scrollTop = $state(0);
  let viewport = $state(0);
  let columns = $state(1);

  // Row heights by index, valid only for the `items` array they were taken
  // from (sorting or filtering reuses indexes for other rows). The Map is not
  // reactive; `measureVersion` signals that it changed. Rows not yet
  // measured use the fixed estimate, so measuring one row never moves the
  // estimated rows around it.
  const measured = new Map<number, number>();
  let measureVersion = $state(0);
  let measuredFor: T[] | undefined;
  // The index each row element was last measured at, for the current
  // `items`. A row not yet measured at its index is observed afresh, which
  // makes the observer report it once more after the next layout.
  let measuredAt = new WeakMap<Element, number>();

  const heightOf = (index: number): number => {
    const h = measured.get(index) ?? estimateRowHeight;
    return h > 0 ? h : 1;
  };

  const windowOf = () =>
    virtualSlice({
      scrollTop,
      viewport,
      count: items.length,
      overscan: Math.max(0, Math.floor(overscan)),
      heightOf,
    });

  const slice = $derived.by(() => {
    void measureVersion;
    if (measuredFor !== items) {
      measured.clear();
      measuredAt = new WeakMap();
      measuredFor = items;
    }
    return windowOf();
  });

  // Height of the rows after the rendered window.
  const bottomPad = $derived.by(() => {
    let rendered = 0;
    for (let i = slice.start; i < slice.end; i += 1) rendered += heightOf(i);
    return Math.max(0, slice.totalHeight - slice.topPad - rendered);
  });

  // Zebra striping counts rows with nth-child, and the top spacer is the
  // first child. A second, empty spacer before a window that starts on an
  // even index keeps every row on the parity it has in a full table.
  const parityPad = $derived(slice.start % 2 === 0);

  // Columns are measured in a separate, hidden copy of the table holding the
  // rows on screen and rows sampled evenly across the list (first and last
  // included), so the widths fit values from the whole list. The copy lives
  // in its own <form>, mounted only while measuring and unmounted before
  // paint, so the copied rows' form fields never join the app's form or its
  // radio groups, and queries for the table's rows never see them.
  const measuredRows = $derived.by(() => {
    const n = items.length;
    const count = Math.min(SAMPLE_ROWS, n);
    const picked = new Set<number>();
    for (let k = 0; k < count; k += 1) {
      picked.add(count === 1 ? 0 : Math.round((k * (n - 1)) / (count - 1)));
    }
    for (let i = slice.start; i < slice.end; i += 1) picked.add(i);
    return [...picked].sort((a, b) => a - b);
  });

  let sampling = $state(false);
  let measureForm = $state<HTMLFormElement>();
  // The copy is as wide as the live table's wrapper.
  let measureWidth = $state(0);
  // The column a fit measures, or undefined to size unsized columns.
  let fitting: number | undefined;

  function requestSizing(): void {
    const wrapper = body?.parentElement?.parentElement;
    if (items.length === 0 || !wrapper) return;
    measureWidth = wrapper.offsetWidth;
    sampling = true;
  }

  $effect(() => {
    if (!sampling) return;
    untrack(() => {
      const column = fitting;
      fitting = undefined;
      if (column === undefined) sizeColumns();
      else measureFit(column);
    });
    sampling = false;
  });

  // The visible part of the body is where it overlaps the scroller's client
  // area, whether or not the scroller itself is on screen, so a table scrolled
  // into view by something else is already rendered (the window stands in
  // for the document scroller). The body's position is read on every update,
  // so content above the table moving is picked up on the next scroll or
  // resize; a layout change with neither calls `refresh()`.
  function updateWindow(): void {
    if (!body || !scroller) return;
    let view = { top: 0, bottom: window.innerHeight };
    if (scroller !== document.scrollingElement) {
      const top = scroller.getBoundingClientRect().top + scroller.clientTop;
      view = { top, bottom: top + scroller.clientHeight };
    }
    const next = visibleWindow(body.getBoundingClientRect().top, view);
    scrollTop = next.scrollTop;
    viewport = next.viewport;
  }

  // Column widths, as in gpui-kit: each column has a width, set on its
  // TableHeaderCell or measured once from the visible and sampled rows, kept
  // until someone resizes or fits the column. Widths are stored by column key
  // (the header's `column` or label), so hiding a column keeps the others'.
  const widths = new Map<string, number>();
  let shown: number[] = [];
  let sized = false;
  let sizingVersion = $state(0);

  const headerCells = (): HTMLTableCellElement[] =>
    Array.from((body?.parentElement as HTMLTableElement | undefined)?.tHead?.rows[0]?.cells ?? []);
  const keyOf = (cell: HTMLTableCellElement): string =>
    cell.dataset["kitColumn"] || String(cell.cellIndex);
  const limitsOf = (cell: HTMLTableCellElement) => ({
    min: Number(cell.dataset["kitMinWidth"]) || DEFAULT_MIN_COLUMN_WIDTH,
    max: Number(cell.dataset["kitMaxWidth"]) || DEFAULT_MAX_COLUMN_WIDTH,
  });
  const clampTo = (cell: HTMLTableCellElement, width: number): number => {
    const { min, max } = limitsOf(cell);
    return Math.min(max, Math.max(min, width));
  };

  const copyTable = () => measureForm?.querySelector("table") ?? undefined;
  const copyCells = (): HTMLTableCellElement[] =>
    Array.from(copyTable()?.tHead?.rows[0]?.cells ?? []);

  // Give every column without a width one: the header's `width`, or its
  // share of the copy's width under automatic layout, the columns with
  // widths keeping theirs. Measured widths include padding and borders;
  // pinned cells use border-box sizing, so they become the final widths.
  function sizeColumns(): void {
    const cells = copyCells();
    // A hidden table (a closed <details>, an inactive tab) has no width to
    // measure against yet; the resize when it appears sizes it. An empty
    // list waits for rows.
    if (cells.length === 0 || items.length === 0 || measureWidth === 0) return;
    columns = headerCells().length;
    const explicit = (cell: HTMLTableCellElement) =>
      cell.dataset["kitWidth"] ? Number(cell.dataset["kitWidth"]) : undefined;
    for (const cell of cells) {
      const known = widths.get(keyOf(cell)) ?? explicit(cell);
      if (known === undefined) continue;
      cell.style.boxSizing = "border-box";
      cell.style.width = `${known}px`;
    }
    const measured = cells.map((cell) => cell.getBoundingClientRect().width);
    cells.forEach((cell, i) => {
      if (!widths.has(keyOf(cell)))
        widths.set(keyOf(cell), clampTo(cell, explicit(cell) ?? measured[i]!));
    });
    sized = true;
    applyWidths();
  }

  // Show the stored widths in fixed layout. When they add up to less than
  // the wrapper, the last column takes the rest, so the table still fills
  // it; when they add up to more, the table is wider and scrolls sideways.
  function applyWidths(): void {
    const table = body?.parentElement;
    const wrapper = table?.parentElement;
    const cells = headerCells();
    if (!table || !wrapper || cells.length === 0) return;
    const style = getComputedStyle(wrapper);
    const available =
      wrapper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    shown = cells.map((cell) => widths.get(keyOf(cell)) ?? clampTo(cell, 100));
    const total = shown.reduce((sum, width) => sum + width, 0);
    if (total < available) shown[shown.length - 1]! += available - total;
    cells.forEach((cell, i) => {
      cell.style.boxSizing = "border-box";
      cell.style.width = `${shown[i]}px`;
    });
    table.style.tableLayout = "fixed";
    table.style.width = `${shown.reduce((sum, width) => sum + width, 0)}px`;
    if (!table.classList.contains(PINNED)) table.classList.add(PINNED);
    sizingVersion += 1;
  }

  function reportWidths(): void {
    oncolumnwidthschange?.(
      headerCells().map((cell, i) => widths.get(keyOf(cell)) ?? shown[i] ?? 0),
    );
  }

  // Fit a column to its widest content among the copy's rows: laid out at
  // its natural width, the column's header cell is as wide as its widest
  // cell.
  function measureFit(column: number): void {
    const table = copyTable();
    const cell = copyCells()[column];
    if (!table || !cell) return;
    table.style.width = "max-content";
    widths.set(keyOf(cell), clampTo(cell, cell.getBoundingClientRect().width));
    applyWidths();
    reportWidths();
  }

  let resizeBase = 0;
  const sizingApi: ColumnSizing = {
    get version() {
      return sizingVersion;
    },
    width: (cell) => (sized ? shown[cell.cellIndex] : undefined),
    limits: limitsOf,
    resizeStart: (cell) => {
      resizeBase = shown[cell.cellIndex] ?? 0;
    },
    resize: (cell, delta) => {
      widths.set(keyOf(cell), clampTo(cell, resizeBase + delta));
      applyWidths();
    },
    resizeEnd: () => reportWidths(),
    fit: (cell) => {
      const content = fitColumn?.(cell.cellIndex);
      if (content !== undefined) {
        const style = getComputedStyle(cell);
        const frame =
          parseFloat(style.paddingLeft) +
          parseFloat(style.paddingRight) +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.borderRightWidth);
        widths.set(keyOf(cell), clampTo(cell, content + frame));
        applyWidths();
        reportWidths();
        return;
      }
      fitting = cell.cellIndex;
      requestSizing();
    },
  };
  setContext(columnSizingContext, sizingApi);

  // Each rendered row is observed, so any row changing height, even when
  // another changes by the opposite amount and the body keeps its size,
  // measures the rows again. Rows are measured in the observer's callback,
  // which the browser runs after it lays out a frame, so reading their
  // positions there costs no layout of its own. Reading them as soon as they
  // render would make the browser lay out the whole page early, and again
  // for the frame.
  let rowObserver: ResizeObserver | undefined;
  let watched = new Set<Element>();
  function watchRows(rows: HTMLTableRowElement[], start: number): void {
    if (!rowObserver) return;
    const next = new Set<Element>(rows);
    for (const el of watched) if (!next.has(el)) rowObserver.unobserve(el);
    rows.forEach((tr, i) => {
      // A row this observer watches at the index it was measured at needs
      // nothing. A new observer, after the scroller changes, watches none.
      if (watched.has(tr) && measuredAt.get(tr) === start + i) return;
      // observe() ignores a row that is already observed.
      if (watched.has(tr)) rowObserver!.unobserve(tr);
      rowObserver!.observe(tr);
    });
    watched = next;
  }

  // New heights of rendered rows change nothing on screen until they move
  // which rows the window holds, since the spacers stand in only for rows
  // outside it. Moving the window resizes the table and the boxes observed
  // around it, and doing that inside an observer's callback would leave
  // their reports undelivered (a "ResizeObserver loop" error), so the move
  // waits for the next frame, before its layout. Rows on screen already show
  // at their real heights; only the overscan rows change a frame later.
  let applyFrame = 0;
  function applyHeights(): void {
    cancelAnimationFrame(applyFrame);
    applyFrame = 0;
    measureVersion += 1;
  }

  const dataRows = (): HTMLTableRowElement[] =>
    Array.from(body?.rows ?? []).filter((tr) => !tr.classList.contains(SPACER));

  // Number the rendered rows for assistive technology, which only sees
  // those, and watch them for measuring. It reads no layout, except to size
  // columns that have no width yet.
  function syncRows(): void {
    if (!body) return;
    const table = body.parentElement as HTMLTableElement;
    setAttribute(table, "aria-rowcount", String(items.length + 1));
    // An empty table shows only the `empty` row, which neither measures a
    // data row nor should decide the column widths.
    if (items.length === 0) return watchRows([], 0);
    const rows = dataRows();
    const start = slice.start;
    rows.forEach((tr, i) => setAttribute(tr, "aria-rowindex", String(start + i + 2)));
    watchRows(rows, start);
    // Size any column still without a width, until it has one: a column
    // added while the list was empty or the table hidden is sized once rows
    // render or the table appears.
    if (headerCells().some((cell) => !widths.has(keyOf(cell)))) requestSizing();
  }

  // Read rendered row heights, from the gap between consecutive row tops so
  // collapsed borders are counted once. Returns whether any height changed.
  function measureRows(): boolean {
    if (!body || items.length === 0) return false;
    const rows = dataRows();
    if (rows.length === 0) return false;
    const start = slice.start;
    const tops = rows.map((tr) => tr.getBoundingClientRect().top);
    let changed = false;
    rows.forEach((tr, i) => {
      const index = start + i;
      measuredAt.set(tr, index);
      const next = tops[i + 1];
      const h = next === undefined ? tr.getBoundingClientRect().height : next - tops[i]!;
      if (h > 0 && measured.get(index) !== h) {
        measured.set(index, h);
        changed = true;
      }
    });
    return changed;
  }

  $effect(() => {
    void slice;
    untrack(syncRows);
  });

  /** Measure the rows and recompute which are visible. Call it after a
   * layout change that neither scrolls nor resizes the scroller, such as
   * content above the table collapsing. */
  export function refresh(): void {
    syncRows();
    if (measureRows()) applyHeights();
    updateWindow();
  }

  function track(spacer: HTMLTableRowElement) {
    body = spacer.parentElement as HTMLTableSectionElement;
    const wrapper = body.parentElement!.parentElement as HTMLElement;
    const element =
      scroll === "self" ? wrapper : (scrollElement?.() ?? untrack(() => scrollerOf(wrapper)));
    scroller = element;
    const target: HTMLElement | Window = element === document.scrollingElement ? window : element;
    const resized = () => {
      if (sized) applyWidths();
      refresh();
    };
    untrack(updateWindow);
    // The window updates in the scroll event itself, before the next paint,
    // so overscan only has to cover what the compositor scrolls ahead.
    target.addEventListener("scroll", updateWindow, { passive: true });
    window.addEventListener("resize", resized);
    // Re-laying out inside an observer's callback would resize what it
    // observes in the same frame (a "ResizeObserver loop" error), so the work
    // waits for the next frame.
    let frame = 0;
    const schedule = () => {
      if (frame === 0)
        frame = requestAnimationFrame(() => {
          frame = 0;
          resized();
        });
    };
    // The scroller's size decides how many rows show; the wrapper's width
    // decides the pinned columns, and it appearing lays out a hidden table.
    const sizes = new ResizeObserver(schedule);
    if (element !== document.scrollingElement) sizes.observe(element);
    sizes.observe(wrapper);
    rowObserver = new ResizeObserver(() => {
      if (!measureRows() || applyFrame !== 0) return;
      const next = windowOf();
      if (next.start !== slice.start || next.end !== slice.end)
        applyFrame = requestAnimationFrame(applyHeights);
    });
    // Adding or removing a column changes neither the rows nor the sizes
    // observed above, but the pinned widths and spacer colspans must follow.
    const headerRow = (body.parentElement as HTMLTableElement).tHead?.rows[0];
    const columnsChanged = new MutationObserver(() => {
      columns = Math.max(1, headerRow?.cells.length ?? 1);
      if (headerCells().every((cell) => widths.has(keyOf(cell)))) applyWidths();
      syncRows();
    });
    if (headerRow) columnsChanged.observe(headerRow, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(applyFrame);
      applyFrame = 0;
      target.removeEventListener("scroll", updateWindow);
      window.removeEventListener("resize", resized);
      sizes.disconnect();
      columnsChanged.disconnect();
      rowObserver?.disconnect();
      rowObserver = undefined;
      watched = new Set();
      body = undefined;
      scroller = undefined;
    };
  }
</script>

<!-- Spacers stand in for the rows that are not rendered. Inline styles keep
     row styling (padding, borders, stripes, hover) from Table or the app off
     them. -->
<Table {header} {scroll} {stickyHeader} {zebra} {ariaLabel} {unsorted} class={className}>
  <tr class={SPACER} aria-hidden="true" style={SPACER_ROW} {@attach track}>
    <td colspan={columns} style={SPACER_CELL} style:height="{slice.topPad}px"></td>
  </tr>
  {#if parityPad}
    <tr class={SPACER} aria-hidden="true" style={SPACER_ROW}></tr>
  {/if}
  {#each items.slice(slice.start, slice.end) as item, i (rowKey(item, slice.start + i))}
    {@render row(item, slice.start + i)}
  {/each}
  <!-- Only a table with no items is empty; a window scrolled out of view
       renders no rows, not the empty row. -->
  {#if items.length === 0}
    {@render empty?.()}
  {/if}
  <tr class={SPACER} aria-hidden="true" style={SPACER_ROW}>
    <td colspan={columns} style={SPACER_CELL} style:height="{bottomPad}px"></td>
  </tr>
</Table>
{#if sampling}
  <form
    bind:this={measureForm}
    class="kit-virtual-table__measure"
    aria-hidden="true"
    inert
    style:width="{measureWidth}px"
  >
    <Table {header} {zebra} {unsorted} stickyHeader={false} class={className}>
      {#each measuredRows as index (rowKey(items[index]!, index))}
        {@render row(items[index]!, index)}
      {/each}
    </Table>
  </form>
{/if}

<style>
  /* A pinned column no longer widens for a long value that scrolls in
   * later, so its text breaks anywhere rather than spilling into the next
   * cell. */
  :global(.kit-virtual-table--pinned td) {
    overflow-wrap: anywhere;
  }

  /* The measuring copy lays out at the live table's width but takes no
   * space, never shows, and adds nothing to any scrollable area. */
  .kit-virtual-table__measure {
    position: fixed;
    top: 0;
    left: 0;
    height: 0;
    margin: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }
</style>
