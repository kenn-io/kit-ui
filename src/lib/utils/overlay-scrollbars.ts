import type { Attachment } from "svelte/attachments";

export type OverlayScrollbarAxis = "x" | "y" | "both";
export type OverlayScrollbarVisibility = "auto" | "always" | "never";

export type OverlayScrollbarInset =
  | number
  | HTMLElement
  | null
  | undefined
  | (() => number | HTMLElement | null | undefined);

export interface OverlayScrollbarsOptions {
  /** Which axes render overlay scrollbar tracks. Default `"both"`. */
  axis?: OverlayScrollbarAxis;
  /** When thumbs show: `"auto"` (on hover, scroll, or drag), `"always"`
   * (while overflowing), or `"never"` (suppress native scrollbars with no
   * overlay thumbs). Default `"auto"`. */
  visibility?: OverlayScrollbarVisibility;
  /** Extra top inset in px for the vertical track (e.g. below a sticky
   * header), or an element / getter whose height sets the inset (such as a
   * sticky `<thead>`). */
  insetTop?: OverlayScrollbarInset;
  /** Extra bottom inset in px for the vertical track. */
  insetBottom?: OverlayScrollbarInset;
  /** Extra left inset in px for the horizontal track. */
  insetLeft?: OverlayScrollbarInset;
  /** Extra right inset in px for the horizontal track. */
  insetRight?: OverlayScrollbarInset;
  /** Non-scrolling outer frame that holds the overlay tracks. When provided,
   * tracks mount inside `host` (zero scroll jitter and no extra children in
   * the scrolling viewport) aligned to the viewport's box inside `host`. */
  host?: HTMLElement | null | (() => HTMLElement | null | undefined);
  /** Corner clearance in px, or `"auto"` (default) to read computed border
   * radii from the frame/viewport so thumbs stay clear of rounded corners. */
  cornerRadius?: number | "auto";
  /** Delay in ms before thumbs fade out after scrolling stops while not
   * hovered or dragging. Default `900`. */
  hideDelay?: number;
}

export interface ThumbMetrics {
  /** Whether this axis overflows and has room to render a thumb. */
  visible: boolean;
  /** Thumb length along the scroll axis, in px. */
  size: number;
  /** Thumb offset from the start of the track, in px. */
  offset: number;
}

export interface TrackBounds {
  /** Offset from the viewport's leading edge along the scroll axis, in px. */
  start: number;
  /** Total track length along the scroll axis, in px. */
  length: number;
}

const DEFAULT_TRACK_SIZE = 10;
const DEFAULT_EDGE_INSET = 2;
const DEFAULT_MIN_THUMB = 28;
const DEFAULT_HIDE_DELAY_MS = 900;
const MIN_TRACK_LENGTH = 8;
const OVERFLOW_EPSILON = 1;

/** Compute thumb length and position along one axis. */
export function computeThumbMetrics(params: {
  scrollSize: number;
  clientSize: number;
  scrollPos: number;
  trackLength: number;
  minThumbSize: number;
}): ThumbMetrics {
  const { scrollSize, clientSize, scrollPos, trackLength, minThumbSize } = params;
  const maxScroll = scrollSize - clientSize;
  if (maxScroll <= OVERFLOW_EPSILON || clientSize <= 0 || trackLength < MIN_TRACK_LENGTH) {
    return { visible: false, size: 0, offset: 0 };
  }
  const rawSize = (clientSize / scrollSize) * trackLength;
  const minSize = Math.min(minThumbSize, trackLength);
  const size = Math.min(trackLength, Math.max(minSize, rawSize));
  const maxOffset = Math.max(0, trackLength - size);
  const ratio = Math.min(1, Math.max(0, scrollPos / maxScroll));
  return { visible: true, size, offset: ratio * maxOffset };
}

/** Map a pointer drag delta along the track back to a clamped scroll offset. */
export function scrollPosForThumbDelta(params: {
  startScrollPos: number;
  deltaPx: number;
  scrollSize: number;
  clientSize: number;
  trackLength: number;
  thumbSize: number;
}): number {
  const maxScroll = Math.max(0, params.scrollSize - params.clientSize);
  const maxOffset = Math.max(0, params.trackLength - params.thumbSize);
  if (maxScroll <= 0 || maxOffset <= 0) return 0;
  const next = params.startScrollPos + (params.deltaPx / maxOffset) * maxScroll;
  return Math.min(maxScroll, Math.max(0, next));
}

