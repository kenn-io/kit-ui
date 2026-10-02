import { type Snippet } from "svelte";
import type { MentionOption, MentionTrigger } from "./mention.js";
interface BaseProps {
    value: string;
    /** Keep the menu closed while nothing matches instead of showing the
     * searching and empty rows. Suits synchronous searches over a fixed
     * list, where an empty menu only gets in the way of typing. */
    hideEmpty?: boolean;
    /** Borderless, transparent field that grows with its content and has no
     * resize handle, for a textarea inside a composer card that draws its
     * own frame. Size it with --kit-mention-padding, --kit-mention-min-height,
     * and --kit-mention-max-height. */
    embedded?: boolean;
    /** Where the menu opens: below the field when it fits ("auto"), or
     * always above or below. A composer at the bottom of a panel opens it
     * above so the menu never covers its toolbar. */
    placement?: "auto" | "top" | "bottom";
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    ariaLabel?: string;
    ariaDescribedby?: string;
    maxResults?: number;
    searchingLabel?: string;
    emptyLabel?: string;
    /** Custom row rendering; receives the option, whether it is the
     * keyboard-active row, and the trigger character that opened the menu.
     * Defaults to trigger+insert, label, dim meta. */
    option?: Snippet<[MentionOption, boolean, string]>;
    /** Receives keys the mention menu did not consume. */
    onkeydown?: (event: KeyboardEvent) => void;
    /** Called with the new text after each edit. */
    oninput?: (value: string) => void;
    /** Receives paste events, e.g. to take pasted files. */
    onpaste?: (event: ClipboardEvent) => void;
    /** The underlying textarea (bindable) — for focus and caret management. */
    textareaEl?: HTMLTextAreaElement | undefined;
    class?: string;
}
type Props = BaseProps & ({
    /** App-provided lookup for `trigger`: called with the text between
     * the trigger character and the caret (may be empty on a bare
     * trigger). Results beyond `maxResults` are dropped. */
    search: (query: string) => MentionOption[] | Promise<MentionOption[]>;
    /** Character that opens the menu when it starts a word (default "#"). */
    trigger?: string;
    triggers?: never;
} | {
    /** Several triggers, each with its own search, e.g. "/" for
     * commands and "@" for files. Replaces `hideEmpty` and the status
     * labels. */
    triggers: MentionTrigger[];
    search?: never;
    trigger?: never;
});
declare const MentionTextarea: import("svelte").Component<Props, {}, "value" | "textareaEl">;
type MentionTextarea = ReturnType<typeof MentionTextarea>;
export default MentionTextarea;
