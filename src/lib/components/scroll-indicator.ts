export interface ScrollIndicatorGeometry {
  scrollable: boolean;
  height: number;
  top: number;
}

const MIN_THUMB_HEIGHT = 24;

/** Thumb size/position for an overlay scroll indicator: proportional to the
 * visible fraction (with a usable minimum) and clamped against overscroll. */
export function getScrollIndicatorGeometry(
  viewportHeight: number,
  contentHeight: number,
  scrollTop: number,
): ScrollIndicatorGeometry {
  if (viewportHeight <= 0 || contentHeight <= viewportHeight) {
    return { scrollable: false, height: 0, top: 0 };
  }

  // The minimum keeps the thumb grabbable-looking on long content, but it
  // must never exceed the track: a sub-24px viewport would otherwise get
  // negative travel and an off-track thumb.
  const height = Math.min(
    viewportHeight,
    Math.max(MIN_THUMB_HEIGHT, (viewportHeight * viewportHeight) / contentHeight),
  );
  const scrollRange = contentHeight - viewportHeight;
  const travel = viewportHeight - height;
  const clampedScrollTop = Math.min(Math.max(scrollTop, 0), scrollRange);

  return {
    scrollable: true,
    height,
    top: travel <= 0 ? 0 : (clampedScrollTop / scrollRange) * travel,
  };
}
