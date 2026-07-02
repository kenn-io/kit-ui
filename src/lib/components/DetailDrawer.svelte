<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { trapFocus } from "../utils/focus-trap.js";
  import IconButton from "./IconButton.svelte";

  interface Props {
    title?: string;
    /** Called when the user dismisses via Escape, overlay click, or the close button. */
    onclose?: () => void;
    /** Panel width; clamped to the viewport. */
    width?: string;
    /** Render the X button in the header (default true). */
    closable?: boolean;
    /** Dismiss when the overlay backdrop is clicked (default true). */
    closeOnOverlayClick?: boolean;
    /** Accessible dialog name. With a custom `header` and no ariaLabel, the
     * dialog falls back to aria-labelledby on the header container (its full
     * text content becomes the name) — pass ariaLabel for a concise name. */
    ariaLabel?: string;
    /** Tooltip on the close button. */
    closeTitle?: string;
    closeAriaLabel?: string;
    children?: Snippet;
    /** Replaces the default title + close header entirely. */
    header?: Snippet;
    /** Optional footer row, typically action buttons. */
    footer?: Snippet;
  }

  let {
    title = undefined,
    onclose = undefined,
    width = "min(560px, 100vw)",
    closable = true,
    closeOnOverlayClick = true,
    ariaLabel = undefined,
    closeTitle = "Close (Esc)",
    closeAriaLabel = "Close",
    children,
    header,
    footer,
  }: Props = $props();

  const uid = $props.id();
  const headerId = `kit-detail-drawer-header-${uid}`;

  function handleOverlayMousedown(event: MouseEvent): void {
    if (!closeOnOverlayClick) return;
    if (event.target === event.currentTarget) {
      onclose?.();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="kit-detail-drawer-overlay" role="presentation" onmousedown={handleOverlayMousedown}>
  <div
    class="kit-detail-drawer"
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel ?? (header ? undefined : title)}
    aria-labelledby={!ariaLabel && header ? headerId : undefined}
    tabindex="-1"
    style:width
    {@attach trapFocus}
  >
    {#if header}
      <div class="kit-detail-drawer__header" id={!ariaLabel ? headerId : undefined}>
        {@render header()}
      </div>
    {:else if title || closable}
      <div class="kit-detail-drawer__header">
        {#if closable}
          <IconButton
            size="sm"
            class="kit-detail-drawer__close"
            title={closeTitle}
            ariaLabel={closeAriaLabel}
            onclick={() => onclose?.()}
          >
            <XIcon size="14" strokeWidth="2" aria-hidden="true" />
          </IconButton>
        {/if}
        {#if title}
          <span class="kit-detail-drawer__title">{title}</span>
        {/if}
      </div>
    {/if}
    <div class="kit-detail-drawer__body">
      {#if children}
        {@render children()}
      {/if}
    </div>
    {#if footer}
      <div class="kit-detail-drawer__footer">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

<style>
  .kit-detail-drawer-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg, rgba(0, 0, 0, 0.3));
    z-index: 1000;
  }

  .kit-detail-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    max-width: 100vw;
    background: var(--bg-surface);
    border-left: 1px solid var(--border-default);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: kit-detail-drawer-slide-in 0.18s ease-out;
  }

  @keyframes kit-detail-drawer-slide-in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-detail-drawer {
      animation: none;
    }
  }

  .kit-detail-drawer__header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .kit-detail-drawer__title {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-detail-drawer__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .kit-detail-drawer__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-6);
    border-top: 1px solid var(--border-default);
    flex-shrink: 0;
  }
</style>
