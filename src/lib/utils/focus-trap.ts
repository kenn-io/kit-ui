/*
 * Focus management for modal surfaces (Modal, DetailDrawer, custom overlays).
 *
 * `trapFocus` is a Svelte attachment ({@attach trapFocus}). While the surface
 * is mounted it:
 * - moves focus into it (the first [autofocus] descendant if present,
 *   otherwise the surface itself — give the surface tabindex="-1"),
 * - keeps Tab / Shift+Tab cycling inside it,
 * - locks body scroll (re-entrant, so stacked surfaces don't unlock early),
 * - restores focus to the previously focused element on teardown.
 */

const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

let scrollLocks = 0;
let previousBodyOverflow = "";

function lockBodyScroll(): () => void {
  scrollLocks += 1;
  if (scrollLocks === 1) {
    // Remember any inline overflow the app set itself so the final unlock
    // restores it instead of wiping it.
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.setProperty("overflow", "hidden");
  }
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) {
      if (previousBodyOverflow) {
        document.body.style.setProperty("overflow", previousBodyOverflow);
      } else {
        document.body.style.removeProperty("overflow");
      }
    }
  };
}

function tabbables(surface: HTMLElement): HTMLElement[] {
  return Array.from(
    surface.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR),
  ).filter(
    // offsetParent is null for display:none subtrees (e.g. collapsed
    // sections) — skip those, they can't actually take focus.
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function trapFocus(surface: HTMLElement): () => void {
  const previous =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  // Initial focus: the first [autofocus] descendant that can actually take
  // focus (visible, not disabled). Verify focus really moved into the
  // surface — a hidden/disabled autofocus target would otherwise leave
  // focus behind the overlay, outside the trap.
  const autofocusTarget = Array.from(
    surface.querySelectorAll<HTMLElement>("[autofocus]"),
  ).find(
    (el) =>
      el.offsetParent !== null &&
      !(el as HTMLElement & { disabled?: boolean }).disabled,
  );
  autofocusTarget?.focus();
  if (!surface.contains(document.activeElement)) {
    surface.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab") return;
    const items = tabbables(surface);
    if (items.length === 0) {
      event.preventDefault();
      surface.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === surface)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  surface.addEventListener("keydown", handleKeydown);
  const unlockScroll = lockBodyScroll();

  return () => {
    surface.removeEventListener("keydown", handleKeydown);
    unlockScroll();
    previous?.focus();
  };
}
