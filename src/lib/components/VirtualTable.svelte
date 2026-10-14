<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { untrack } from "svelte";
  import Table from "./Table.svelte";
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
     * height: it sizes the scrollbar and places unmeasured rows. */
    estimateRowHeight?: number;
    /** Rows rendered beyond each edge of the visible area. */
    overscan?: number;
    /** Keep the header visible while the body scrolls. */
    stickyHeader?: boolean;
    /** Stripe even rows. */
    zebra?: boolean;
    ariaLabel?: string;
    /** Opts this table out of sorting, as on Table. */
    unsorted?: boolean;
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
    class: className = "",
  }: Props = $props();

  const SPACER = "kit-virtual-table__spacer";
  const END = "kit-virtual-table__end";
  // Rows sampled across the whole list for column widths (see `samples`).
  const SAMPLE_ROWS = 50;
  const PINNED = "kit-virtual-table--pinned";
  const SPACER_ROW = "border: 0; background: none;";
  const SPACER_CELL = "padding: 0; border: 0;";

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

  const heightOf = (index: number): number => {
    const h = measured.get(index) ?? estimateRowHeight;
    return h > 0 ? h : 1;
  };

  const slice = $derived.by(() => {
    void measureVersion;
    if (measuredFor !== items) {
      measured.clear();
      measuredFor = items;
    }
    return virtualSlice({
      scrollTop,
      viewport,
      count: items.length,
      overscan: Math.max(0, Math.floor(overscan)),
      heightOf,
    });
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

  // Rows spread evenly across the list, first and last included, rendered
  // after the bottom spacer with `visibility: collapse` while the columns are
  // pinned: Chrome gives them no height and hides them, but they still count
  // toward the column widths, so the pinned widths fit values from the whole
  // list, not only the first rows on screen. They are unmounted in the same
  // update, before paint, so their form fields never submit or validate and
  // queries for the table's rows never see them.
  const samples = $derived.by(() => {
    const n = items.length;
    const count = Math.min(SAMPLE_ROWS, n);
    const picked = new Set<number>();
    for (let k = 0; k < count; k += 1) {
      picked.add(count === 1 ? 0 : Math.round((k * (n - 1)) / (count - 1)));
    }
    return [...picked];
  });

  let sampling = $state(false);
  // Pin the columns again: mount the samples, and the effect below measures
  // and unmounts them once they have rendered.
  function requestPin(): void {
    if (items.length > 0) sampling = true;
  }

  $effect(() => {
    if (!sampling) return;
    untrack(freezeColumns);
    sampling = false;
  });

  // A new items array (other data, a filter, a sort) may hold wider values.
  $effect(() => {
    void items;
    untrack(requestPin);
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

  // Column widths follow the rendered rows under automatic layout, so they
  // would shift as different rows scroll in. Lay the table out once with the
  // rows on screen, then pin those widths until the table's width changes or
  // its columns do.
  let frozenWidth = -1;
  function freezeColumns(): void {
    const table = body?.parentElement;
    const cells = (table as HTMLTableElement | undefined)?.tHead?.rows[0]?.cells;
    // A hidden table (a closed <details>, an inactive tab) has no layout to
    // pin yet; the resize when it appears measures it.
    if (!table || !cells || !table.parentElement?.clientWidth) return;
    table.style.tableLayout = "";
    table.classList.remove(PINNED);
    for (const cell of cells) {
      cell.style.width = "";
      cell.style.boxSizing = "";
    }
    columns = Math.max(1, cells.length);
    // Only data rows, on screen or sampled, may decide the widths. Without
    // any (an empty list), stay unpinned until rows render.
    const rendered = Array.from(body!.rows).some((tr) => !tr.classList.contains(SPACER));
    if (items.length === 0 || !rendered) {
      frozenWidth = -1;
      return;
    }
    // The measured width includes padding and borders; border-box sizing
    // makes it the cell's final width whatever the app's box-sizing is.
    const widths = Array.from(cells, (cell) => cell.getBoundingClientRect().width);
    widths.forEach((width, i) => {
      cells[i]!.style.boxSizing = "border-box";
      cells[i]!.style.width = `${width}px`;
    });
    table.style.tableLayout = "fixed";
    table.classList.add(PINNED);
    frozenWidth = table.parentElement?.clientWidth ?? 0;
  }

  // Each rendered row is observed, so any row changing height, even when
  // another changes by the opposite amount and the body keeps its size,
  // measures the rows again.
  let rowObserver: ResizeObserver | undefined;
  let watched = new Set<Element>();
  function watchRows(rows: Element[]): void {
    if (!rowObserver) return;
    const next = new Set(rows);
    for (const el of watched) if (!next.has(el)) rowObserver.unobserve(el);
    for (const el of next) if (!watched.has(el)) rowObserver.observe(el);
    watched = next;
  }

  // Read rendered row heights, from the gap between consecutive row tops so
  // collapsed borders are counted once, and number the rows for assistive
  // technology, which only sees the rendered ones.
  function measureRows(): void {
    if (!body) return;
    const table = body.parentElement as HTMLTableElement;
    table.setAttribute("aria-rowcount", String(items.length + 1));
    // An empty table shows only the `empty` row, which neither measures a
    // data row nor should decide the column widths.
    if (items.length === 0) return watchRows([]);
    // The rendered window lies between the top and end spacers; sampled rows
    // after the end spacer only exist while the columns are pinned.
    const rows: HTMLTableRowElement[] = [];
    for (const tr of body.rows) {
      if (tr.classList.contains(END)) break;
      if (!tr.classList.contains(SPACER)) rows.push(tr);
    }
    watchRows(rows);
    // The samples alone can pin the columns, before any row is on screen.
    const headerCells = table.tHead?.rows[0]?.cells.length ?? 0;
    if (frozenWidth < 0 || headerCells !== columns) requestPin();
    if (rows.length === 0) return;
    const tops = rows.map((tr) => tr.getBoundingClientRect().top);
    let changed = false;
    rows.forEach((tr, i) => {
      const index = slice.start + i;
      tr.setAttribute("aria-rowindex", String(index + 2));
      const next = tops[i + 1];
      const h = next === undefined ? tr.getBoundingClientRect().height : next - tops[i]!;
      if (h > 0 && measured.get(index) !== h) {
        measured.set(index, h);
        changed = true;
      }
    });
    if (changed) measureVersion += 1;
  }

  $effect(() => {
    void slice;
    untrack(measureRows);
  });

  /** Measure the rows and recompute which are visible. Call it after a
   * layout change that neither scrolls nor resizes the scroller, such as
   * content above the table collapsing. */
  export function refresh(): void {
    measureRows();
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
      const width = wrapper.clientWidth;
      if (frozenWidth >= 0 && width !== frozenWidth) requestPin();
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
    rowObserver = new ResizeObserver(schedule);
    // Adding or removing a column changes neither the rows nor the sizes
    // observed above, but the pinned widths and spacer colspans must follow.
    const headerRow = (body.parentElement as HTMLTableElement).tHead?.rows[0];
    const columnsChanged = new MutationObserver(() => {
      columns = Math.max(1, headerRow?.cells.length ?? 1);
      if (frozenWidth >= 0) requestPin();
      measureRows();
    });
    if (headerRow) columnsChanged.observe(headerRow, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
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
  <tr class={[SPACER, END]} aria-hidden="true" style={SPACER_ROW}>
    <td colspan={columns} style={SPACER_CELL} style:height="{bottomPad}px"></td>
  </tr>
  {#if sampling}
    {#each samples as index (rowKey(items[index]!, index))}
      {@render row(items[index]!, index)}
    {/each}
  {/if}
</Table>

<style>
  /* A pinned column no longer widens for a long value that scrolls in
   * later, so its text breaks anywhere rather than spilling into the next
   * cell. */
  :global(.kit-virtual-table--pinned td) {
    overflow-wrap: anywhere;
  }

  :global(.kit-table tbody > tr.kit-virtual-table__end ~ tr) {
    visibility: collapse;
  }
</style>
