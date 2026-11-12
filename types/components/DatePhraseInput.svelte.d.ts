interface Props {
    /** The typed text (bindable). */
    value?: string;
    placeholder?: string;
    /** Accessible name of the text field. */
    ariaLabel?: string;
    clearLabel?: string;
    /** The line under the field: what the text resolves to, a hint, or a
     * no-match message. Announced politely to screen readers. */
    summary?: string;
    /** Style the summary as a no-match message. */
    invalid?: boolean;
    /** BCP 47 tag for month and weekday names offered as completions.
     * Omitted = browser locale. */
    locale?: string | undefined;
    /** Focus the field when it mounts. */
    autofocus?: boolean;
    /** Called on every edit, including an accepted completion and clear. */
    oninput?: (value: string) => void;
    /** Called on Enter. */
    onsubmit?: () => void;
    /** Called after the clear button empties the field. */
    onclear?: () => void;
    /** The underlying input element (bindable). */
    inputEl?: HTMLInputElement | undefined;
    class?: string;
}
declare const DatePhraseInput: import("svelte").Component<Props, {}, "value" | "inputEl">;
type DatePhraseInput = ReturnType<typeof DatePhraseInput>;
export default DatePhraseInput;
