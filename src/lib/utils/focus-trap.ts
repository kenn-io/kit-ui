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
  "details > summary:first-of-type",
  "audio[controls]",
  "video[controls]",
  // No iframe: focus inside one fires keydown in the frame's document,
  // out of the trap's reach, so Tab could leave the surface from there.
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

/** Focusable by Tab, ignoring native radio grouping. */
function isCandidate(el: HTMLElement): boolean {
  const explicit = el.hasAttribute("tabindex");
  // Tab visits an editing host, but not one nested inside another unless
  // it has its own tabindex. Some engines report -1 for an editing host
  // with no tabindex.
  const nestedEditable = !explicit && el.parentElement?.isContentEditable === true;
  return (
    // tabindex="-1" (roving items) is focusable but no tab stop.
    (el.tabIndex >= 0 || (!explicit && el.isContentEditable)) &&
    !(el.hasAttribute("contenteditable") && nestedEditable) &&
    !el.closest("[inert]") &&
    // Also catches controls inside a disabled fieldset.
    !el.matches(":disabled") &&
    (el === document.activeElement || isShown(el))
  );
}

function radioGroup(el: Element | null, candidates: HTMLElement[]): HTMLInputElement[] | null {
  if (!(el instanceof HTMLInputElement) || el.type !== "radio" || !el.name) return null;
  return candidates.filter(
    (other): other is HTMLInputElement =>
      other instanceof HTMLInputElement &&
      other.type === "radio" &&
      other.name === el.name &&
      other.form === el.form,
  );
}

function candidatesIn(surface: HTMLElement): HTMLElement[] {
  return Array.from(surface.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(isCandidate);
}

/** The surface's tab stops in the order the browser's Tab visits them. */
function tabbables(candidates: HTMLElement[]): HTMLElement[] {
  // A native radio group is one stop: its checked radio, else its first
  // (entered backward, its last; see entryPoint).
  const stops = candidates.filter((el) => {
    const group = radioGroup(el, candidates);
    return !group || el === (group.find((radio) => radio.checked) ?? group[0]);
  });
  // Positive tabindex values come first, ascending; then document order.
  const rank = (el: HTMLElement) => (el.tabIndex > 0 ? el.tabIndex : Number.POSITIVE_INFINITY);
  return stops
    .map((el, index) => ({ el, index }))
    .sort((a, b) => rank(a.el) - rank(b.el) || a.index - b.index)
    .map(({ el }) => el);
}

/** The stop Tab (or Shift+Tab) moves to from `active`, wrapping. */
function nextStop(
  items: HTMLElement[],
  candidates: HTMLElement[],
  active: Element | null,
  backward: boolean,
): HTMLElement {
  // Any radio of a group stands for the group's stop.
  const group = radioGroup(active, candidates);
  const current = group
    ? (items.find((item) => group.includes(item as HTMLInputElement)) ?? null)
    : active;
  const index = current ? items.indexOf(current as HTMLElement) : -1;
  if (index !== -1) {
    return items[(index + (backward ? -1 : 1) + items.length) % items.length]!;
  }
  // Focus is on the surface or a control that is no tab stop (a roving
  // item reached with arrow keys): the nearest stop after it in document
  // order, or before it going backward.
  if (active) {
    const following = (item: HTMLElement) =>
      (active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const inDocumentOrder = items
      .slice()
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const found = backward
      ? inDocumentOrder.reverse().find((item) => !following(item) && item !== active)
      : inDocumentOrder.find((item) => following(item));
    if (found) return found;
  }
  return backward ? items[items.length - 1]! : items[0]!;
}

/** Where focus lands for a stop: an unchecked radio group entered
 * backward lands on its last radio, as the browser does. */
function entryPoint(stop: HTMLElement, candidates: HTMLElement[], backward: boolean): HTMLElement {
  const group = radioGroup(stop, candidates);
  if (!group || !backward || group.some((radio) => radio.checked)) return stop;
  return group[group.length - 1]!;
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
    const candidates = candidatesIn(surface);
    const items = tabbables(candidates);
    if (items.length === 0) {
      surface.focus();
      return;
    }
    // A stop can refuse focus (an iframe still loading, a control disabled
    // a moment ago); move on to the next one rather than stall.
    let target = nextStop(items, candidates, document.activeElement, event.shiftKey);
    for (let tries = 0; tries < items.length; tries += 1) {
      const entry = entryPoint(target, candidates, event.shiftKey);
      entry.focus();
      if (document.activeElement === entry) return;
      target = nextStop(items, candidates, target, event.shiftKey);
    }
    surface.focus();
  }

  surface.addEventListener("keydown", handleKeydown);
  const unlockScroll = lockBodyScroll();

  return () => {
    surface.removeEventListener("keydown", handleKeydown);
    unlockScroll();
    previous?.focus();
  };
}