/** Map a pointer click inside the track to the scroll offset that centers the
 * thumb under the pointer. */
export function scrollPosForTrackClick(params: {
  clickOffsetInTrack: number;
  scrollSize: number;
  clientSize: number;
  trackLength: number;
  thumbSize: number;
}): number {
  const maxScroll = Math.max(0, params.scrollSize - params.clientSize);
  const maxOffset = Math.max(0, params.trackLength - params.thumbSize);
  if (maxScroll <= 0 || maxOffset <= 0) return 0;
  const targetOffset = Math.min(
    maxOffset,
    Math.max(0, params.clickOffsetInTrack - params.thumbSize / 2),
  );
  return (targetOffset / maxOffset) * maxScroll;
}

/** Compute track start and length along one axis, clearing edge insets,
 * explicit insets (such as a sticky header), rounded corners, and the
 * perpendicular track when both axes overflow. */
export function computeTrackBounds(params: {
  viewportLength: number;
  edgeInset: number;
  startInset: number;
  endInset: number;
  startCornerRadius: number;
  endCornerRadius: number;
  reserveEndForOtherAxis: number;
}): TrackBounds {
  const {
    viewportLength,
    edgeInset,
    startInset,
    endInset,
    startCornerRadius,
    endCornerRadius,
    reserveEndForOtherAxis,
  } = params;
  const start = Math.max(edgeInset + startInset, startCornerRadius);
  const end = Math.max(edgeInset + endInset, endCornerRadius, reserveEndForOtherAxis);
  const length = Math.max(0, viewportLength - start - end);
  return { start, length };
}

/** Convert wheel event deltas in pixel (0), line (1), or page (2) units into
 * CSS pixels for forwarding wheel input over host-mounted scrollbar tracks. */
export function wheelDeltaToPixels(params: {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  lineHeight: number;
  pageWidth: number;
  pageHeight: number;
}): { dx: number; dy: number } {
  const { deltaX, deltaY, deltaMode, lineHeight, pageWidth, pageHeight } = params;
  if (deltaMode === 1) {
    return { dx: deltaX * lineHeight, dy: deltaY * lineHeight };
  }
  if (deltaMode === 2) {
    return { dx: deltaX * pageWidth, dy: deltaY * pageHeight };
  }
  return { dx: deltaX, dy: deltaY };
}

