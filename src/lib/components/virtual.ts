/**
 * Pure windowing math for VirtualList — separated so the slice logic is
 * unit-testable without a DOM. One O(count) pass per call; at the list
 * sizes this library targets (tens of thousands of rows) that is well
 * under a millisecond and beats maintaining an incremental prefix tree.
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
}: VirtualSliceInput): VirtualSlice {
  const top = Math.max(0, scrollTop);
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

/** Offset of a row's top edge from the top of the list. */
export function offsetOfIndex(
  index: number,
  count: number,
  heightOf: (index: number) => number,
): number {
  let offset = 0;
  const clamped = Math.min(Math.max(0, index), count);
  for (let i = 0; i < clamped; i += 1) offset += heightOf(i);
  return offset;
}
