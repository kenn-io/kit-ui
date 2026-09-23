export type TextInputSize = "sm" | "md" | "lg";
import type { Snippet } from "svelte";
interface Props {
    /** Current text (bindable). */
    value?: string;
    /** Input type. Text-like types only — date/checkbox/radio/etc. have
     * their own chrome and don't belong in this wrapper. */
    type?: "text" | "search" | "email" | "url" | "password" | "tel";
    placeholder?: string;
    /** sm = 24px, md = 28px tall — the shared toolbar control heights. */
    size?: TextInputSize;
    /** Red border + aria-invalid, e.g. failed validation. */
    invalid?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    /** Stretch to the container width (default shrink-wraps ~180px). */
    block?: boolean;
    id?: string;
    name?: string;
    /** Accessible name when there is no associated `<label for>`. */
    ariaLabel?: string;
    /** Combobox wiring for fields that drive a listbox (CommandPalette):
     * set `role="combobox"` and point these at the list and the
     * highlighted option so keyboard navigation is announced. */
    role?: "combobox";
    ariaExpanded?: boolean;
    ariaControls?: string;
    ariaActivedescendant?: string;
    ariaAutocomplete?: "list" | "inline" | "both" | "none";
    ariaDescribedby?: string;
    /** Focus the input when it mounts. */
    autofocus?: boolean;
    autocomplete?: HTMLInputElement["autocomplete"];
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onblur?: () => void;
    /** Leading adornment inside the border (icon, unit). */
    prefix?: Snippet;
    /** Trailing adornment inside the border (icon, clear button, kbd). */
    suffix?: Snippet;
    /** The underlying input element (bindable) — for focus management. */
    inputEl?: HTMLInputElement | undefined;
    class?: string;
}
declare const TextInput: import("svelte").Component<Props, {}, "value" | "inputEl">;
type TextInput = ReturnType<typeof TextInput>;
export default TextInput;
