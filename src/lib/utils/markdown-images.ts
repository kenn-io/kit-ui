/**
 * Expand controls for images in rendered markdown, consolidated from
 * Forge's frontend. `initMarkdownImageViewer` watches a root for images
 * matching `selector`, wraps each in a hover expand button, and registers
 * it with the page gallery: expanding one opens the shared MediaViewer,
 * which pages through the page's other images and diagrams.
 *
 * The wrapper and button are imperative DOM, so their styles are global:
 * import `@kenn-io/kit-ui/markdown-images.css` alongside theme.css.
 */

import { loadControlIcons, setControlIcon } from "./control-icons.js";
import {
  openMediaViewerGallery,
  registerMediaViewerItem,
  type MediaViewerLabels,
} from "./media-gallery.js";

export interface MarkdownImageViewerOptions {
  /** Images to enhance under the root. Defaults to images inside kit-ui's
   * `Markdown` component. */
  selector?: string;
  /** Suspend app-level keyboard handling while the expanded view is open
   * (see MediaViewer's `onViewerOpen`). */
  onViewerOpen?: () => () => void;
  expandLabel?: string;
  /** Strings for the expanded view (see MediaViewer's label props). */
  viewerLabels?: MediaViewerLabels;
}

export interface MarkdownImageViewerController {
  /** Enhance matching images now instead of on the next DOM mutation. */
  refresh: () => void;
  /** Stop watching and close a viewer this controller opened. */
  disconnect: () => void;
}

const DEFAULT_SELECTOR = ".kit-markdown img";
const WRAPPER_CLASS = "kit-markdown-image";

export function initMarkdownImageViewer(
  root?: HTMLElement | Document,
  options: MarkdownImageViewerOptions = {},
): MarkdownImageViewerController {
  // SSR-safe no-op, same contract as initMarkdownMermaidRendering.
  if (typeof document === "undefined") {
    return { refresh: () => {}, disconnect: () => {} };
  }
  const observedRoot = root ?? document;
  const selector = options.selector ?? DEFAULT_SELECTOR;
  const expandLabel = options.expandLabel ?? "Open image in expanded view";
  let disconnected = false;
  let scheduled = false;
  let closeOwnedViewer: (() => void) | null = null;

  const open = async (wrapper: HTMLElement) => {
    const close: () => void = await openMediaViewerGallery(wrapper, {
      ...options.viewerLabels,
      onViewerOpen: options.onViewerOpen,
      onClose: () => {
        if (closeOwnedViewer === close) closeOwnedViewer = null;
      },
    });
    // Disconnected while the viewer loaded: it must not outlive us.
    if (disconnected) close();
    else closeOwnedViewer = close;
  };

  const enhance = () => {
    for (const image of Array.from(observedRoot.querySelectorAll<HTMLImageElement>(selector))) {
      attachImageExpander(image, expandLabel, open);
    }
  };

  const schedule = () => {
    if (disconnected || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!disconnected) enhance();
    });
  };

  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
  observer?.observe(
    observedRoot instanceof Document ? observedRoot.documentElement : observedRoot,
    { childList: true, subtree: true },
  );
  // Buttons built before the icon chunk lands show text glyphs; re-icon
  // them once it does.
  void loadControlIcons().then(() => {
    for (const button of Array.from(
      observedRoot.querySelectorAll<HTMLButtonElement>(`.${WRAPPER_CLASS}__expand`),
    )) {
      setControlIcon(button, "expand");
    }
  });
  enhance();

  return {
    refresh: enhance,
    disconnect() {
      disconnected = true;
      observer?.disconnect();
      const close = closeOwnedViewer;
      closeOwnedViewer = null;
      close?.();
    },
  };
}

function attachImageExpander(
  image: HTMLImageElement,
  expandLabel: string,
  open: (wrapper: HTMLElement) => void,
): void {
  if (!image.getAttribute("src")) return;
  if (image.closest(`.${WRAPPER_CLASS}`)) return;

  const target = expandableTarget(image);
  if (!target?.parentNode) return;

  const wrapper = document.createElement("span");
  wrapper.className = WRAPPER_CLASS;
  target.before(wrapper);

  const alt = image.getAttribute("alt") ?? "";
  const label = alt.trim() ? `${expandLabel}: ${alt}` : expandLabel;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${WRAPPER_CLASS}__expand`;
  button.setAttribute("aria-label", label);
  button.title = label;
  setControlIcon(button, "expand");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    open(wrapper);
  });

  wrapper.append(target, button);
  registerMediaViewerItem(wrapper, () => ({
    kind: "image",
    src: image.currentSrc || image.src,
    alt: image.getAttribute("alt") ?? "",
  }));
}

/** The image itself, or its link when the link wraps only that image
 * (the button then sits beside the link instead of inside it). Images
 * inside links with other content are left alone. */
function expandableTarget(image: HTMLImageElement): HTMLElement | null {
  const parent = image.parentElement;
  if (
    parent instanceof HTMLAnchorElement &&
    parent.querySelectorAll("img").length === 1 &&
    parent.textContent?.trim() === ""
  ) {
    return parent;
  }
  if (image.closest("a")) return null;
  return image;
}
