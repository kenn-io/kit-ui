import type { Attachment } from "svelte/attachments";
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
/** The position `list` saved in the current history entry, or null. */
export declare function savedListPosition(list: string): ListPosition | null;
/**
 * Writes `position` for `list` into the current history entry, or removes it
 * when null, keeping the entry's address and other state. Pass `href` to
 * change the address in the same write, as a list does when its filter
 * changes.
 */
export declare function writeListPosition(list: string, position: ListPosition | null, href?: string): void;
/**
 * Where the list in `node` is scrolled now, for a list showing `rows` rows:
 * its first row in view and how far below the top of the scroll box it sits.
 */
export declare function positionOf(node: HTMLElement, rows: number, opened?: string): ListPosition | null;
/**
 * Keeps `list`'s position in the current history entry while the reader
 * scrolls, and at once when they follow a link in a row. Attach it to the
 * element that holds the list's rows; each row carries its key in
 * `data-list-row`. `rows` reports how many rows the list shows.
 *
 * Nothing is written as the list unmounts: by then the address already
 * names the next entry.
 */
export declare function keepListPosition(list: string, rows: () => number): Attachment<HTMLElement>;
/**
 * Puts the list back where `position` says, once its rows are shown: the
 * saved top row at its saved offset, or the saved scroll position when that
 * row is gone. Focus goes to the link of the row the reader followed, unless
 * they have already moved focus elsewhere.
 */
export declare function restoreListPosition(node: HTMLElement, position: ListPosition): void;
/** Restore a saved position, revealing an unrendered virtual row if needed. */
export declare function placeList(node: HTMLElement, position: ListPosition, options: {
    indexOf: (key: string) => number;
    scrollToIndex: (index: number, offset: number) => void;
}): Promise<void>;
