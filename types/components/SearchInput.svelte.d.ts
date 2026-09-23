import { type TextInputSize } from "./TextInput.svelte";
interface Props {
    /** Current query (bindable). */
    value?: string;
    placeholder?: string;
    size?: TextInputSize;
    invalid?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    /** Stretch to the container width. */
    block?: boolean;
    /** Focus the input when it mounts. */
    autofocus?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
    /** Combobox wiring, forwarded to TextInput (see its docs). */
    role?: "combobox";
    ariaExpanded?: boolean;
    ariaControls?: string;
    ariaActivedescendant?: string;
    ariaAutocomplete?: "list" | "inline" | "both" | "none";
    /** Shortcut hint rendered as a KbdBadge while the field is empty,
     * e.g. ["⌘", "K"]. */
    keys?: string[];
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    /** Fires after the clear button or Escape empties the field. */
    onclear?: () => void;
    clearLabel?: string;
    /** The underlying input element (bindable) — e.g. for app shortcut
     * handlers that focus the search field. */
    inputEl?: HTMLInputElement | undefined;
    class?: string;
}
declare const SearchInput: import("svelte").Component<Props, {}, "value" | "inputEl">;
type SearchInput = ReturnType<typeof SearchInput>;
export default SearchInput;
