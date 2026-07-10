<script module lang="ts">
  export type ModalTone = "neutral" | "info" | "success" | "warning" | "danger";
</script>

<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { trapFocus } from "../utils/focus-trap.js";
  import { backdropCloses, escapeCloses } from "../utils/overlay.js";
  import IconButton from "./IconButton.svelte";

  interface Props {
    title?: string;
    /** Header accent. `neutral` is a plain inset header; the others tint the
     * header and title with the matching semantic accent. */
    tone?: ModalTone;
    /** Called when the user dismisses via Escape, overlay click, or the close button. */
    onclose?: () => void;
    /** Render the X button in the header. */
    closable?: boolean;
    /** Dismiss when the overlay backdrop is clicked (default true). */
    closeOnOverlayClick?: boolean;
    width?: string;
    maxWidth?: string;
    ariaLabel?: string;
    children?: Snippet;
    /** Optional footer row, typically action buttons. */
    footer?: Snippet;
  }

  let {
    title = undefined,
    tone = "neutral",
    onclose = undefined,
    closable = true,
    closeOnOverlayClick = true,
    width = "auto",
    maxWidth = "min(480px, calc(100vw - 32px))",
    ariaLabel = undefined,
    children,
    footer,
  }: Props = $props();

  const close = () => onclose?.();
</script>

<svelte:window onkeydown={escapeCloses(close)} />

<div
  class="kit-modal-overlay"
  role="presentation"
  onpointerdown={closeOnOverlayClick ? backdropCloses(close) : undefined}
>
  <div
    class="kit-modal-panel"
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel ?? title}
    tabindex="-1"
    data-kit-tone={tone === "neutral" ? undefined : tone}
    class:kit-modal-panel--headered={!!title || closable}
    style:width
    style:max-width={maxWidth}
    {@attach trapFocus}
  >
    {#if title || closable}
      <div class="kit-modal-header">
        {#if title}
          <span class="kit-modal-title">{title}</span>
        {/if}
        {#if closable}
          <IconButton
            size="sm"
            class="kit-modal-close"
            ariaLabel="Close"
            onclick={() => onclose?.()}
          >
            <XIcon size="14" strokeWidth="2" aria-hidden="true" />
          </IconButton>
        {/if}
      </div>
    {/if}
    <div class="kit-modal-body">
      {#if children}
        {@render children()}
      {/if}
    </div>
    {#if footer}
      <div class="kit-modal-footer">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

<style>
  .kit-modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg, rgba(0, 0, 0, 0.3));
    -webkit-backdrop-filter: var(--overlay-filter, none);
    backdrop-filter: var(--overlay-filter, none);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-overlay);
  }

  .kit-modal-panel {
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    /* No overflow: hidden — the header must be able to overlay the
     * panel's border (see the band comment below); children clip their
     * own corners instead. */
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 64px);
  }

  .kit-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-5);
    padding: var(--space-3) var(--space-6);
    /* Distinct from the body surface by default so the header reads as a
     * separate band, not just bolder body text. */
    background: var(--bg-inset);
    /* The band owns every border segment it touches: it pulls out over
     * the panel's border and draws its own, so a toned band can tint its
     * top AND side edges — a grey side edge beside the tinted band reads
     * as a bug (the tone applies to the toned region's whole border
     * area, same principle as the borderless SegmentedControl). */
    margin: -1px -1px 0;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    flex-shrink: 0;
  }

  .kit-modal-title {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold, 600);
    line-height: 1.3;
    color: var(--text-primary);
  }

  /* Tinted header bands for semantic tones: the panel's data-kit-tone
   * opts into the shared tone map + band recipe in theme.css (9% band,
   * 30% border, 72% AA-safe ink — rationale documented there), and the
   * band, borders, title, and close button all follow.
   *
   * Tone reaches the band's full border area (top, sides, and the
   * divider below) via the header's own border. Headerless toned modals
   * render no header element, so no stray colored edge. */
  .kit-modal-panel[data-kit-tone] .kit-modal-header {
    background: var(--kit-tone-band-bg);
    border-color: var(--kit-tone-border);
  }

  .kit-modal-panel[data-kit-tone] .kit-modal-title {
    color: var(--kit-tone-ink);
  }

  .kit-modal-panel[data-kit-tone] :global(.kit-modal-close) {
    color: var(--kit-tone-ink);
  }

  .kit-modal-panel[data-kit-tone] :global(.kit-modal-close):hover {
    /* Keep the contrast-safe mixed ink on hover too — raw amber/green on
     * the tinted band would dip below AA. Only the background changes. */
    color: var(--kit-tone-ink);
    background: color-mix(in srgb, var(--kit-tone) 14%, transparent);
  }

  /* The close chrome is a stock IconButton; only its placement in the
   * header lives here. */
  .kit-modal-header :global(.kit-modal-close) {
    margin-left: auto;
    /* The header's 16px side padding is for text; pull the button's box
     * back out so its edge gap matches the 6px vertical padding. */
    margin-right: calc(var(--space-3) - var(--space-6));
  }

  .kit-modal-body {
    padding: 16px;
    overflow-y: auto;
    color: var(--text-secondary);
    font-size: var(--font-size-md);
  }

  /* Without an overflow clip on the panel, the scrollable body rounds
   * its own corners (scrollbar included) where it meets the panel's
   * rounded edge. */
  .kit-modal-body:first-child {
    border-top-left-radius: calc(var(--radius-lg) - 1px);
    border-top-right-radius: calc(var(--radius-lg) - 1px);
  }

  .kit-modal-body:last-child {
    border-bottom-left-radius: calc(var(--radius-lg) - 1px);
    border-bottom-right-radius: calc(var(--radius-lg) - 1px);
  }

  .kit-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-default);
    flex-shrink: 0;
  }
</style>
