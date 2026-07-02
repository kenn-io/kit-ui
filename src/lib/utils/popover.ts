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
 * drag should not dismiss) or on Escape anywhere in the document.
 */
export function dismissable({ owners, dismiss, escapeFocus }: DismissableOptions): () => void {
  function handleMousedown(event: MouseEvent): void {
    const target = event.target as Node;
    if (owners().some((el) => el?.contains(target))) return;
    dismiss();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // Claim the key so enclosing layers (an overlay's escapeCloses) leave
    // their surface open — Escape peels one layer per press.
    event.preventDefault();
    dismiss();
    escapeFocus?.()?.focus();
  }

  document.addEventListener("mousedown", handleMousedown);
  document.addEventListener("keydown", handleKeydown);
  return () => {
    document.removeEventListener("mousedown", handleMousedown);
    document.removeEventListener("keydown", handleKeydown);
  };
}

/**
 * Keep a floating panel positioned while open: window resize, scroll in any
 * ancestor (capture phase — the panel is position: fixed, so every nested
 * scroll container moves the trigger under it), and panel size changes
 * (async content, tab switches). Repositions are coalesced to one per
 * animation frame: each event's handler does a layout read + style write,
 * which would force synchronous layout when interleaved per-event with
 * other frame work.
 */
export function autoReposition(
  panel: () => Element | null | undefined,
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
  const el = panel();
  if (el) observer.observe(el);

  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
  };
}
