import { type Snippet } from "svelte";
import type { MentionOption } from "./mention.js";
interface Props {
    value: string;
    /** App-provided lookup: called with the text between the trigger
     * character and the caret (may be empty on a bare trigger). Results
     * beyond `maxResults` are dropped. */
    search: (query: string) => MentionOption[] | Promise<MentionOption[]>;
    /** Character that opens the menu at a word boundary (default "#"). */
    trigger?: string;
    /** Where the trigger counts: at any word boundary ("word"), or only as
     * the first character of the text ("start"), as slash commands do. */
    triggerAt?: "word" | "start";
    /** Keep the menu closed while nothing matches instead of showing the
     * searching and empty rows. Suits synchronous searches over a fixed
     * list, where an empty menu only gets in the way of typing. */
    hideEmpty?: boolean;
    /** Borderless, transparent field that grows with its content and has no
     * resize handle, for a textarea inside a composer card that draws its
     * own frame. Size it with --kit-mention-padding, --kit-mention-min-height,
     * and --kit-mention-max-height. */
    embedded?: boolean;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    ariaLabel?: string;
    ariaDescribedby?: string;
    maxResults?: number;
    searchingLabel?: string;
    emptyLabel?: string;
    /** Custom row rendering; receives the option and whether it is the
     * keyboard-active row. Defaults to trigger+insert, label, dim meta. */
    option?: Snippet<[MentionOption, boolean]>;
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
declare const MentionTextarea: import("svelte").Component<Props, {}, "value" | "textareaEl">;
type MentionTextarea = ReturnType<typeof MentionTextarea>;
export default MentionTextarea;
