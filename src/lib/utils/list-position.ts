import type { Attachment } from "svelte/attachments";
import { scrollerOf } from "../components/virtual.js";
import { debounce } from "./debounce.js";
import { tick } from "svelte";

/**
 * Where the reader was in a list that loads more rows as they scroll. The
 * list keeps it in its own history entry, so Back, Forward, or a reload of
 * that entry shows the same rows at the same place. A new search, filter, or
 * order starts the list at its top and forgets it.
 */
export interface ListPosition {
  /** How many rows the list showed. */
  rows: number;
  /** The key of the first row in view. */
  top: string;
  /** How far that row's top sat below the top of the scroll box, in pixels. */
  offset: number;
  /** The scroll box's position, for when the top row is gone. */
  scrollTop: number;
}

// Each list names its own slot, so two lists in one entry keep apart.
const STATE = "listPositions";
const MAX_RESTORE_ROWS = 1000;

function positions(): Record<string, unknown> {
  // A page rendered on the server has no history.
  if (typeof window === "undefined") return {};
  const state: unknown = window.history.state;
  if (typeof state !== "object" || state === null || !(STATE in state)) return {};
  const value = state[STATE];
  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function isPosition(value: unknown): value is ListPosition {
  if (typeof value !== "object" || value === null) return false;
  if (!("rows" in value && "top" in value && "offset" in value && "scrollTop" in value)) {
    return false;
  }
  return (
    typeof value.rows === "number" &&
    Number.isInteger(value.rows) &&
    value.rows > 0 &&
    typeof value.top === "string" &&
    typeof value.offset === "number" &&
    Number.isFinite(value.offset) &&
    typeof value.scrollTop === "number" &&
    Number.isFinite(value.scrollTop)
  );
}

/** The position `list` saved in the current history entry, or null. */
export function savedListPosition(list: string): ListPosition | null {
  const saved = positions()[list];
  return isPosition(saved) ? { ...saved, rows: Math.min(saved.rows, MAX_RESTORE_ROWS) } : null;
}

/**
 * Writes `position` for `list` into the current history entry, or removes it
 * when null, keeping the entry's address and other state. Pass `href` to
 * change the address in the same write, as a list does when its filter
 * changes.
 */
export function writeListPosition(
  list: string,
  position: ListPosition | null,
  href: string = window.location.href,
): void {
  const state: unknown = window.history.state;
  const base = typeof state === "object" && state !== null ? state : {};
  const next = positions();
  if (position) next[list] = position;
  else delete next[list];
  window.history.replaceState({ ...base, [STATE]: next }, "", href);
}

// The box that scrolls the list, and the top edge of its visible part.
function boxOf(node: HTMLElement): { scroller: HTMLElement; boxTop: number } {
  const scroller = scrollerOf(node, true);
  const boxTop = scroller === document.documentElement ? 0 : scroller.getBoundingClientRect().top;
  return { scroller, boxTop };
}

function rowsOf(node: HTMLElement): HTMLElement[] {
  return [...node.querySelectorAll<HTMLElement>("[data-list-row]")];
}

/**
 * Where the list in `node` is scrolled now, for a list showing `rows` rows:
 * its first row in view and how far below the top of the scroll box it sits.
 */
function positionOf(node: HTMLElement, rows: number): ListPosition | null {
  if (rows === 0) return null;
  const { scroller, boxTop } = boxOf(node);
  const top = rowsOf(node).find((row) => row.getBoundingClientRect().bottom > boxTop);
  if (!top) return null;
  return {
    rows,
    top: top.dataset["listRow"] ?? "",
    offset: top.getBoundingClientRect().top - boxTop,
    scrollTop: scroller.scrollTop,
  };
}

/**
 * Keeps `list`'s position in the current history entry while the reader
 * scrolls, and at once when they click the list. Attach it to the
 * element that holds the list's rows; each row carries its key in
 * `data-list-row`. `rows` reports how many rows the list shows.
 *
 * Nothing is written as the list unmounts: by then the address already
 * names the next entry.
 */
export function keepListPosition(list: string, rows: () => number): Attachment<HTMLElement> {
  return (node) => {
    const save = () => {
      const position = positionOf(node, rows());
      if (position) writeListPosition(list, position);
    };
    // Browsers limit how often a page may replace its history entry, so a
    // scroll writes once it pauses.
    const saveScroll = debounce(() => save(), 150);
    const onscroll = (event: Event) => {
      if (
        event.target === document ||
        (event.target instanceof Element && event.target.contains(node))
      )
        saveScroll();
    };
    const onclick = () => {
      saveScroll.cancel();
      save();
    };
    document.addEventListener("scroll", onscroll, { capture: true, passive: true });
    node.addEventListener("click", onclick, { capture: true });
    return () => {
      saveScroll.cancel();
      document.removeEventListener("scroll", onscroll, { capture: true });
      node.removeEventListener("click", onclick, { capture: true });
    };
  };
}

/**
 * Puts the list back where `position` says, once its rows are shown: the
 * saved top row at its saved offset, or the saved scroll position when that
 * row is gone.
 */
function restoreListPosition(node: HTMLElement, position: ListPosition): void {
  const { scroller, boxTop } = boxOf(node);
  const rows = rowsOf(node);
  const top = rows.find((row) => row.dataset["listRow"] === position.top);
  if (top) {
    scroller.scrollTop += top.getBoundingClientRect().top - boxTop - position.offset;
  } else {
    scroller.scrollTop = position.scrollTop;
  }
}

/** Restore a saved position, revealing an unrendered virtual row if needed. */
export async function placeList(
  node: HTMLElement,
  position: ListPosition,
  reveal?: (key: string, offset: number) => boolean,
): Promise<void> {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  const inputs = ["wheel", "touchstart", "pointerdown", "keydown"];
  for (const input of inputs) window.addEventListener(input, stop, { capture: true });
  try {
    await tick();
    let steady = 0;
    for (let pass = 0; pass < 12 && steady < 2 && !stopped && node.isConnected; pass++) {
      const row = rowsOf(node).find((r) => r.dataset["listRow"] === position.top);
      if (!row) {
        steady = 0;
        if (!reveal?.(position.top, position.offset)) {
          // Let the virtual window render and settle after the offset changes.
          restoreListPosition(node, position);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          continue;
        }
      } else {
        const { boxTop } = boxOf(node);
        const drift = row.getBoundingClientRect().top - boxTop - position.offset;
        steady = Math.abs(drift) < 1 ? steady + 1 : 0;
        restoreListPosition(node, position);
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  } finally {
    for (const input of inputs) window.removeEventListener(input, stop, { capture: true });
  }
}
