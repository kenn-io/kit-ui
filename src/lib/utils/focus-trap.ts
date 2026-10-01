/*
 * Focus management for modal surfaces (Modal, DetailDrawer, custom overlays).
 *
 * `trapFocus` is a Svelte attachment ({@attach trapFocus}). While the surface
 * is mounted it:
 * - moves focus into it (the first [autofocus] descendant if present,
 *   otherwise the surface itself — give the surface tabindex="-1"),
 * - keeps Tab / Shift+Tab cycling inside it. The browser moves focus,
 *   in its own tab order (iframe content included); invisible guards just
 *   before and after the surface wrap focus to the other end,
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
  "details > summary:first-of-type",
  "audio[controls]",
  "video[controls]",
  "iframe",
  '[contenteditable]:not([contenteditable="false"])',
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

/** Rendered and visible: not in a display:none subtree (a collapsed
 * section) and not visibility:hidden. */
function isShown(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility({ visibilityProperty: true });
  }
  // Older engines and DOMs without layout (jsdom): computed styles only.
  if (getComputedStyle(el).visibility === "hidden") return false;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).display === "none") return false;
    // A closed <details> shows only its summary.
    if (node !== el && node instanceof HTMLDetailsElement && !node.open) {
      if (!node.querySelector(":scope > summary")?.contains(el)) return false;
    }
  }
  return true;
}

/** A tab stop the browser could land on: not inert, disabled, hidden, or
 * removed from the tab order with tabindex="-1". */
function isTabStop(el: HTMLElement): boolean {
  return (
    (el.tabIndex >= 0 || (!el.hasAttribute("tabindex") && el.isContentEditable)) &&
    !el.closest("[inert]") &&
    // Also catches controls inside a disabled fieldset.
    !el.matches(":disabled") &&
    isShown(el)
  );
}

/** Where a wrap lands: the first (or last) tab stop in the browser's
 * order, positive tabindex values first. A radio group is entered at
 * its checked radio. */
function edgeStop(surface: HTMLElement, last: boolean): HTMLElement | null {
  const rank = (el: HTMLElement) => (el.tabIndex > 0 ? el.tabIndex : Number.POSITIVE_INFINITY);
  const stops = Array.from(surface.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR))
    .filter(isTabStop)
    .map((el, index) => ({ el, index }))
    .sort((a, b) => rank(a.el) - rank(b.el) || a.index - b.index)
    .map(({ el }) => el);
  const stop = last ? stops[stops.length - 1] : stops[0];
  if (stop instanceof HTMLInputElement && stop.type === "radio" && stop.name && !stop.checked) {
    const checked = stops.find(
      (other) =>
        other instanceof HTMLInputElement &&
        other.type === "radio" &&
        other.name === stop.name &&
        other.form === stop.form &&
        other.checked,
    );
    if (checked) return checked;
  }
  return stop ?? null;
}

/** An invisible, focusable element at one edge of the surface. */
function focusGuard(onFocus: () => void): HTMLSpanElement {
  const guard = document.createElement("span");
  guard.tabIndex = 0;
  guard.setAttribute("aria-hidden", "true");
  guard.dataset.kitFocusGuard = "";
  guard.style.cssText =
    "position: fixed; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none;";
  guard.addEventListener("focus", onFocus);
  return guard;
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

  // The browser moves focus on Tab, so the order is always its own and
  // focus can enter an iframe and come back out. Tab past either end
  // lands on a guard, which wraps focus to the other end.
  const wrapTo = (last: boolean) => {
    const stop = edgeStop(surface, last);
    stop?.focus();
    if (!stop || !surface.contains(document.activeElement)) surface.focus();
  };
  const startGuard = focusGuard(() => wrapTo(true));
  const endGuard = focusGuard(() => wrapTo(false));
  surface.before(startGuard);
  surface.after(endGuard);
  const unlockScroll = lockBodyScroll();

  return () => {
    startGuard.remove();
    endGuard.remove();
    unlockScroll();
    previous?.focus();
  };
}
