/*
 * Shared popover open-state wiring. floatingPosition.ts owns the geometry;
 * these own the event plumbing every floating component used to hand-roll
 * (and let drift: outside-dismiss listened on `mousedown` in some copies
 * and `click` in others, and only some restored focus after Escape).
 *
 * Both helpers are called from inside an `$effect` that guards on the
 * popover's open state and return their cleanup, so a component's effect
 * body collapses to two calls.
 */

import { escapeLayer } from "./overlay.js";

export interface DismissableOptions {
  /** Elements that count as "inside"; a pointer-down outside them all dismisses. */
  owners: () => (Element | null | undefined)[];
  dismiss: () => void;
  /** Focused after an Escape dismiss so keyboard users land back on the trigger. */
  escapeFocus?: () => HTMLElement | null | undefined;
}

/**
 * Dismiss on `mousedown` outside the owning elements (mousedown, not click:
 * the popover should yield at press, and a press-inside-release-outside
 * drag should not dismiss) or on Escape while it is the newest open layer.
 */
export function dismissable({ owners, dismiss, escapeFocus }: DismissableOptions): () => void {
  // On the stack shared with overlays, so Escape closes this popover only
  // while nothing opened after it: a select inside a flyout closes first,
  // and a dialog opened over the popover closes before it.
  const removeLayer = escapeLayer(
    () => {
      dismiss();
      escapeFocus?.()?.focus();
    },
    owners().find((owner) => owner) ?? null,
  );

  function handleMousedown(event: MouseEvent): void {
    const target = event.target as Node;
    if (owners().some((el) => el?.contains(target))) return;
    dismiss();
  }

  document.addEventListener("mousedown", handleMousedown);
  return () => {
    removeLayer();
    document.removeEventListener("mousedown", handleMousedown);
  };
}

/**
 * Keep a floating panel positioned while open: window resize, scroll in any
 * ancestor (capture phase — the panel is position: fixed, so every nested
 * scroll container moves the trigger under it), and observed element size
 * changes (panel content, trigger stretching, or layout-host resizing).
 * Repositions are coalesced to one per animation frame: each event's handler
 * does a layout read + style write, which would force synchronous layout when
 * interleaved per-event with other frame work.
 */
export function autoReposition(
  observedElements: () => (Element | null | undefined)[],
  reposition: () => void,
): () => void {
  let frame = 0;

  function schedule(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      reposition();
    });
  }

  const observer = new ResizeObserver(schedule);
  for (const element of observedElements()) {
    if (element) observer.observe(element);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
  };
}
