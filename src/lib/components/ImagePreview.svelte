<script lang="ts">
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import XIcon from "@lucide/svelte/icons/x";
  import { trapFocus } from "../utils/focus-trap.js";
  import { backdropCloses, escapeCloses } from "../utils/overlay.js";
  import IconButton from "./IconButton.svelte";

  interface Props {
    /** Image URL — remote, relative, or a data:/blob: URL. */
    src: string;
    alt: string;
    /** Caps the rendered image height (any CSS length). */
    maxHeight?: string;
    /** Click-to-expand into a full-viewport lightbox (default true). */
    expandable?: boolean;
    /** Shown in place of the image when it fails to load. */
    errorLabel?: string;
    expandLabel?: string;
    closeLabel?: string;
  }

  let {
    src,
    alt,
    maxHeight = "70vh",
    expandable = true,
    errorLabel = "Unable to load image",
    expandLabel = "Open image in expanded view",
    closeLabel = "Close expanded image",
  }: Props = $props();

  // Tracking the failed URL (rather than a boolean) means a src change
  // automatically clears the error without an effect.
  let failedSrc = $state<string | null>(null);
  const failed = $derived(failedSrc === src);

  let expanded = $state(false);
  const triggerLabel = $derived(alt.trim() ? `${expandLabel}: ${alt}` : expandLabel);
</script>

<div class="kit-image-preview">
  {#if failed}
    <p class="kit-image-preview__error">{errorLabel}</p>
  {:else if expandable}
    <button
      type="button"
      class="kit-image-preview__trigger"
      aria-label={triggerLabel}
      title={triggerLabel}
      onclick={() => (expanded = true)}
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

{#if expanded}
  <div
    class="kit-image-preview__lightbox"
    role="presentation"
    onpointerdown={backdropCloses(() => (expanded = false))}
  >
    <div
      class="kit-image-preview__lightbox-panel"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabindex="-1"
      onkeydown={escapeCloses(() => (expanded = false))}
      {@attach trapFocus}
    >
      <img class="kit-image-preview__lightbox-img" {src} {alt} />
      <IconButton
        size="md"
        class="kit-image-preview__lightbox-close"
        ariaLabel={closeLabel}
        onclick={() => (expanded = false)}
      >
        <XIcon size="16" strokeWidth="2" aria-hidden="true" />
      </IconButton>
    </div>
  </div>
{/if}

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

  .kit-image-preview__lightbox {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    background: var(--overlay-bg, rgba(0, 0, 0, 0.3));
    -webkit-backdrop-filter: var(--overlay-filter, none);
    backdrop-filter: var(--overlay-filter, none);
  }

  .kit-image-preview__lightbox-panel {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kit-image-preview__lightbox-img {
    display: block;
    max-width: calc(100vw - 64px);
    max-height: calc(100vh - 64px);
    object-fit: contain;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
  }

  /* Hovers over the image's top-right corner; half-transparent so it
   * doesn't fight the image, solid on hover/focus. */
  .kit-image-preview__lightbox-panel :global(.kit-image-preview__lightbox-close) {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    color: var(--text-secondary);
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-muted);
    box-shadow: var(--shadow-sm);
    opacity: 0.5;
  }

  .kit-image-preview__lightbox-panel :global(.kit-image-preview__lightbox-close):hover,
  .kit-image-preview__lightbox-panel :global(.kit-image-preview__lightbox-close):focus-visible {
    background: var(--bg-surface-hover);
    opacity: 1;
  }
</style>
