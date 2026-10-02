<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import XIcon from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import type { MediaViewerItem } from "../utils/media-gallery.js";
  import { trapFocus } from "../utils/focus-trap.js";
  import { backdropCloses } from "../utils/overlay.js";
  import { attachPanZoom, type PanZoom } from "../utils/pan-zoom.js";
  import { appShortcuts } from "../utils/shortcuts.js";
  import IconButton from "./IconButton.svelte";

  interface Props {
    /** What to show; with more than one item the viewer pages between
     * them (buttons, ArrowLeft/ArrowRight), wrapping at the ends. An
     * empty list renders nothing. */
    items: MediaViewerItem[];
    /** Index of the item on display; out-of-range values wrap. */
    index?: number;
    onclose: () => void;
    /** Suspend app-level keyboard handling while open; returns the
     * restore function. Defaults to an `appShortcuts` scope. */
    onViewerOpen?: () => () => void;
    closeLabel?: string;
    resetLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
    /** Accessible name when the item has none (an image with empty alt). */
    fallbackLabel?: string;
    /** Visible position counter when paging (1-based). */
    formatCounter?: (position: number, total: number) => string;
    /** Accessible name when paging, from the item's name (1-based). */
    formatLabel?: (label: string, position: number, total: number) => string;
  }

  let {
    items,
    index = $bindable(0),
    onclose,
    onViewerOpen = () => appShortcuts.pushScope("kit-media-viewer"),
    closeLabel = "Close expanded view",
    resetLabel = "Reset view",
    previousLabel = "Previous item",
    nextLabel = "Next item",
    fallbackLabel = "Expanded view",
    formatCounter = (position, total) => `${position} / ${total}`,
    formatLabel = (label, position, total) => `${label} (${position} of ${total})`,
  }: Props = $props();

  // index wrapped into range, so the item, counter, and label agree.
  const position = $derived(
    items.length > 0 ? ((index % items.length) + items.length) % items.length : 0,
  );
  const current = $derived(items[position]);
  const paged = $derived(items.length > 1);
  const itemLabel = $derived(
    (current?.kind === "image" ? current.alt : (current?.label ?? "")).trim() || fallbackLabel,
  );
  // Visible title: the image's own alt text. Element labels are often
  // generic ("Mermaid diagram"), so they stay accessible names only.
  const caption = $derived(current?.kind === "image" ? current.alt.trim() : "");
  // Rendered caption height (one line or two), so the content clears
  // exactly what the caption covers.
  let captionHeight = $state(0);
  const dialogLabel = $derived(
    paged ? formatLabel(itemLabel, position + 1, items.length) : itemLabel,
  );

  // Set by the viewport attachment; not reactive, only called from the
  // reset button.
  let panZoom: PanZoom | null = null;

  // The hook itself runs untracked: an app's hook typically reads and
  // writes its own state (a modal stack), which tracked inside the
  // attachment's effect would re-run the effect in a loop. The prop read
  // stays tracked, so a replacement hook swaps in.
  function suspendShortcuts() {
    const hook = onViewerOpen;
    return untrack(hook);
  }

  function step(delta: number): void {
    index = (position + delta + items.length) % items.length;
  }

  function onkeydown(event: KeyboardEvent): void {
    // Keys stay inside the viewer: app-level listeners on window must not
    // also act on them.
    event.stopPropagation();
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
    } else if (paged && event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (paged && event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  }

  function panZoomViewport(viewport: HTMLElement) {
    const pan = viewport.firstElementChild as HTMLElement;
    const handle = attachPanZoom(viewport, pan, {
      onSwipe: (direction) => {
        if (paged) step(direction);
      },
    });
    panZoom = handle;
    return () => {
      handle.destroy();
      if (panZoom === handle) panZoom = null;
    };
  }

  function cloneInto(element: Element) {
    return (host: HTMLElement) => {
      host.append(element.cloneNode(true));
      return () => host.replaceChildren();
    };
  }
</script>

{#if current}
  <div
    class="kit-media-viewer"
    role="presentation"
    {@attach backdropCloses(onclose)}
    {@attach suspendShortcuts}
  >
    <div
      class="kit-media-viewer__panel"
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      tabindex="-1"
      class:kit-media-viewer__panel--captioned={caption}
      style:--kit-media-viewer-caption-height={caption ? `${captionHeight}px` : undefined}
      style:--kit-media-viewer-bg={current?.kind === "element" ? current.background : undefined}
      {onkeydown}
      {@attach trapFocus}
    >
      <!-- A new viewport (pan and zoom reset) when paging, and when a
        different item takes the current index. -->
      {#key position}
        {#key current}
          <div class="kit-media-viewer__viewport" {@attach panZoomViewport}>
            <div
              class={[
                "kit-media-viewer__pan",
                current?.kind === "element" && "kit-media-viewer__pan--element",
                current?.kind === "element" && current.class,
              ]}
            >
              {#if current?.kind === "image"}
                <img class="kit-media-viewer__img" src={current.src} alt={current.alt} />
              {:else if current?.kind === "element"}
                <div class="kit-media-viewer__element" {@attach cloneInto(current.element)}></div>
              {/if}
            </div>
          </div>
        {/key}
      {/key}

      <!-- Hidden from assistive tech: the dialog's name and the image's alt
        already carry this text. -->
      {#if caption}
        <p
          class="kit-media-viewer__caption"
          aria-hidden="true"
          title={caption}
          bind:offsetHeight={captionHeight}
        >
          {caption}
        </p>
      {/if}

      <IconButton class="kit-media-viewer__close" ariaLabel={closeLabel} onclick={onclose}>
        <XIcon size="16" strokeWidth="2" aria-hidden="true" />
      </IconButton>

      {#if paged}
        <IconButton
          class="kit-media-viewer__step kit-media-viewer__step--previous"
          ariaLabel={previousLabel}
          onclick={() => step(-1)}
        >
          <ChevronLeftIcon size="18" strokeWidth="2" aria-hidden="true" />
        </IconButton>
        <IconButton
          class="kit-media-viewer__step kit-media-viewer__step--next"
          ariaLabel={nextLabel}
          onclick={() => step(1)}
        >
          <ChevronRightIcon size="18" strokeWidth="2" aria-hidden="true" />
        </IconButton>
        <p class="kit-media-viewer__counter" aria-hidden="true">
          {formatCounter(position + 1, items.length)}
        </p>
      {/if}

      <IconButton
        class="kit-media-viewer__reset"
        ariaLabel={resetLabel}
        onclick={() => panZoom?.reset()}
      >
        <RotateCcwIcon size="16" strokeWidth="2" aria-hidden="true" />
      </IconButton>
    </div>
  </div>
{/if}

<style>
  .kit-media-viewer {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--viewer-scrim, rgba(1, 4, 9, 0.72));
  }

  /* Sized purely in viewport units: large content (long sequence
   * diagrams, full-page screenshots) is the reason to expand. dvh keeps
   * mobile browser bars from covering the bottom edge. */
  .kit-media-viewer__panel {
    --kit-media-viewer-step: 36px;
    /* Close and reset button size; the caption clears the close button. */
    --kit-media-viewer-control: 28px;
    /* Space above and below the content, kept clear of the controls. */
    --kit-media-viewer-inset-base: 64px;
    /* Top band the caption covers; the content is centered, so the
     * inset reserves it on both sides. */
    --kit-media-viewer-caption-band: 0px;
    --kit-media-viewer-inset-y: max(
      var(--kit-media-viewer-inset-base),
      2 * var(--kit-media-viewer-caption-band)
    );
    position: relative;
    width: 90vw;
    /* vh first: browsers without dvh drop that line and keep this one. */
    height: 90vh;
    height: 90dvh;
    overflow: hidden;
    background: var(--kit-media-viewer-bg, var(--bg-surface));
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  /* The caption sits in the top band, so content starts below it. */
  .kit-media-viewer__panel--captioned {
    --kit-media-viewer-caption-band: calc(
      var(--space-5) + var(--kit-media-viewer-caption-height, 0px) + var(--space-5)
    );
  }

  .kit-media-viewer__panel:focus {
    outline: none;
  }

  .kit-media-viewer__viewport {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
  }

  .kit-media-viewer__viewport:global([data-panning]) {
    cursor: grabbing;
  }

  /* Inset keeps content clear of the corner and edge controls. */
  .kit-media-viewer__pan {
    width: calc(100% - 128px);
    height: calc(100% - var(--kit-media-viewer-inset-y));
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    transition: transform 120ms ease-out;
    /* No will-change: Chromium would keep a fixed raster of vector
     * content and blur it when zoomed. */
  }

  /* Images keep their natural size when it fits; they never upscale. */
  .kit-media-viewer__img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }

  .kit-media-viewer__element {
    display: contents;
  }

  /* Vector content (diagrams) scales to fill the space, keeping its
   * aspect ratio through the svg viewBox. !important beats the inline
   * max-width Mermaid writes (its natural width), which would otherwise
   * keep small diagrams small in the expanded view. */
  .kit-media-viewer__pan--element :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100% !important;
    max-height: 100%;
  }

  .kit-media-viewer__panel :global(.kit-media-viewer__close),
  .kit-media-viewer__panel :global(.kit-media-viewer__reset),
  .kit-media-viewer__panel :global(.kit-media-viewer__step) {
    position: absolute;
    z-index: 1;
    color: var(--text-secondary);
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-muted);
    box-shadow: var(--shadow-sm);
  }

  .kit-media-viewer__panel :global(.kit-media-viewer__close) {
    top: var(--space-5);
    right: var(--space-5);
  }

  .kit-media-viewer__panel :global(.kit-media-viewer__reset) {
    right: var(--space-5);
    bottom: var(--space-5);
  }

  /* Centered with top, not transform: .kit-control-states owns the
   * button's transform for its pressed state. */
  .kit-media-viewer__panel :global(.kit-media-viewer__step) {
    top: calc(50% - var(--kit-media-viewer-step) / 2);
    width: var(--kit-media-viewer-step);
    height: var(--kit-media-viewer-step);
  }

  .kit-media-viewer__panel :global(.kit-media-viewer__step--previous) {
    left: var(--space-5);
  }

  .kit-media-viewer__panel :global(.kit-media-viewer__step--next) {
    right: var(--space-5);
  }

  /* Centered between the panel edges, clear of the close button on
   * both sides; long alt text wraps to two lines, then truncates (the
   * title attribute has the rest). */
  .kit-media-viewer__caption {
    --kit-media-viewer-caption-inset: calc(
      var(--space-5) + var(--kit-media-viewer-control) + var(--space-4)
    );
    position: absolute;
    top: var(--space-5);
    left: var(--kit-media-viewer-caption-inset);
    right: var(--kit-media-viewer-caption-inset);
    z-index: 1;
    display: -webkit-box;
    width: fit-content;
    margin: 0 auto;
    padding: var(--space-2) var(--space-4);
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    color: var(--text-primary);
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-medium);
    line-height: 1.4;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .kit-media-viewer__counter {
    position: absolute;
    bottom: var(--space-5);
    left: 50%;
    z-index: 1;
    margin: 0;
    padding: var(--space-1) var(--space-3);
    transform: translateX(-50%);
    color: var(--text-secondary);
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-media-viewer__pan {
      transition: none;
    }
  }

  /* Finger-sized controls on touch devices. */
  @media (hover: none), (pointer: coarse) {
    .kit-media-viewer__panel {
      --kit-media-viewer-step: 44px;
      --kit-media-viewer-control: 44px;
    }

    .kit-media-viewer__panel :global(.kit-media-viewer__close),
    .kit-media-viewer__panel :global(.kit-media-viewer__reset) {
      width: var(--kit-media-viewer-control);
      height: var(--kit-media-viewer-control);
    }
  }

  @media (max-width: 640px) {
    .kit-media-viewer__panel {
      --kit-media-viewer-inset-base: 112px;
    }

    .kit-media-viewer__pan {
      width: calc(100% - 32px);
    }

    .kit-media-viewer__panel :global(.kit-media-viewer__step) {
      top: auto;
      bottom: var(--space-5);
    }

    .kit-media-viewer__panel :global(.kit-media-viewer__step--next) {
      right: auto;
      left: calc(var(--space-5) + var(--kit-media-viewer-step) + var(--space-4));
    }
  }
</style>
