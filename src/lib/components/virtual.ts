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
