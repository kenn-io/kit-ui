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
      /** Cloned into the viewer on display; the original stays in place. */
      element: Element;
      /** Accessible name for the expanded view. */
      label: string;
      /** Extra class on the viewer's content wrapper (content-specific
       * global styles, e.g. Mermaid edge labels). */
      class?: string;
      /** Panel background (any CSS color) behind this item. */
      background?: string;
    };

export interface MediaViewerLabels {
  closeLabel?: string;
  resetLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
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
let closeActiveViewer: (() => void) | null = null;
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
  return element.getClientRects().length > 0;
}

/** Open MediaViewer on `origin`, paging through the page's other
 * eligible items. Replaces any viewer that is already open. Resolves to
 * a function that closes this viewer (a no-op once it has closed). */
export async function openMediaViewerGallery(
  origin: Element,
  options: OpenMediaViewerOptions = {},
): Promise<() => void> {
  const generation = ++openGeneration;
  const elements = collectMediaViewerGallery(origin);
  const items = elements.map((element) => registeredItems.get(element)!());
  const index = elements.indexOf(origin);

  const [{ mount, unmount }, { default: MediaViewer }] = await Promise.all([
    import("svelte"),
    import("../components/MediaViewer.svelte"),
  ]);
  // A later open (or a close) raced this one's dynamic import.
  if (generation !== openGeneration) return () => {};
  closeActiveViewer?.();

  const { onClose, ...viewerProps } = options;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (closeActiveViewer === close) closeActiveViewer = null;
    void unmount(instance);
    onClose?.();
  };
  const instance = mount(MediaViewer, {
    target: document.body,
    props: { ...viewerProps, items, index: Math.max(index, 0), onclose: close },
  });
  closeActiveViewer = close;
  return close;
}

/** Close the open gallery viewer, if any (e.g. before content it shows
 * is re-rendered). */
export function closeMediaViewerGallery(): void {
  openGeneration += 1;
  closeActiveViewer?.();
}
