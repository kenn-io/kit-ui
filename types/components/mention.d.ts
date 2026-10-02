export interface MentionOption {
    /** Stable identity for row keying. */
    id: string;
    /** Inserted after the trigger character on select (e.g. an issue id). */
    insert: string;
    /** Primary row text. */
    label: string;
    /** Secondary text, rendered dim at the row's trailing edge. */
    meta?: string;
}
/** One character that opens the menu, with its own lookup. A composer can
 * offer several, e.g. "/" for commands and "@" for files. */
export interface MentionTrigger {
    /** Single character that opens the menu when it starts a word. */
    char: string;
    /** Called with the text between the trigger and the caret (may be ""). */
    search: (query: string) => MentionOption[] | Promise<MentionOption[]>;
    /** Keep the menu closed while nothing matches (see MentionTextarea). */
    hideEmpty?: boolean;
    searchingLabel?: string;
    emptyLabel?: string;
    /** Accessible name of the menu (default "Insert reference"). */
    menuLabel?: string;
}