function isScrollableOverflow(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

function isContainedOverscroll(value: string): boolean {
  return value === "contain" || value === "none";
}

const hostRefCounts = new WeakMap<HTMLElement, number>();

function acquireHostAttr(host: HTMLElement): void {
  const count = hostRefCounts.get(host) ?? 0;
  hostRefCounts.set(host, count + 1);
  if (count === 0) host.setAttribute("data-kit-overlay-scroll-host", "");
}

function releaseHostAttr(host: HTMLElement): void {
  const count = (hostRefCounts.get(host) ?? 1) - 1;
  if (count <= 0) {
    hostRefCounts.delete(host);
    host.removeAttribute("data-kit-overlay-scroll-host");
  } else {
    hostRefCounts.set(host, count);
  }
}

function zoomOf(el: HTMLElement): number {
  const zoom = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  return typeof zoom === "number" && Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function parsePx(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveInset(
  inset: OverlayScrollbarInset | undefined,
  zoom: number,
): { px: number; element: HTMLElement | null } {
  const resolved = typeof inset === "function" ? inset() : inset;
  if (typeof resolved === "number") {
    return { px: Number.isFinite(resolved) ? Math.max(0, resolved) : 0, element: null };
  }
  if (resolved instanceof HTMLElement) {
    const rectHeight = resolved.getBoundingClientRect().height / zoom;
    const height = rectHeight > 0 ? rectHeight : resolved.offsetHeight;
    return { px: Math.max(0, height), element: resolved };
  }
  return { px: 0, element: null };
}

interface CornerRadii {
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

function readElementCorners(
  el: HTMLElement,
  vpRect: DOMRect,
  zoom: number,
  checkFlush: boolean,
): CornerRadii {
  const style = getComputedStyle(el);
  const topRightRaw = parsePx(style.borderTopRightRadius, 0);
  const bottomRightRaw = parsePx(style.borderBottomRightRadius, 0);
  const bottomLeftRaw = parsePx(style.borderBottomLeftRadius, 0);
  if (topRightRaw <= 0 && bottomRightRaw <= 0 && bottomLeftRaw <= 0) {
    return { topRight: 0, bottomRight: 0, bottomLeft: 0 };
  }

  const borderTop = parsePx(style.borderTopWidth, 0);
  const borderRight = parsePx(style.borderRightWidth, 0);
  const borderBottom = parsePx(style.borderBottomWidth, 0);
  const borderLeft = parsePx(style.borderLeftWidth, 0);

  if (!checkFlush) {
    return {
      topRight: Math.max(0, topRightRaw - Math.max(borderTop, borderRight)),
      bottomRight: Math.max(0, bottomRightRaw - Math.max(borderBottom, borderRight)),
      bottomLeft: Math.max(0, bottomLeftRaw - Math.max(borderBottom, borderLeft)),
    };
  }

  const rect = el.getBoundingClientRect();
  const topGap = Math.abs((vpRect.top - rect.top) / zoom - borderTop);
  const rightGap = Math.abs((rect.right - vpRect.right) / zoom - borderRight);
  const bottomGap = Math.abs((rect.bottom - vpRect.bottom) / zoom - borderBottom);
  const leftGap = Math.abs((vpRect.left - rect.left) / zoom - borderLeft);
  const flush = 2;

  return {
    topRight:
      topGap <= flush && rightGap <= flush
        ? Math.max(0, topRightRaw - Math.max(borderTop, borderRight))
        : 0,
    bottomRight:
      bottomGap <= flush && rightGap <= flush
        ? Math.max(0, bottomRightRaw - Math.max(borderBottom, borderRight))
        : 0,
    bottomLeft:
      bottomGap <= flush && leftGap <= flush
        ? Math.max(0, bottomLeftRaw - Math.max(borderBottom, borderLeft))
        : 0,
  };
}

function readCornerRadii(
  viewport: HTMLElement,
  host: HTMLElement | null,
  vpRect: DOMRect,
  zoom: number,
  option: number | "auto",
): CornerRadii {
  if (typeof option === "number") {
    const r = Number.isFinite(option) ? Math.max(0, option) : 0;
    return { topRight: r, bottomRight: r, bottomLeft: r };
  }
  const own = readElementCorners(viewport, vpRect, zoom, false);
  let topRight = own.topRight;
  let bottomRight = own.bottomRight;
  let bottomLeft = own.bottomLeft;

  const frame = host ?? viewport;
  if (host && host !== viewport) {
    const fromHost = readElementCorners(host, vpRect, zoom, true);
    topRight = Math.max(topRight, fromHost.topRight);
    bottomRight = Math.max(bottomRight, fromHost.bottomRight);
    bottomLeft = Math.max(bottomLeft, fromHost.bottomLeft);
  }

  // Also clear a clipping parent's rounded corners (e.g. a Table or ScrollBox
  // placed flush inside a rounded Card or host container).
  const parent = frame.parentElement;
  if (parent) {
    const pStyle = getComputedStyle(parent);
    if (
      pStyle.overflowX === "hidden" ||
      pStyle.overflowX === "clip" ||
      pStyle.overflowY === "hidden" ||
      pStyle.overflowY === "clip"
    ) {
      const fromParent = readElementCorners(parent, vpRect, zoom, true);
      topRight = Math.max(topRight, fromParent.topRight);
      bottomRight = Math.max(bottomRight, fromParent.bottomRight);
      bottomLeft = Math.max(bottomLeft, fromParent.bottomLeft);
    }
  }

  return { topRight, bottomRight, bottomLeft };
}

/**
 * Svelte 5 attachment that replaces native scrollbars with zero-gutter floating
 * overlay scrollbars while keeping native wheel, trackpad, touch, keyboard,
 * scroll-anchoring, and programmatic scrolling intact.
 *
 * Attach to the scrolling element:
 * `<div class="panel" {@attach overlayScrollbars()}>…</div>`
 *
 * When a non-scrolling outer frame exists, pass it as `host` so tracks mount
 * outside the scrolling element (zero compositor jitter, no extra children
 * inside the viewport):
 * `<div bind:this={frame}><div class="viewport" {@attach overlayScrollbars({ host: () => frame })}>…</div></div>`
 */
export function overlayScrollbars(options: OverlayScrollbarsOptions = {}): Attachment<HTMLElement> {
  return (viewport) => {
    const axis = options.axis ?? "both";
    const visibility = options.visibility ?? "auto";
    const cornerRadius = options.cornerRadius ?? "auto";
    const hideDelay = options.hideDelay ?? DEFAULT_HIDE_DELAY_MS;
    const allowY = axis === "y" || axis === "both";
    const allowX = axis === "x" || axis === "both";

    const hasHostOption = "host" in options;
    const resolvedHost = typeof options.host === "function" ? options.host() : options.host;
    if (hasHostOption && resolvedHost == null) {
      // Caller passed a reactive host ref (e.g. `host: frameEl` from bind:this)
      // that has not bound yet; suppress native scrollbars now and wait for
      // Svelte to re-run this attachment once the host element binds.
      viewport.setAttribute("data-kit-overlay-scroll-viewport", "");
      return () => {
        viewport.removeAttribute("data-kit-overlay-scroll-viewport");
      };
    }
    const host =
      resolvedHost instanceof HTMLElement && resolvedHost !== viewport ? resolvedHost : null;
    const selfMode = host === null;
    const hoverTarget = host ?? viewport;

    viewport.setAttribute("data-kit-overlay-scroll-viewport", "");
    if (host) {
      acquireHostAttr(host);
    } else {
      viewport.setAttribute("data-kit-overlay-scroll-self", "");
    }

    if (visibility === "never") {
      return () => {
        viewport.removeAttribute("data-kit-overlay-scroll-viewport");
        if (host) releaseHostAttr(host);
        else viewport.removeAttribute("data-kit-overlay-scroll-self");
      };
    }

    function createTrack(kind: "x" | "y"): { track: HTMLDivElement; thumb: HTMLDivElement } {
      const track = document.createElement("div");
      track.className = `kit-scrollbar kit-scrollbar--${kind}`;
      track.setAttribute("aria-hidden", "true");
      track.setAttribute("role", "presentation");
      track.dataset["kitScrollbar"] = kind;

      const thumb = document.createElement("div");
      thumb.className = "kit-scrollbar__thumb";
      thumb.dataset["kitScrollbarThumb"] = kind;
      track.append(thumb);
      return { track, thumb };
    }

    const yTrack = allowY ? createTrack("y") : null;
    const xTrack = allowX ? createTrack("x") : null;

    const mountContainer = host ?? viewport;
    if (host) {
      if (yTrack) mountContainer.append(yTrack.track);
      if (xTrack) mountContainer.append(xTrack.track);
    }

    let hovered = false;
    let scrolling = false;
    let draggingAxis: "x" | "y" | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;

    let metricsY: ThumbMetrics = { visible: false, size: 0, offset: 0 };
    let metricsX: ThumbMetrics = { visible: false, size: 0, offset: 0 };
    let trackLenY = 0;
    let trackLenX = 0;

    let observedInsetEls = new Set<HTMLElement>();
    let observedChildren = new Set<Element>();

    function syncTrackVisibility(): void {
      const show = visibility === "always" || hovered || scrolling || draggingAxis !== null;
      if (yTrack) {
        const active = metricsY.visible;
        if (selfMode) {
          if (active && yTrack.track.parentElement !== viewport) viewport.append(yTrack.track);
          else if (!active && yTrack.track.parentElement === viewport) yTrack.track.remove();
        }
        const visible = active && show;
        const nextAttr = visible ? "true" : "false";
        if (yTrack.track.dataset["visible"] !== nextAttr) {
          yTrack.track.dataset["visible"] = nextAttr;
        }
        const nextDragging = draggingAxis === "y" ? "true" : "false";
        if (yTrack.track.dataset["dragging"] !== nextDragging) {
          yTrack.track.dataset["dragging"] = nextDragging;
        }
      }
      if (xTrack) {
        const active = metricsX.visible;
        if (selfMode) {
          if (active && xTrack.track.parentElement !== viewport) viewport.append(xTrack.track);
          else if (!active && xTrack.track.parentElement === viewport) xTrack.track.remove();
        }
        const visible = active && show;
        const nextAttr = visible ? "true" : "false";
        if (xTrack.track.dataset["visible"] !== nextAttr) {
          xTrack.track.dataset["visible"] = nextAttr;
        }
        const nextDragging = draggingAxis === "x" ? "true" : "false";
        if (xTrack.track.dataset["dragging"] !== nextDragging) {
          xTrack.track.dataset["dragging"] = nextDragging;
        }
      }
    }

    function setStyleIfChanged(
      el: HTMLElement,
      prop: "top" | "left" | "width" | "height" | "transform",
      value: string,
    ): void {
      if (el.style[prop] !== value) el.style[prop] = value;
    }

    function collapseSelfTrack(pair: { track: HTMLDivElement } | null): void {
      if (!pair || pair.track.parentElement !== viewport) return;
      pair.track.style.top = "0px";
      pair.track.style.left = "0px";
      pair.track.style.width = "0px";
      pair.track.style.height = "0px";
    }

    function update(): void {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      const vpW = viewport.clientWidth;
      const vpH = viewport.clientHeight;
      if (vpW <= 0 || vpH <= 0) {
        metricsY = { visible: false, size: 0, offset: 0 };
        metricsX = { visible: false, size: 0, offset: 0 };
        syncTrackVisibility();
        return;
      }

      // In self-mode, tracks are absolutely positioned inside `viewport`.
      // Collapse mounted tracks to (0, 0) before measuring so an old track
      // position never inflates `scrollWidth` / `scrollHeight` after content
      // shrinks, then clamp any scroll offset that now lies past the true end.
      if (selfMode) {
        collapseSelfTrack(yTrack);
        collapseSelfTrack(xTrack);
      }

      const zoom = zoomOf(viewport);
      const scrollW = viewport.scrollWidth;
      const scrollH = viewport.scrollHeight;
      const maxScrollX = Math.max(0, scrollW - vpW);
      const maxScrollY = Math.max(0, scrollH - vpH);

      if (selfMode) {
        if (viewport.scrollTop > maxScrollY) viewport.scrollTop = maxScrollY;
        if (viewport.scrollLeft > maxScrollX) viewport.scrollLeft = maxScrollX;
      }

      const hasY = allowY && maxScrollY > OVERFLOW_EPSILON;
      const hasX = allowX && maxScrollX > OVERFLOW_EPSILON;

      if (!hasY && !hasX) {
        metricsY = { visible: false, size: 0, offset: 0 };
        metricsX = { visible: false, size: 0, offset: 0 };
        syncTrackVisibility();
        return;
      }

      const style = getComputedStyle(viewport);
      const trackSize = parsePx(
        style.getPropertyValue("--scrollbar-track-size"),
        DEFAULT_TRACK_SIZE,
      );
      const edgeInset = parsePx(style.getPropertyValue("--scrollbar-inset"), DEFAULT_EDGE_INSET);
      const minThumb = parsePx(style.getPropertyValue("--scrollbar-min-thumb"), DEFAULT_MIN_THUMB);

      const topIn = resolveInset(options.insetTop, zoom);
      const bottomIn = resolveInset(options.insetBottom, zoom);
      const leftIn = resolveInset(options.insetLeft, zoom);
      const rightIn = resolveInset(options.insetRight, zoom);

      if (resizeObserver) {
        const nextInsetEls = new Set<HTMLElement>();
        for (const el of [topIn.element, bottomIn.element, leftIn.element, rightIn.element]) {
          if (el) nextInsetEls.add(el);
        }
        for (const el of observedInsetEls) {
          if (!nextInsetEls.has(el)) resizeObserver.unobserve(el);
        }
        for (const el of nextInsetEls) {
          if (!observedInsetEls.has(el)) resizeObserver.observe(el);
        }
        observedInsetEls = nextInsetEls;
      }

      const vpRect = viewport.getBoundingClientRect();
      const corners = readCornerRadii(viewport, host, vpRect, zoom, cornerRadius);

      let originLeft = 0;
      let originTop = 0;
      if (host) {
        const hostRect = host.getBoundingClientRect();
        originLeft = (vpRect.left - hostRect.left) / zoom - host.clientLeft + viewport.clientLeft;
        originTop = (vpRect.top - hostRect.top) / zoom - host.clientTop + viewport.clientTop;
      } else {
        originLeft = Math.min(maxScrollX, Math.max(0, viewport.scrollLeft));
        originTop = Math.min(maxScrollY, Math.max(0, viewport.scrollTop));
      }

      if (yTrack) {
        const boundsY = computeTrackBounds({
          viewportLength: vpH,
          edgeInset,
          startInset: topIn.px,
          endInset: bottomIn.px,
          startCornerRadius: corners.topRight,
          endCornerRadius: corners.bottomRight,
          reserveEndForOtherAxis: hasX ? trackSize + edgeInset : 0,
        });
        trackLenY = boundsY.length;
        metricsY = hasY
          ? computeThumbMetrics({
              scrollSize: scrollH,
              clientSize: vpH,
              scrollPos: viewport.scrollTop,
              trackLength: boundsY.length,
              minThumbSize: minThumb,
            })
          : { visible: false, size: 0, offset: 0 };

        if (metricsY.visible) {
          if (selfMode) setStyleIfChanged(yTrack.track, "width", "");
          setStyleIfChanged(yTrack.track, "top", `${originTop + boundsY.start}px`);
          setStyleIfChanged(yTrack.track, "left", `${originLeft + vpW - trackSize}px`);
          setStyleIfChanged(yTrack.track, "height", `${boundsY.length}px`);
          setStyleIfChanged(yTrack.thumb, "height", `${metricsY.size}px`);
          setStyleIfChanged(yTrack.thumb, "transform", `translate3d(0, ${metricsY.offset}px, 0)`);
        }
      }

      if (xTrack) {
        const boundsX = computeTrackBounds({
          viewportLength: vpW,
          edgeInset,
          startInset: leftIn.px,
          endInset: rightIn.px,
          startCornerRadius: corners.bottomLeft,
          endCornerRadius: corners.bottomRight,
          reserveEndForOtherAxis: hasY ? trackSize + edgeInset : 0,
        });
        trackLenX = boundsX.length;
        metricsX = hasX
          ? computeThumbMetrics({
              scrollSize: scrollW,
              clientSize: vpW,
              scrollPos: viewport.scrollLeft,
              trackLength: boundsX.length,
              minThumbSize: minThumb,
            })
          : { visible: false, size: 0, offset: 0 };

        if (metricsX.visible) {
          if (selfMode) setStyleIfChanged(xTrack.track, "height", "");
          setStyleIfChanged(xTrack.track, "top", `${originTop + vpH - trackSize}px`);
          setStyleIfChanged(xTrack.track, "left", `${originLeft + boundsX.start}px`);
          setStyleIfChanged(xTrack.track, "width", `${boundsX.length}px`);
          setStyleIfChanged(xTrack.thumb, "width", `${metricsX.size}px`);
          setStyleIfChanged(xTrack.thumb, "transform", `translate3d(${metricsX.offset}px, 0, 0)`);
        }
      }

      syncTrackVisibility();
    }

    function schedule(): void {
      if (!frame) frame = requestAnimationFrame(update);
    }

    function scheduleHide(): void {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        scrolling = false;
        syncTrackVisibility();
      }, hideDelay);
    }

    function onScroll(): void {
      scrolling = true;
      update();
      scheduleHide();
    }

    function onPointerEnter(event: PointerEvent): void {
      if (event.pointerType === "touch") return;
      hovered = true;
      update();
    }

    function onPointerLeave(event: PointerEvent): void {
      if (event.pointerType === "touch") return;
      hovered = false;
      syncTrackVisibility();
    }

    function wireTrack(
      kind: "x" | "y",
      pair: { track: HTMLDivElement; thumb: HTMLDivElement },
    ): () => void {
      const { track, thumb } = pair;
      let startPointer = 0;
      let startScroll = 0;
      let activePointerId: number | null = null;

      function startDrag(pointerId: number, clientCoord: number): void {
        const zoom = zoomOf(viewport);
        draggingAxis = kind;
        activePointerId = pointerId;
        startPointer = clientCoord / zoom;
        startScroll = kind === "y" ? viewport.scrollTop : viewport.scrollLeft;
        try {
          thumb.setPointerCapture(pointerId);
        } catch {
          // Synthetic PointerEvents in tests may not have an active pointer id.
        }
        syncTrackVisibility();
      }

      function onThumbPointerDown(event: PointerEvent): void {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        startDrag(event.pointerId, kind === "y" ? event.clientY : event.clientX);
      }

      function onTrackPointerDown(event: PointerEvent): void {
        if (event.button !== 0 || event.target !== track) return;
        event.preventDefault();
        event.stopPropagation();
        update();
        const zoom = zoomOf(viewport);
        const rect = track.getBoundingClientRect();
        const clickOffset =
          (kind === "y" ? event.clientY - rect.top : event.clientX - rect.left) / zoom;
        const metrics = kind === "y" ? metricsY : metricsX;
        const trackLength = kind === "y" ? trackLenY : trackLenX;
        const nextPos = scrollPosForTrackClick({
          clickOffsetInTrack: clickOffset,
          scrollSize: kind === "y" ? viewport.scrollHeight : viewport.scrollWidth,
          clientSize: kind === "y" ? viewport.clientHeight : viewport.clientWidth,
          trackLength,
          thumbSize: metrics.size,
        });
        if (kind === "y") viewport.scrollTop = nextPos;
        else viewport.scrollLeft = nextPos;
        update();
        startDrag(event.pointerId, kind === "y" ? event.clientY : event.clientX);
      }

      function onMouseDown(event: MouseEvent): void {
        // Prevent focus theft (e.g. Typeahead or CommandPalette search inputs)
        // when pressing a scrollbar track or thumb.
        if (event.button === 0) event.preventDefault();
      }

      function onPointerMove(event: PointerEvent): void {
        if (draggingAxis !== kind || activePointerId !== event.pointerId) return;
        const zoom = zoomOf(viewport);
        const deltaPx = (kind === "y" ? event.clientY : event.clientX) / zoom - startPointer;
        const metrics = kind === "y" ? metricsY : metricsX;
        const trackLength = kind === "y" ? trackLenY : trackLenX;
        const nextPos = scrollPosForThumbDelta({
          startScrollPos: startScroll,
          deltaPx,
          scrollSize: kind === "y" ? viewport.scrollHeight : viewport.scrollWidth,
          clientSize: kind === "y" ? viewport.clientHeight : viewport.clientWidth,
          trackLength,
          thumbSize: metrics.size,
        });
        if (kind === "y") viewport.scrollTop = nextPos;
        else viewport.scrollLeft = nextPos;
        update();
      }

      function endDrag(event: PointerEvent): void {
        if (draggingAxis !== kind || activePointerId !== event.pointerId) return;
        draggingAxis = null;
        activePointerId = null;
        try {
          if (thumb.hasPointerCapture(event.pointerId))
            thumb.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore if already released.
        }
        syncTrackVisibility();
        if (!hovered) scheduleHide();
      }

      function onTrackEnter(event: PointerEvent): void {
        if (event.pointerType === "touch") return;
        track.dataset["hover"] = "true";
      }

      function onTrackLeave(event: PointerEvent): void {
        if (event.pointerType === "touch") return;
        delete track.dataset["hover"];
      }

      function onTrackWheel(event: WheelEvent): void {
        if (event.defaultPrevented || event.ctrlKey || draggingAxis !== null) return;
        const style = getComputedStyle(viewport);
        const canScrollX = isScrollableOverflow(style.overflowX);
        const canScrollY = isScrollableOverflow(style.overflowY);
        const fontSize = parsePx(style.fontSize, 16);
        const lineHeight = parsePx(style.lineHeight, fontSize * 1.2);

        let { dx, dy } = wheelDeltaToPixels({
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          lineHeight,
          pageWidth: viewport.clientWidth,
          pageHeight: viewport.clientHeight,
        });

        const maxScrollX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const maxScrollY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        if (event.shiftKey && dx === 0 && dy !== 0 && canScrollX && maxScrollX > OVERFLOW_EPSILON) {
          dx = dy;
          dy = 0;
        }

        const applyX = canScrollX ? dx : 0;
        const applyY = canScrollY ? dy : 0;
        if (applyX === 0 && applyY === 0) return;

        const prevLeft = viewport.scrollLeft;
        const prevTop = viewport.scrollTop;
        if (typeof viewport.scrollBy === "function") {
          viewport.scrollBy({ left: applyX, top: applyY, behavior: "instant" });
        } else {
          viewport.scrollLeft = prevLeft + applyX;
          viewport.scrollTop = prevTop + applyY;
        }

        const moved = viewport.scrollLeft !== prevLeft || viewport.scrollTop !== prevTop;
        const contained =
          (applyY !== 0 &&
            maxScrollY > OVERFLOW_EPSILON &&
            isContainedOverscroll(style.overscrollBehaviorY)) ||
          (applyX !== 0 &&
            maxScrollX > OVERFLOW_EPSILON &&
            isContainedOverscroll(style.overscrollBehaviorX));

        if (moved || contained) event.preventDefault();
        if (moved) onScroll();
      }

      track.addEventListener("pointerdown", onTrackPointerDown);
      track.addEventListener("mousedown", onMouseDown);
      track.addEventListener("pointerenter", onTrackEnter);
      track.addEventListener("pointerleave", onTrackLeave);
      if (host) track.addEventListener("wheel", onTrackWheel, { passive: false });
      thumb.addEventListener("pointerdown", onThumbPointerDown);
      thumb.addEventListener("pointermove", onPointerMove);
      thumb.addEventListener("pointerup", endDrag);
      thumb.addEventListener("pointercancel", endDrag);
      thumb.addEventListener("lostpointercapture", endDrag);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);

      return () => {
        track.removeEventListener("pointerdown", onTrackPointerDown);
        track.removeEventListener("mousedown", onMouseDown);
        track.removeEventListener("pointerenter", onTrackEnter);
        track.removeEventListener("pointerleave", onTrackLeave);
        if (host) track.removeEventListener("wheel", onTrackWheel);
        thumb.removeEventListener("pointerdown", onThumbPointerDown);
        thumb.removeEventListener("pointermove", onPointerMove);
        thumb.removeEventListener("pointerup", endDrag);
        thumb.removeEventListener("pointercancel", endDrag);
        thumb.removeEventListener("lostpointercapture", endDrag);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
      };
    }

    const cleanups: (() => void)[] = [];
    if (yTrack) cleanups.push(wireTrack("y", yTrack));
    if (xTrack) cleanups.push(wireTrack("x", xTrack));

    const isOwnNode = (node: Node | null): boolean =>
      node !== null &&
      ((yTrack !== null && (node === yTrack.track || yTrack.track.contains(node))) ||
        (xTrack !== null && (node === xTrack.track || xTrack.track.contains(node))));

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;

    function syncObservedChildren(): void {
      if (!resizeObserver) return;
      const next = new Set<Element>();
      for (const child of viewport.children) {
        if (!isOwnNode(child)) next.add(child);
      }
      for (const child of observedChildren) {
        if (!next.has(child)) resizeObserver.unobserve(child);
      }
      for (const child of next) {
        if (!observedChildren.has(child)) resizeObserver.observe(child);
      }
      observedChildren = next;
    }

    if (resizeObserver) {
      resizeObserver.observe(viewport);
      if (host) resizeObserver.observe(host);
      syncObservedChildren();
    }

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver((records) => {
            const relevant = records.some(
              (record) =>
                !isOwnNode(record.target) &&
                (!record.addedNodes.length ||
                  Array.from(record.addedNodes).some((node) => !isOwnNode(node))) &&
                (!record.removedNodes.length ||
                  Array.from(record.removedNodes).some((node) => !isOwnNode(node))),
            );
            if (!relevant) return;
            syncObservedChildren();
            schedule();
          })
        : null;

    mutationObserver?.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    viewport.addEventListener("scroll", onScroll, { passive: true });
    hoverTarget.addEventListener("pointerenter", onPointerEnter);
    hoverTarget.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", schedule);

    update();

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(hideTimer);
      viewport.removeEventListener("scroll", onScroll);
      hoverTarget.removeEventListener("pointerenter", onPointerEnter);
      hoverTarget.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      yTrack?.track.remove();
      xTrack?.track.remove();
      viewport.removeAttribute("data-kit-overlay-scroll-viewport");
      if (host) releaseHostAttr(host);
      else viewport.removeAttribute("data-kit-overlay-scroll-self");
    };
  };
}
