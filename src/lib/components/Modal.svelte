<script module lang="ts">
  export type ModalTone = "neutral" | "info" | "success" | "warning" | "danger";
</script>

<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { trapFocus } from "../utils/focus-trap.js";

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

  function handleOverlayMousedown(event: MouseEvent): void {
    if (!closeOnOverlayClick) return;
    if (event.target === event.currentTarget) {
      onclose?.();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div
  class="kit-modal-overlay"
  role="presentation"
  onmousedown={handleOverlayMousedown}
>
  <div
    class="kit-modal-panel"
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel ?? title}
    tabindex="-1"
    style:width
    style:max-width={maxWidth}
    {@attach trapFocus}
  >
    {#if title || closable}
      <div class="kit-modal-header" data-tone={tone}>
        {#if title}
          <span class="kit-modal-title">{title}</span>
        {/if}
        {#if closable}
          <button
            class="kit-modal-close"
            type="button"
            aria-label="Close"
            onclick={() => onclose?.()}
          >
            <XIcon size="14" strokeWidth="2" aria-hidden="true" />
          </button>
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
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .kit-modal-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    overflow: hidden;
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
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .kit-modal-title {
    font-size: var(--font-size-md);
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
  }

  /* Tinted header bands for semantic tones; the title takes the accent ink. */
  .kit-modal-header[data-tone="info"] {
    background: color-mix(in srgb, var(--accent-blue) 9%, var(--bg-surface));
    border-bottom-color: color-mix(in srgb, var(--accent-blue) 30%, var(--border-default));
  }
  .kit-modal-header[data-tone="info"] .kit-modal-title {
    color: var(--accent-blue);
  }

  .kit-modal-header[data-tone="success"] {
    background: color-mix(in srgb, var(--accent-green) 9%, var(--bg-surface));
    border-bottom-color: color-mix(in srgb, var(--accent-green) 30%, var(--border-default));
  }
  .kit-modal-header[data-tone="success"] .kit-modal-title {
    color: var(--accent-green);
  }

  .kit-modal-header[data-tone="warning"] {
    background: color-mix(in srgb, var(--accent-amber) 10%, var(--bg-surface));
    border-bottom-color: color-mix(in srgb, var(--accent-amber) 32%, var(--border-default));
  }
  .kit-modal-header[data-tone="warning"] .kit-modal-title {
    color: var(--accent-amber);
  }

  .kit-modal-header[data-tone="danger"] {
    background: color-mix(in srgb, var(--accent-red) 9%, var(--bg-surface));
    border-bottom-color: color-mix(in srgb, var(--accent-red) 30%, var(--border-default));
  }
  .kit-modal-header[data-tone="danger"] .kit-modal-title {
    color: var(--accent-red);
  }

  .kit-modal-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .kit-modal-close:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-modal-body {
    padding: 16px;
    overflow-y: auto;
    color: var(--text-secondary);
    font-size: var(--font-size-md);
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
