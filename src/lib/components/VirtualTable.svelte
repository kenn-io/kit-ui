<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { untrack } from "svelte";
  import Table from "./Table.svelte";
  import { virtualSlice, visibleWindow, type VerticalBounds } from "./virtual.js";

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
    /** Height guess in px for rows not yet rendered; replaced by the
     * average of measured rows once any have rendered. */
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
    estimateRowHeight = 36,
    overscan = 8,
    stickyHeader = true,
    zebra = true,
    ariaLabel = undefined,
    unsorted = false,
    class: className = "",
  }: Props = $props();

  const SPACER = "kit-virtual-table__spacer";
  const PINNED = "kit-virtual-table--pinned";
  const SPACER_ROW = "border: 0; background: none;";
  const SPACER_CELL = "padding: 0; border: 0;";

  let body: HTMLTableSectionElement | undefined;
  let scrollTop = $state(0);
  let viewport = $state(0);
  let columns = $state(1);

  // Row heights by index, valid only for the `items` array they were taken
  // from (sorting or filtering reuses indexes for other rows). The Map is not
  // reactive; `measureVersion` signals that it changed.
  const measured = new Map<number, number>();
  let measureVersion = $state(0);
  let measuredFor: T[] | undefined;
  // Running average over every row measured so far, kept across item
  // changes: rows of one table are usually alike, so it beats a fixed guess.
  let measuredTotal = 0;
  let measuredCount = 0;

  const heightOf = (index: number): number => {
    const h =
      measured.get(index) ??
      (measuredCount > 0 ? measuredTotal / measuredCount : estimateRowHeight);
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

  // Every ancestor that clips the body vertically, nearest first. The nearest scroll
  // container, whether the table's own wrapper or the page, is among them.
  let clips: Element[] = [];
  function collectClips(): void {
    clips = [];
    for (let el = body?.parentElement ?? null; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      // Only a vertical clip limits which rows show. A horizontal-only clip
      // leaves overflow-y visible; any other horizontal overflow forces
      // overflow-y off visible too, so this one axis catches every case.
      if (style.overflowY !== "visible") clips.push(el);
    }
  }

  function updateWindow(): void {
    if (!body) return;
    const bounds: VerticalBounds[] = clips.map((el) => el.getBoundingClientRect());
    const next = visibleWindow(body.getBoundingClientRect().top, bounds, window.innerHeight);
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
    // Only data rows may decide the widths. Without any rendered (an empty
    // list, or a window scrolled out of view), stay unpinned until rows
    // render and measureRows pins them.
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

  // Read rendered row heights, from the gap between consecutive row tops so
  // collapsed borders are counted once, and number the rows for assistive
  // technology, which only sees the rendered ones.
  function measureRows(): void {
    if (!body) return;
    const table = body.parentElement as HTMLTableElement;
    table.setAttribute("aria-rowcount", String(items.length + 1));
    // An empty table shows only the `empty` row, which neither measures a
    // data row nor should decide the column widths.
    if (items.length === 0) return;
    const rows = Array.from(body.rows).filter((tr) => !tr.classList.contains(SPACER));
    if (rows.length === 0) return;
    const headerCells = table.tHead?.rows[0]?.cells.length ?? 0;
    if (frozenWidth < 0 || headerCells !== columns) freezeColumns();
    watchRows(rows);
    const tops = rows.map((tr) => tr.getBoundingClientRect().top);
    let changed = false;
    rows.forEach((tr, i) => {
      const index = slice.start + i;
      tr.setAttribute("aria-rowindex", String(index + 2));
      const next = tops[i + 1];
      const h = next === undefined ? tr.getBoundingClientRect().height : next - tops[i]!;
      const previous = measured.get(index);
      if (h > 0 && previous !== h) {
        measured.set(index, h);
        measuredTotal += h - (previous ?? 0);
        if (previous === undefined) measuredCount += 1;
        changed = true;
      }
    });
    if (changed) measureVersion += 1;
  }

  // The rendered rows cover the visible area after every update. When the
  // table moves without a scroll or a resize (content collapsing inside a
  // fixed-height scroller), the rows on screen leave view, or an edge row
  // fully enters it, or the body enters view, and the window follows.
  // Watching every rendered row, not only the edges, catches a move large
  // enough to carry the whole window past the screen.
  let rowObserver: IntersectionObserver | undefined;
  let watched = new Set<Element>();
  function watchRows(rows: Element[]): void {
    if (!rowObserver) return;
    const next = new Set(rows);
    for (const el of watched) if (!next.has(el)) rowObserver.unobserve(el);
    for (const el of next) if (!watched.has(el)) rowObserver.observe(el);
    watched = next;
  }

  $effect(() => {
    void slice;
    untrack(measureRows);
  });

  function track(spacer: HTMLTableRowElement) {
    body = spacer.parentElement as HTMLTableSectionElement;
    const wrapper = body.parentElement?.parentElement;
    const resized = () => {
      collectClips();
      observeAncestors();
      const width = wrapper?.clientWidth ?? 0;
      if (frozenWidth >= 0 && width !== frozenWidth) freezeColumns();
      measureRows();
      updateWindow();
    };
    untrack(() => {
      collectClips();
      updateWindow();
    });
    // Capture sees scrolls of every ancestor, not only the window's. The
    // window updates in the scroll event itself, before the next paint, so
    // overscan only has to cover what the compositor scrolls ahead.
    window.addEventListener("scroll", updateWindow, { capture: true, passive: true });
    window.addEventListener("resize", resized);
    // Re-laying out inside the observer's callback would resize what it
    // observes in the same frame (a "ResizeObserver loop" error), so the work
    // waits for the next frame.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame === 0)
        frame = requestAnimationFrame(() => {
          frame = 0;
          resized();
        });
    });
    if (wrapper) observer.observe(wrapper);
    observer.observe(body);
    // The table can move into view without resizing itself or the window:
    // a scroller above it grows (a panel closing), or content before it
    // collapses. Either resizes some ancestor, so every ancestor up to the
    // root is observed.
    const observeAncestors = () => {
      for (let el = body?.parentElement?.parentElement ?? null; el; el = el.parentElement) {
        observer.observe(el);
      }
    };
    observeAncestors();
    // Environments without layout (jsdom) have no IntersectionObserver.
    if (typeof IntersectionObserver !== "undefined") {
      rowObserver = new IntersectionObserver(() => updateWindow(), { threshold: [0, 1] });
      // With no rows rendered (a window scrolled out of view and no
      // overscan), the body entering view covers it.
      rowObserver.observe(body);
    }
    // Adding or removing a column changes neither the rows nor the sizes
    // observed above, but the pinned widths and spacer colspans must follow.
    const headerRow = (body.parentElement as HTMLTableElement).tHead?.rows[0];
    const columnsChanged = new MutationObserver(() => {
      columns = Math.max(1, headerRow?.cells.length ?? 1);
      if (frozenWidth >= 0) freezeColumns();
      measureRows();
    });
    if (headerRow) columnsChanged.observe(headerRow, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateWindow, { capture: true });
      window.removeEventListener("resize", resized);
      observer.disconnect();
      columnsChanged.disconnect();
      rowObserver?.disconnect();
      rowObserver = undefined;
      watched = new Set();
      body = undefined;
    };
  }
</script>

<!-- Spacers stand in for the rows that are not rendered. Inline styles keep
     row styling (padding, borders, stripes, hover) from Table or the app off
     them. -->
<Table {header} {stickyHeader} {zebra} {ariaLabel} {unsorted} class={className}>
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

<style>
  /* A pinned column no longer widens for a long value that scrolls in
   * later, so its text breaks anywhere rather than spilling into the next
   * cell. */
  :global(.kit-virtual-table--pinned td) {
    overflow-wrap: anywhere;
  }
</style>
