<script lang="ts">
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import {
    openMediaViewerGallery,
    registerMediaViewerItem,
    unregisterMediaViewerItem,
    type MediaViewerLabels,
  } from "../utils/media-gallery.js";

  interface Props {
    /** Image URL — remote, relative, or a data:/blob: URL. */
    src: string;
    alt: string;
    /** Caps the rendered image height (any CSS length). */
    maxHeight?: string;
    /** Click-to-expand into the full-viewport MediaViewer (default true),
     * which also pages through the page's other expandable media. */
    expandable?: boolean;
    /** Shown in place of the image when it fails to load. */
    errorLabel?: string;
    expandLabel?: string;
    closeLabel?: string;
    /** Other strings of the expanded view (see MediaViewer). */
    viewerLabels?: MediaViewerLabels;
  }

  let {
    src,
    alt,
    maxHeight = "70vh",
    expandable = true,
    errorLabel = "Unable to load image",
    expandLabel = "Open image in expanded view",
    closeLabel = "Close expanded image",
    viewerLabels = {},
  }: Props = $props();

  // Tracking the failed URL (rather than a boolean) means a src change
  // automatically clears the error without an effect.
  let failedSrc = $state<string | null>(null);
  const failed = $derived(failedSrc === src);

  const triggerLabel = $derived(alt.trim() ? `${expandLabel}: ${alt}` : expandLabel);

  // Close function of a viewer this preview opened; the viewer lives on
  // document.body, so it must not outlive the preview.
  let closeOwnViewer: (() => void) | null = null;

  async function openViewer(trigger: HTMLElement): Promise<void> {
    // Unmounting meanwhile unregisters the trigger, and the gallery then
    // opens nothing.
    const close: () => void = await openMediaViewerGallery(trigger, {
      ...viewerLabels,
      closeLabel,
      onClose: () => {
        if (closeOwnViewer === close) closeOwnViewer = null;
      },
    });
    closeOwnViewer = close;
  }

  // The trigger is this preview's entry in the page gallery; the item is
  // read at open time, so it always reflects the current src/alt.
  function galleryEntry(trigger: HTMLElement) {
    registerMediaViewerItem(trigger, () => ({ kind: "image", src, alt }));
    return () => {
      unregisterMediaViewerItem(trigger);
      closeOwnViewer?.();
    };
  }
</script>

<div class="kit-image-preview">
  {#if failed}
    <p class="kit-image-preview__error">{errorLabel}</p>
  {:else if expandable}
    <button
      type="button"
      class="kit-image-preview__trigger kit-control-states"
      aria-label={triggerLabel}
      title={triggerLabel}
      onclick={(event) => void openViewer(event.currentTarget)}
      {@attach galleryEntry}
    >
      <img
        class="kit-image-preview__img"
        {src}
        {alt}
        style:max-height={maxHeight}
        onerror={() => (failedSrc = src)}
      />
      <span class="kit-image-preview__hint" aria-hidden="true">
        <Maximize2Icon size="14" strokeWidth="2" />
      </span>
    </button>
  {:else}
    <img
      class="kit-image-preview__img"
      {src}
      {alt}
      style:max-height={maxHeight}
      onerror={() => (failedSrc = src)}
    />
  {/if}
</div>

<style>
  .kit-image-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    padding: var(--space-7);
    /* Checkerboard backdrop marks the surface as an image preview. */
    background:
      linear-gradient(45deg, var(--bg-inset) 25%, transparent 25%),
      linear-gradient(-45deg, var(--bg-inset) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--bg-inset) 75%),
      linear-gradient(-45deg, transparent 75%, var(--bg-inset) 75%);
    background-color: var(--bg-surface);
    background-position:
      0 0,
      0 10px,
      10px -10px,
      -10px 0;
    background-size: 20px 20px;
  }

  .kit-image-preview__trigger {
    position: relative;
    display: block;
    max-width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    line-height: 0;
    cursor: zoom-in;
  }

  .kit-image-preview__trigger:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  .kit-image-preview__img {
    max-width: min(100%, 960px);
    object-fit: contain;
    border: var(--border-width) solid var(--border-muted);
    background: var(--bg-surface);
  }

  /* Decorative affordance only — the whole trigger is the control. */
  .kit-image-preview__hint {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--text-secondary);
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    opacity: 0;
  }

  .kit-image-preview__trigger:hover .kit-image-preview__hint,
  .kit-image-preview__trigger:focus-visible .kit-image-preview__hint {
    opacity: 1;
  }

  .kit-image-preview__error {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }
</style>
