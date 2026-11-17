import type { Attachment } from "svelte/attachments";
import { scrollerOf } from "../components/virtual.js";
import { debounce } from "./debounce.js";
import { tick } from "svelte";

/**
 * Where the reader was in a list that loads more rows as they scroll. The
 * list keeps it in its own history entry, so Back, Forward, or a reload of
 * that entry shows the same rows at the same place, with focus on the link
 * the reader followed. A new search, filter, or order starts the list at its
 * top and forgets it.
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
  /** The key of the row whose link the reader followed, if they followed one. */
  opened?: string;
}

// Each list names its own slot, so two lists in one entry keep apart.
const STATE = "listPositions";

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
  const opened = "opened" in value ? value.opened : undefined;
  return (
    typeof value.rows === "number" &&
    Number.isInteger(value.rows) &&
    value.rows > 0 &&
    typeof value.top === "string" &&
    typeof value.offset === "number" &&
    Number.isFinite(value.offset) &&
    typeof value.scrollTop === "number" &&
    Number.isFinite(value.scrollTop) &&
    (opened === undefined || typeof opened === "string")
  );
}

/** The position `list` saved in the current history entry, or null. */
export function savedListPosition(list: string): ListPosition | null {
  const saved = positions()[list];
  return isPosition(saved) ? saved : null;
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
  const scroller = scrollerOf(node);
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
function positionOf(node: HTMLElement, rows: number, opened?: string): ListPosition | null {
  if (rows === 0) return null;
  const { scroller, boxTop } = boxOf(node);
  const top = rowsOf(node).find((row) => row.getBoundingClientRect().bottom > boxTop);
  if (!top) return null;
  return {
    rows,
    top: top.dataset["listRow"] ?? "",
    offset: top.getBoundingClientRect().top - boxTop,
    scrollTop: scroller.scrollTop,
    ...(opened ? { opened } : {}),
  };
}

/**
 * Keeps `list`'s position in the current history entry while the reader
 * scrolls, and at once when they follow a link in a row. Attach it to the
 * element that holds the list's rows; each row carries its key in
 * `data-list-row`. `rows` reports how many rows the list shows.
 *
 * Nothing is written as the list unmounts: by then the address already
 * names the next entry.
 */
export function keepListPosition(list: string, rows: () => number): Attachment<HTMLElement> {
  return (node) => {
    const scroller = scrollerOf(node);
    const target: HTMLElement | Window = scroller === document.scrollingElement ? window : scroller;
    const save = (opened?: string) => {
      const position = positionOf(node, rows(), opened);
      if (position) writeListPosition(list, position);
    };
    // Browsers limit how often a page may replace its history entry, so a
    // scroll writes once it pauses.
    const onscroll = debounce(() => save(), 150);
    const onclick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const row = link?.closest<HTMLElement>("[data-list-row]");
      if (!row || !node.contains(row)) return;
      onscroll.cancel();
      save(row.dataset["listRow"]);
    };
    target.addEventListener("scroll", onscroll, { passive: true });
    node.addEventListener("click", onclick, { capture: true });
    return () => {
      onscroll.cancel();
      target.removeEventListener("scroll", onscroll);
      node.removeEventListener("click", onclick, { capture: true });
    };
  };
}

/**
 * Puts the list back where `position` says, once its rows are shown: the
 * saved top row at its saved offset, or the saved scroll position when that
 * row is gone. Focus goes to the link of the row the reader followed, unless
 * they have already moved focus elsewhere.
 */
export function restoreListPosition(node: HTMLElement, position: ListPosition): void {
  const { scroller, boxTop } = boxOf(node);
  const rows = rowsOf(node);
  const top = rows.find((row) => row.dataset["listRow"] === position.top);
  if (top) {
    scroller.scrollTop += top.getBoundingClientRect().top - boxTop - position.offset;
  } else {
    scroller.scrollTop = position.scrollTop;
  }
  const opened = rows.find((row) => row.dataset["listRow"] === position.opened);
  const focused = document.activeElement;
  if (opened && (focused === null || focused === document.body)) {
    opened.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });
  }
}

/** Restore a saved position, revealing an unrendered virtual row if needed. */
export async function placeList(
  node: HTMLElement,
  position: ListPosition,
  options: {
    indexOf: (key: string) => number;
    scrollToIndex: (index: number, offset: number) => void;
  },
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
        const index = options.indexOf(position.top);
        if (index < 0) {
          restoreListPosition(node, position);
          break;
        }
        options.scrollToIndex(index, position.offset);
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
