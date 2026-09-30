/*
 * Page-wide gallery for MediaViewer. Anything that can expand (markdown
 * images, Mermaid diagrams, ImagePreview) registers its on-page element
 * here. Opening one item opens MediaViewer with every eligible item on the
 * page, in document order, so the viewer can page between them.
 *
 * Eligible means currently displayed: connected, rendered (not inside a
 * `display: none` / `visibility: hidden` subtree such as an inactive tab),
 * and in the same modal layer as the item that was opened. The set is
 * collected at open time, so it reflects the page as the user sees it.
 *
 * This module stays free of static .svelte imports so the markdown
 * post-processors that register items can load in the unit-test runtime;
 * the viewer component is imported on first open.
 */

export type MediaViewerItem =
  | {
      kind: "image";
      src: string;
      alt: string;
    }
  | {
      kind: "element";
      /** Deep-cloned into the viewer on display; the original stays in
       * place. Suited to static markup such as an SVG diagram: a clone
       * keeps no event listeners, canvas pixels, shadow roots, or live
       * form/media state, and it repeats the original's ids. */
      element: Element;
      /** Accessible name for the expanded view. */
      label: string;
      /** Extra class on the viewer's content wrapper (content-specific
       * global styles, e.g. Mermaid edge labels). */
      class?: string;
      /** Panel background (any CSS color) behind this item. */
      background?: string;
    };

/** User-facing strings of the viewer, all with English defaults. */
export interface MediaViewerLabels {
  closeLabel?: string;
  resetLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  /** Accessible name when the item has none (an image with empty alt). */
  fallbackLabel?: string;
  /** Position suffix of the accessible name when paging, e.g.
   * `(position, total) => \`${position} of ${total}\``. 1-based. */
  formatPosition?: (position: number, total: number) => string;
}

export interface OpenMediaViewerOptions extends MediaViewerLabels {
  /** Suspend app-level keyboard handling while the viewer is open;
   * returns the restore function called on close. Defaults to pushing a
   * "kit-media-viewer" scope on `appShortcuts`. Apps with their own
   * shortcut manager or modal stack hook in here. */
  onViewerOpen?: () => () => void;
  /** Called after the viewer closes, however it was closed. */
  onClose?: () => void;
}

const ITEM_ATTRIBUTE = "data-kit-media-item";
const MODAL_LAYER_SELECTOR = '[aria-modal="true"]';
const registeredItems = new WeakMap<Element, () => MediaViewerItem>();
let activeViewer: { close: () => void; elements: Element[] } | null = null;
let openGeneration = 0;

/** Mark `element` as an expandable gallery entry. `item` is called at
 * open time, so it can describe the element's current content. */
export function registerMediaViewerItem(element: Element, item: () => MediaViewerItem): void {
  registeredItems.set(element, item);
  element.setAttribute(ITEM_ATTRIBUTE, "");
}

export function unregisterMediaViewerItem(element: Element): void {
  registeredItems.delete(element);
  element.removeAttribute(ITEM_ATTRIBUTE);
}

/** The eligible registered elements, in document order, for a viewer
 * opened from `origin`. `origin` itself is always included. */
export function collectMediaViewerGallery(origin: Element): Element[] {
  const layer = origin.closest(MODAL_LAYER_SELECTOR);
  return Array.from(origin.ownerDocument.querySelectorAll(`[${ITEM_ATTRIBUTE}]`)).filter(
    (element) =>
      registeredItems.has(element) &&
      (element === origin ||
        (element.closest(MODAL_LAYER_SELECTOR) === layer && isDisplayed(element))),
  );
}

function isDisplayed(element: Element): boolean {
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({ visibilityProperty: true });
  }
  // No client rects means a display:none subtree; visibility inherits, so
  // the element's own computed value covers hidden ancestors.
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
}

/** Open MediaViewer on `origin`, paging through the page's other
 * eligible items. Replaces any viewer that is already open. The viewer
 * component loads on first use; if `origin` is removed or unregistered
 * meanwhile (its owner unmounted), nothing opens. Resolves to a function
 * that closes this viewer (a no-op once it has closed or never opened). */
export async function openMediaViewerGallery(
  origin: Element,
  options: OpenMediaViewerOptions = {},
): Promise<() => void> {
  const generation = ++openGeneration;
  const [{ mount, unmount }, { default: MediaViewer }] = await Promise.all([
    import("svelte"),
    import("../components/MediaViewer.svelte"),
  ]);
  // A later open (or a close) raced this one's dynamic import, or the
  // origin's owner went away while it loaded.
  if (generation !== openGeneration) return () => {};
  if (!origin.isConnected || !registeredItems.has(origin)) return () => {};
  activeViewer?.close();

  // Collected after the load so the set and each item reflect the page now.
  const elements = collectMediaViewerGallery(origin);
  const items = elements.map((element) => registeredItems.get(element)!());
  const { onClose, ...viewerProps } = options;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (activeViewer?.close === close) activeViewer = null;
    void unmount(instance);
    onClose?.();
  };
  const instance = mount(MediaViewer, {
    target: document.body,
    props: { ...viewerProps, items, index: elements.indexOf(origin), onclose: close },
  });
  activeViewer = { close, elements };
  return close;
}

/** Close the open gallery viewer and cancel a pending open. With
 * `showing`, only when the open viewer's items include one of those
 * elements (e.g. diagrams about to be re-rendered). */
export function closeMediaViewerGallery(showing?: Iterable<Element>): void {
  if (showing) {
    const shown = activeViewer?.elements;
    if (!shown || !Array.from(showing).some((element) => shown.includes(element))) return;
  }
  openGeneration += 1;
  activeViewer?.close();
}
