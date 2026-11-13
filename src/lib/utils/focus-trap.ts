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
 *   When the trigger is gone or can no longer take focus (a confirmed
 *   delete removed its row), focus goes to the nearest tab stop left where
 *   it was. Focus the app already moved somewhere else stays put.
 */

export const TABBABLE_SELECTOR = [
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

// Kept at startup by "sideEffects" in package.json, so a lazy dialog still sees its opening press.
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

// Focus already inside the surface is not the trigger: Svelte applies
// autofocus before attachments run when focus was on the page.
function focusTrigger(surface: HTMLElement): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && !surface.contains(active)) {
    return active;
  }
  const pressed = lastPressed?.deref();
  return pressed?.isConnected && !surface.contains(pressed) ? pressed : null;
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
  guard.setAttribute("data-kit-focus-guard", "");
  guard.style.cssText =
    "position: fixed; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none;";
  guard.addEventListener("focus", onFocus);
  return guard;
}

// Surfaces with a live trap, so a fallback stays inside an outer one.
const openSurfaces = new Set<HTMLElement>();

/** Focus is on nothing a person can use: the page itself, an element that
 * left, or something inside the surface that is closing. */
function focusIsLost(surface: HTMLElement): boolean {
  const active = document.activeElement;
  return (
    !(active instanceof HTMLElement) ||
    active === document.body ||
    !active.isConnected ||
    surface.contains(active)
  );
}

/** Where the trigger was: each ancestor with its element siblings, nearest
 * first. All of them, since a close can remove the trigger's neighbors too.
 * Element siblings, since Svelte's anchor comments leave with the trigger. */
type Step = { node: Element; after: Element[]; before: Element[] };

function pathTo(el: HTMLElement | null): Step[] {
  const path: Step[] = [];
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    const after: Element[] = [];
    const before: Element[] = [];
    for (let s = node.nextElementSibling; s; s = s.nextElementSibling) after.push(s);
    for (let s = node.previousElementSibling; s; s = s.previousElementSibling) before.push(s);
    path.push({ node, after, before });
  }
  return path;
}

const follows = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** The tab stop nearest where the trigger was: the first one after that
 * spot, else the last one before it, searching outward from the closest
 * ancestor still on the page. */
function nearestStop(path: Step[], surface: HTMLElement): HTMLElement | null {
  const trigger = path[0]?.node;
  if (!trigger) return null;
  let scope: Element | null;
  let isAfter: (el: Element) => boolean;
  if (trigger.isConnected) {
    // Still on the page but disabled, hidden or inert.
    scope = trigger.parentElement;
    isAfter = (el) => follows(trigger, el) && !trigger.contains(el);
  } else {
    const kept = path.findIndex((step) => step.node.isConnected);
    const parent = path[kept]?.node ?? document.body;
    const step = path[(kept === -1 ? path.length : kept) - 1];
    const stays = (el: Element) => el.parentElement === parent;
    const next = step?.after.find(stays);
    const previous = step?.before.find(stays);
    scope = parent;
    if (next?.parentElement === parent) {
      isAfter = (el) => el === next || follows(next, el);
    } else if (previous?.parentElement === parent) {
      isAfter = (el) => follows(previous, el) && !previous.contains(el);
    } else {
      isAfter = (el) => follows(parent, el);
    }
  }
  for (; scope; scope = scope.parentElement) {
    const stops = Array.from(scope.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
      (el) => isTabStop(el) && !surface.contains(el) && !el.hasAttribute("data-kit-focus-guard"),
    );
    const found = stops.find(isAfter) ?? stops.filter((el) => !isAfter(el)).pop();
    if (found) return found;
    // An outer trap that has nothing else to focus takes focus itself.
    if (scope instanceof HTMLElement && openSurfaces.has(scope)) return scope;
  }
  return null;
}

/** Focus the trigger, or the nearest tab stop when it cannot take focus. */
function restoreFocus(previous: HTMLElement | null, path: Step[], surface: HTMLElement): void {
  previous?.focus();
  if (previous && document.activeElement === previous) return;
  nearestStop(path, surface)?.focus();
}

export function trapFocus(surface: HTMLElement): () => void {
  const previous = focusTrigger(surface);
  const path = pathTo(previous);

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
  openSurfaces.add(surface);

  return () => {
    startGuard.remove();
    endGuard.remove();
    unlockScroll();
    openSurfaces.delete(surface);
    if (focusIsLost(surface)) restoreFocus(previous, path, surface);
    // Svelte removes a block's DOM before it runs the block's teardowns, but
    // the update that closed the surface can remove the focused element later
    // on, such as a confirmed delete that drops the trigger's row. Look again
    // once that update is done.
    queueMicrotask(() => {
      if (focusIsLost(surface)) restoreFocus(previous, path, surface);
    });
  };
}
