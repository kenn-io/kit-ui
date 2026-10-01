/*
 * Focus management for modal surfaces (Modal, DetailDrawer, custom overlays).
 *
 * `trapFocus` is a Svelte attachment ({@attach trapFocus}). While the surface
 * is mounted it:
 * - moves focus into it (the first [autofocus] descendant if present,
 *   otherwise the surface itself — give the surface tabindex="-1"),
 * - keeps Tab / Shift+Tab cycling inside it, through every tabbable
 *   control: Safari's Tab skips buttons and links by default, so the trap
 *   moves focus itself instead of leaving it to the browser,
 * - locks body scroll (re-entrant, so stacked surfaces don't unlock early),
 * - restores focus to the previously focused element on teardown. Safari
 *   and Firefox on macOS do not focus a button on click, so when nothing
 *   is focused the trigger is the control last pressed with a pointer.
 */

const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// The control the last pointer press landed on: the trigger to restore
// focus to when the browser did not focus it on click. A key press clears
// it, since a keyboard-opened surface has a focused trigger (or none).
let lastPressed: WeakRef<HTMLElement> | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>(TABBABLE_SELECTOR);
      lastPressed = control ? new WeakRef(control) : null;
    },
    true,
  );
  document.addEventListener(
    "keydown",
    () => {
      lastPressed = null;
    },
    true,
  );
}

function focusTrigger(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) return active;
  const pressed = lastPressed?.deref();
  return pressed?.isConnected ? pressed : null;
}

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

/** The surface's tab stops in the order the browser's Tab visits them. */
function tabbables(surface: HTMLElement): HTMLElement[] {
  const candidates = Array.from(surface.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (el) =>
      // tabindex="-1" (roving items) is focusable but no tab stop.
      el.tabIndex >= 0 &&
      !el.closest("[inert]") &&
      // offsetParent is null for display:none subtrees (e.g. collapsed
      // sections) — skip those, they can't actually take focus.
      (el.offsetParent !== null || el === document.activeElement),
  );
  // A native radio group is one stop: its checked radio, else its first.
  const stops = candidates.filter((el) => {
    if (!(el instanceof HTMLInputElement) || el.type !== "radio" || !el.name) return true;
    const group = candidates.filter(
      (other): other is HTMLInputElement =>
        other instanceof HTMLInputElement &&
        other.type === "radio" &&
        other.name === el.name &&
        other.form === el.form,
    );
    return el === (group.find((radio) => radio.checked) ?? group[0]);
  });
  // Positive tabindex values come first, ascending; then document order.
  const rank = (el: HTMLElement) => (el.tabIndex > 0 ? el.tabIndex : Number.POSITIVE_INFINITY);
  return stops
    .map((el, index) => ({ el, index }))
    .sort((a, b) => rank(a.el) - rank(b.el) || a.index - b.index)
    .map(({ el }) => el);
}

/** The stop Tab (or Shift+Tab) moves to from `active`, wrapping. */
function nextStop(items: HTMLElement[], active: Element | null, backward: boolean): HTMLElement {
  const index = active ? items.indexOf(active as HTMLElement) : -1;
  if (index !== -1) {
    return items[(index + (backward ? -1 : 1) + items.length) % items.length]!;
  }
  // Focus is on the surface or a control that is no tab stop (a roving
  // item reached with arrow keys): go to the next stop after it in the
  // document, or the last one before it.
  if (active) {
    const following = (item: HTMLElement) =>
      (active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const found = backward
      ? items
          .slice()
          .reverse()
          .find((item) => !following(item) && item !== active)
      : items.find((item) => following(item));
    if (found) return found;
  }
  return backward ? items[items.length - 1]! : items[0]!;
}

export function trapFocus(surface: HTMLElement): () => void {
  const previous = focusTrigger();

  // Initial focus: the first [autofocus] descendant that can actually take
  // focus (visible, not disabled). Verify focus really moved into the
  // surface — a hidden/disabled autofocus target would otherwise leave
  // focus behind the overlay, outside the trap.
  const autofocusTarget = Array.from(surface.querySelectorAll<HTMLElement>("[autofocus]")).find(
    (el) => el.offsetParent !== null && !(el as HTMLElement & { disabled?: boolean }).disabled,
  );
  autofocusTarget?.focus();
  if (!surface.contains(document.activeElement)) {
    surface.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.key !== "Tab") return;
    event.preventDefault();
    const items = tabbables(surface);
    if (items.length === 0) {
      surface.focus();
      return;
    }
    nextStop(items, document.activeElement, event.shiftKey).focus();
  }

  surface.addEventListener("keydown", handleKeydown);
  const unlockScroll = lockBodyScroll();

  return () => {
    surface.removeEventListener("keydown", handleKeydown);
    unlockScroll();
    previous?.focus();
  };
}
