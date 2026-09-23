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
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    ariaLabel?: string;
    maxResults?: number;
    searchingLabel?: string;
    emptyLabel?: string;
    /** Custom row rendering; receives the option and whether it is the
     * keyboard-active row. Defaults to trigger+insert, label, dim meta. */
    option?: Snippet<[MentionOption, boolean]>;
    /** Receives keys the mention menu did not consume. */
    onkeydown?: (event: KeyboardEvent) => void;
}
declare const MentionTextarea: import("svelte").Component<Props, {}, "value">;
type MentionTextarea = ReturnType<typeof MentionTextarea>;
export default MentionTextarea;
