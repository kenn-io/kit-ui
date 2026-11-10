/**
 * Pure windowing math for VirtualList — separated so the slice logic is
 * unit-testable without a DOM. One O(count) pass per call; at the list
 * sizes this library targets (tens of thousands of rows) that is well
 * under a millisecond and beats maintaining an incremental prefix tree.
 * Uniform-height lists skip the pass entirely via `fixedHeight`.
 */

export interface VirtualSliceInput {
  /** Scroll offset of the viewport within the list. */
  scrollTop: number;
  /** Viewport height in px. */
  viewport: number;
  /** Total row count. */
  count: number;
  /** Extra rows rendered on each side of the visible range. */
  overscan?: number;
  /** Height of row `index` in px (fixed value, measurement, or estimate). */
  heightOf: (index: number) => number;
  /** Uniform row height in px (must be > 0). When the caller can
   * guarantee every row is exactly this tall the slice is computed in
   * O(1) and `heightOf` is never called. */
  fixedHeight?: number;
}

export interface VirtualSlice {
  /** First rendered row (inclusive). */
  start: number;
  /** One past the last rendered row (exclusive). */
  end: number;
  /** Offset of row `start` from the top of the list, in px. */
  topPad: number;
  /** Height of the entire list, in px. */
  totalHeight: number;
}

export function virtualSlice({
  scrollTop,
  viewport,
  count,
  overscan = 4,
  heightOf,
  fixedHeight,
}: VirtualSliceInput): VirtualSlice {
  const top = Math.max(0, scrollTop);

  if (fixedHeight !== undefined) {
    // Closed forms of the general pass below with heightOf ≡ fixedHeight:
    // start is the first row whose bottom edge passes `top`, end the first
    // whose top edge reaches the viewport bottom (both clamped to count,
    // matching the loop running off the end when scrolled past it).
    const h = fixedHeight;
    let start = Math.min(count, Math.floor(top / h));
    let end = Math.min(count, Math.ceil((top + viewport) / h));
    start = Math.max(0, start - overscan);
    end = Math.min(count, Math.max(end + overscan, start));
    return { start, end, topPad: start * h, totalHeight: count * h };
  }

  let offset = 0;
  let start = count;
  let topPad = 0;
  let end = count;
  let startFound = false;
  let endFound = false;

  for (let i = 0; i < count; i += 1) {
    const h = heightOf(i);
    if (!startFound && offset + h > top) {
      start = i;
      topPad = offset;
      startFound = true;
    }
    if (!endFound && offset >= top + viewport) {
      end = i;
      endFound = true;
    }
    offset += h;
  }

  if (!startFound) topPad = offset;

  // Overscan: widen the window so fast scrolling shows content, not blank.
  const widenedStart = Math.max(0, start - overscan);
  for (let i = widenedStart; i < start; i += 1) topPad -= heightOf(i);
  start = widenedStart;
  end = Math.min(count, Math.max(end + overscan, start));

  return { start, end, topPad, totalHeight: offset };
}

/** Offset of a row's top edge from the top of the list. `fixedHeight`
 * carries the same uniform-height contract as in {@link VirtualSliceInput}. */
export function offsetOfIndex(
  index: number,
  count: number,
  heightOf: (index: number) => number,
  fixedHeight?: number,
): number {
  const clamped = Math.min(Math.max(0, index), count);
  if (fixedHeight !== undefined) return clamped * fixedHeight;
  let offset = 0;
  for (let i = 0; i < clamped; i += 1) offset += heightOf(i);
  return offset;
}

/** Measured heights of a virtualized list's rows. With row keys they are
 * kept by key, so a row keeps its height when rows are inserted,
 * removed, reordered, or appended around it, and heights of rows no longer
 * in the list are dropped. Without one they are kept by index, and a new
 * items array drops them all, since an index may now name another row. */
export class RowHeights<T> {
  #heights = new Map<unknown, number>();
  #items: readonly T[] | undefined;
  // Every row's key, in order; undefined when rows are keyed by index.
  #keys: readonly unknown[] | undefined;

  /** Follow the list's current items. `keys` holds every row's key in
   * order, for rows that have keys; pass a new array whenever a key may have
   * changed, including after `items` changed in place (a push or splice on a
   * reactive array). Without `keys`, rows are keyed by index and only a new
   * items array counts. Returns whether every height was dropped, which
   * happens for a new array of rows keyed by index. */
  sync(items: readonly T[], keys?: readonly unknown[]): boolean {
    const keyedBefore = this.#keys !== undefined;
    if (keys ? keys === this.#keys : !keyedBefore && items === this.#items) return false;
    const before = this.#items;
    this.#items = items;
    this.#keys = keys;
    if (keys && keyedBefore) {
      const live = new Set(keys);
      for (const key of this.#heights.keys()) if (!live.has(key)) this.#heights.delete(key);
      return false;
    }
    this.#heights.clear();
    return before !== undefined;
  }

  /** The key row `index` is measured under. */
  keyOf(index: number): unknown {
    return this.#keys ? this.#keys[index] : index;
  }

  /** Row `index`'s measured height, or undefined before it is measured. */
  get(index: number): number | undefined {
    return this.#heights.get(this.keyOf(index));
  }

  /** Record row `index`'s height. Returns whether it changed. */
  set(index: number, height: number): boolean {
    const key = this.keyOf(index);
    if (this.#heights.get(key) === height) return false;
    this.#heights.set(key, height);
    return true;
  }
}

/** A box's vertical extent in viewport coordinates. */
export interface VerticalBounds {
  top: number;
  bottom: number;
}

/** Scroll offset and viewport height of a list body, in the body's own
 * coordinates, for virtualizing a list that does not own its scroll
 * container (VirtualTable). `bodyTop` is the body's top edge and `view` the
 * scroller's visible area (its client box, or the window for the document),
 * both in viewport coordinates. The result feeds {@link virtualSlice}. */
export function visibleWindow(
  bodyTop: number,
  view: VerticalBounds,
): { scrollTop: number; viewport: number } {
  return {
    scrollTop: Math.max(0, view.top - bodyTop),
    viewport: Math.max(0, view.bottom - Math.max(view.top, bodyTop)),
  };
}

/** The element that scrolls `el` vertically: its nearest ancestor with
 * `overflow-y` auto, scroll, or overlay, or the document's scrolling element
 * when none is. Used for tables whose rows the page scrolls. */
export function scrollerOf(el: Element): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") return node;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}
