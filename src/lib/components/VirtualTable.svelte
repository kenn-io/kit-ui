<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { setContext, untrack } from "svelte";
  import Table from "./Table.svelte";
  import {
    columnSizingContext,
    DEFAULT_MAX_COLUMN_WIDTH,
    DEFAULT_MIN_COLUMN_WIDTH,
    type ColumnResize,
    type ColumnSizing,
  } from "./table-columns.js";
  import { RowHeights, scrollerOf, virtualSlice, visibleWindow } from "./virtual.js";

  interface Props {
    /** Every row's data; only the rows on screen are rendered. */
    items: T[];
    /** Header cells — <TableHeaderCell> (or <th>) elements. */
    header: Snippet;
    /** Renders exactly one `<tr>` for `items[index]`. */
    row: Snippet<[T, number]>;
    /** A `<tr>` shown in the body when `items` is empty. */
    empty?: Snippet;
    /** Stable identity of a row, for keyed rendering and for keeping its
     * measured height when rows are inserted, removed, or reordered around
     * it. Defaults to the index, whose heights a new `items` array drops. */
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
    /** Called when a person sets a column's width: a drag or arrow key that
     * changed it, or a fit (Enter or double-click on the handle). Names the
     * column, for an app to keep its width. Automatic sizing, including
     * refitting to a new table width, never calls it. */
    oncolumnresize?: (change: ColumnResize) => void;
    class?: string;
  }

  let {
    items,
    header,
    row,
    empty = undefined,
    rowKey = undefined,
    scroll = "self",
    scrollElement = undefined,
    estimateRowHeight = 36,
    overscan = 8,
    stickyHeader = true,
    zebra = true,
    ariaLabel = undefined,
    unsorted = false,
    fitColumn = undefined,
    oncolumnresize = undefined,
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

  // Row heights by row key, so a row keeps its height when rows are
  // inserted, removed, or reordered around it; without `rowKey`, by index for
  // the current `items` array only. The cache is not reactive;
  // `measureVersion` signals that it changed. Rows not yet measured use the
  // fixed estimate, so measuring one row never moves the estimated rows
  // around it.
  const measured = new RowHeights<T>();
  let measureVersion = $state(0);
  // The key each row element was last measured under. A row not yet
  // measured under its key (an index-keyed row after `items` changed) is
  // observed afresh, which makes the observer report it once more after the
  // next layout.
  let measuredAt = new WeakMap<Element, unknown>();

  const rowKeyOf = (item: T, index: number): unknown => (rowKey ? rowKey(item, index) : index);
  // Every row's key, taken again whenever `items` changes, in place too (a
  // push or splice on a reactive array), so measured heights follow their rows.
  const rowKeys = $derived(rowKey ? items.map((item, i) => rowKey(item, i)) : undefined);

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
    if (measured.sync(items, rowKeys)) measuredAt = new WeakMap();
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
  // Size every column nobody resized again, for a new table width.
  let refitting = false;

  // Returns whether the columns will be measured: an empty list has no rows
  // to measure.
  function requestSizing(): boolean {
    const wrapper = body?.parentElement?.parentElement;
    if (items.length === 0 || !wrapper) return false;
    measureWidth = wrapper.offsetWidth;
    sampling = true;
    return true;
  }

  $effect(() => {
    if (!sampling) return;
    untrack(() => {
      const column = fitting;
      fitting = undefined;
      // A refit asked for alongside a fit waits for the next width change.
      if (column !== undefined) return measureFit(column);
      const refit = refitting;
      refitting = false;
      sizeColumns(refit);
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
  // TableHeaderCell or measured from the visible and sampled rows. A column a
  // person resized or fitted keeps its width; the others follow their
  // header's `width` and are sized again when the table's width changes.
  // Widths are stored by column key (the header's `column` or label), so
  // hiding a column keeps the others'.
  const widths = new Map<string, number>();
  // Keys of the columns a person resized or fitted.
  const chosen = new Set<string>();
  let shown: number[] = [];
  let sized = false;
  // The wrapper width the columns were last sized for.
  let sizedFor = 0;
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
  const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
  // The column that takes the spare width: the first header cell with
  // `fill`, or -1 when none has it and the last column takes it.
  const fillerOf = (cells: HTMLTableCellElement[]): number =>
    cells.findIndex((cell) => cell.dataset["kitFill"] !== undefined);
  // Whether the table still needs sizing: it was never sized, which a table
  // whose only column fills needs too, or a column other than the filling
  // one, which needs no width of its own, still has no width.
  const unsized = (cells: HTMLTableCellElement[]): boolean => {
    if (cells.length === 0) return false;
    const filler = fillerOf(cells);
    return !sized || cells.some((cell, i) => i !== filler && !widths.has(keyOf(cell)));
  };
  // The width a table has inside its wrapper's padding.
  const innerWidth = (wrapper: HTMLElement): number => {
    const style = getComputedStyle(wrapper);
    return wrapper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  };

  const copyTable = () => measureForm?.querySelector("table") ?? undefined;
  const copyCells = (): HTMLTableCellElement[] =>
    Array.from(copyTable()?.tHead?.rows[0]?.cells ?? []);

  const explicit = (cell: HTMLTableCellElement): number | undefined =>
    cell.dataset["kitWidth"] ? Number(cell.dataset["kitWidth"]) : undefined;

  // Give every column without a width one: the header's `width`, or its
  // share of the copy's width under automatic layout, the columns with
  // widths keeping theirs. A refit, for a new table width, sizes every
  // column a person did not choose again. With a filling column, which
  // stands at its minimum here, the other columns take their content's width
  // when that leaves the filling column room, so all the spare width goes to
  // it. Measured widths include padding and borders; pinned cells use
  // border-box sizing, so they become the final widths.
  function sizeColumns(refit: boolean): void {
    const cells = copyCells();
    const table = copyTable();
    // A hidden table (a closed <details>, an inactive tab) has no width to
    // measure against yet; the resize when it appears sizes it. An empty
    // list waits for rows.
    if (!table || cells.length === 0 || items.length === 0 || measureWidth === 0) return;
    columns = headerCells().length;
    const filler = fillerOf(cells);
    const resize = (key: string) => !widths.has(key) || (refit && !chosen.has(key));
    cells.forEach((cell, i) => {
      const key = keyOf(cell);
      const known =
        i === filler ? limitsOf(cell).min : resize(key) ? explicit(cell) : widths.get(key);
      if (known === undefined) return;
      cell.style.boxSizing = "border-box";
      cell.style.width = `${known}px`;
    });
    const measure = () => cells.map((cell) => cell.getBoundingClientRect().width);
    let measured: number[] | undefined;
    if (filler !== -1) {
      table.style.width = "max-content";
      const natural = measure();
      table.style.width = "";
      // Each column needs the width it will get, not its content's: the
      // filling column its minimum, the others their stored or set width,
      // or their content's width within their limits. Their text breaks to
      // fit in the live table.
      const needed = sum(
        cells.map((cell, i) =>
          i === filler
            ? limitsOf(cell).min
            : resize(keyOf(cell))
              ? clampTo(cell, explicit(cell) ?? natural[i]!)
              : widths.get(keyOf(cell))!,
        ),
      );
      if (needed <= innerWidth(table.parentElement!)) measured = natural;
    }
    measured ??= measure();
    cells.forEach((cell, i) => {
      const key = keyOf(cell);
      if (i !== filler && resize(key))
        widths.set(key, clampTo(cell, explicit(cell) ?? measured[i]!));
    });
    sized = true;
    sizedFor = measureWidth;
    applyWidths();
  }

  // After the wrapper changes width, the columns nobody chose are sized
  // again; otherwise the stored widths are shown again, the filling or last
  // column taking the rest. A hidden table (width 0) keeps its widths for
  // when it shows again. An empty table has no rows to measure: it shows
  // its stored widths in the new width, and the refit waits for rows
  // (`syncRows`). A wrapper back at the width the columns were sized for
  // needs no refit any more.
  function followWidth(): void {
    const width = body?.parentElement?.parentElement?.offsetWidth ?? 0;
    const cells = headerCells();
    const filler = fillerOf(cells);
    if (width > 0) {
      refitting =
        width !== sizedFor && cells.some((cell, i) => i !== filler && !chosen.has(keyOf(cell)));
    }
    if (!refitting || !requestSizing()) applyWidths();
  }

  // A header's `width` changed after the columns were sized. A column nobody
  // chose takes the new width; one left without a width is measured again.
  function followHeaderWidth(cell: HTMLTableCellElement): void {
    const key = keyOf(cell);
    if (chosen.has(key)) return;
    const width = explicit(cell);
    if (width === undefined) widths.delete(key);
    else widths.set(key, clampTo(cell, width));
  }

  // Show the stored widths in fixed layout. A filling column takes what the
  // others leave in the wrapper, and at least its minimum. Without one, the
  // last column takes the rest when the widths add up to less than the
  // wrapper, so the table still fills it. When the widths add up to more,
  // the table is wider and scrolls sideways.
  function applyWidths(): void {
    const table = body?.parentElement;
    const wrapper = table?.parentElement;
    const cells = headerCells();
    if (!table || !wrapper || cells.length === 0) return;
    const available = innerWidth(wrapper);
    const filler = fillerOf(cells);
    // A filling column needs no width of its own. One nobody chose drops the
    // automatic width it had, which no refit keeps current, so it is
    // measured afresh if it stops filling.
    if (filler !== -1 && !chosen.has(keyOf(cells[filler]!))) widths.delete(keyOf(cells[filler]!));
    shown = cells.map((cell, i) =>
      i === filler ? 0 : (widths.get(keyOf(cell)) ?? clampTo(cell, 100)),
    );
    const total = sum(shown);
    if (filler !== -1) shown[filler] = Math.max(limitsOf(cells[filler]!).min, available - total);
    else if (total < available) shown[shown.length - 1]! += available - total;
    cells.forEach((cell, i) => {
      cell.style.boxSizing = "border-box";
      cell.style.width = `${shown[i]}px`;
    });
    table.style.tableLayout = "fixed";
    table.style.width = `${sum(shown)}px`;
    if (!table.classList.contains(PINNED)) table.classList.add(PINNED);
    sizingVersion += 1;
  }

  // A person set a column's width: it keeps that width through refits, and
  // the app hears which column it was.
  function choose(cell: HTMLTableCellElement, width: number): void {
    const column = keyOf(cell);
    chosen.add(column);
    widths.set(column, width);
    applyWidths();
    oncolumnresize?.({ column, index: cell.cellIndex, width });
  }

  // Fit a column to its widest content among the copy's rows: laid out at
  // its natural width, the column's header cell is as wide as its widest
  // cell.
  function measureFit(column: number): void {
    const table = copyTable();
    const cell = copyCells()[column];
    const live = headerCells()[column];
    if (!table || !cell || !live) return;
    table.style.width = "max-content";
    choose(live, clampTo(cell, cell.getBoundingClientRect().width));
  }

  // Where a drag or key press started: the shown width it adds to, the
  // stored width it is compared with, and whether a person had already
  // chosen the column's width.
  let resizeBase = 0;
  let resizeFrom: number | undefined;
  let resizeWasChosen = false;
  // How far the drag or key press has moved, before any clamping.
  let resizeDelta = 0;
  const sizingApi: ColumnSizing = {
    get version() {
      return sizingVersion;
    },
    width: (cell) => (sized ? shown[cell.cellIndex] : undefined),
    limits: limitsOf,
    resizeStart: (cell) => {
      resizeBase = shown[cell.cellIndex] ?? 0;
      resizeFrom = widths.get(keyOf(cell));
      resizeWasChosen = chosen.has(keyOf(cell));
      resizeDelta = 0;
    },
    resize: (cell, delta) => {
      // A drag in progress is a person's choice, which a refit keeps.
      chosen.add(keyOf(cell));
      resizeDelta = delta;
      widths.set(keyOf(cell), clampTo(cell, resizeBase + delta));
      applyWidths();
    },
    resizeEnd: (cell) => {
      const key = keyOf(cell);
      const width = widths.get(key);
      // A drag back to where it started, or an arrow key at the column's
      // limit, changed nothing and reports nothing. The column keeps the
      // width it had, not the wider one a stretched last column showed,
      // which may be past its maxWidth.
      if (
        width === undefined ||
        resizeDelta === 0 ||
        width === resizeFrom ||
        width === resizeBase
      ) {
        if (resizeFrom === undefined) widths.delete(key);
        else widths.set(key, resizeFrom);
        if (!resizeWasChosen) chosen.delete(key);
        applyWidths();
        return;
      }
      choose(cell, width);
    },
    fit: (cell) => {
      const content = fitColumn?.(cell.cellIndex);
      if (content !== undefined) {
        const style = getComputedStyle(cell);
        const frame =
          parseFloat(style.paddingLeft) +
          parseFloat(style.paddingRight) +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.borderRightWidth);
        choose(cell, clampTo(cell, content + frame));
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
      if (watched.has(tr) && measuredAt.get(tr) === measured.keyOf(start + i)) return;
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
    // render or the table appears. A refit that found the list empty runs
    // now that rows are back.
    if (refitting || unsized(headerCells())) requestSizing();
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
      measuredAt.set(tr, measured.keyOf(index));
      const next = tops[i + 1];
      const h = next === undefined ? tr.getBoundingClientRect().height : next - tops[i]!;
      if (h > 0 && measured.set(index, h)) changed = true;
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
      if (sized) followWidth();
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
    // So must the spare width when a column takes or gives up `fill`; a
    // separate observer watches the cells' attributes, since watching the
    // header's whole subtree would also report every sort icon and resize
    // handle.
    const headerRow = (body.parentElement as HTMLTableElement).tHead?.rows[0];
    // A header's `width` changing after sizing is followed the same way.
    const headerChanged = (records: MutationRecord[]) => {
      for (const record of records) {
        if (
          record.attributeName === "data-kit-width" &&
          record.target instanceof HTMLTableCellElement
        )
          followHeaderWidth(record.target);
      }
      columns = Math.max(1, headerRow?.cells.length ?? 1);
      if (!unsized(headerCells())) applyWidths();
      syncRows();
    };
    const columnsChanged = new MutationObserver(headerChanged);
    const cellsChanged = new MutationObserver(headerChanged);
    if (headerRow) {
      columnsChanged.observe(headerRow, { childList: true });
      cellsChanged.observe(headerRow, {
        subtree: true,
        attributeFilter: ["data-kit-width", "data-kit-fill"],
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(applyFrame);
      applyFrame = 0;
      target.removeEventListener("scroll", updateWindow);
      window.removeEventListener("resize", resized);
      sizes.disconnect();
      columnsChanged.disconnect();
      cellsChanged.disconnect();
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
  {#each items.slice(slice.start, slice.end) as item, i (rowKeyOf(item, slice.start + i))}
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
      {#each measuredRows as index (rowKeyOf(items[index]!, index))}
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
