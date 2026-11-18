import type { Attachment } from "svelte/attachments";
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
 * Keeps `list`'s position in the current history entry while the reader
 * scrolls, and at once when they click the list. Attach it to the
 * element that holds the list's rows; each row carries its key in
 * `data-list-row`. `rows` reports how many rows the list shows.
 *
 * Nothing is written as the list unmounts: by then the address already
 * names the next entry.
 */
export declare function keepListPosition(list: string, rows: () => number): Attachment<HTMLElement>;
/** Restore a saved position after `ready` resolves, revealing an unrendered
 * virtual row if needed. User input during the wait cancels placement. */
export declare function placeList(node: HTMLElement, position: ListPosition, reveal?: (key: string, offset: number) => boolean, ready?: Promise<unknown>): Promise<void>;
