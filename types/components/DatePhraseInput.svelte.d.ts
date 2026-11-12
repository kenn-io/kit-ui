/** Whether a picker should focus the field when its popover opens: not on
 * touch-first devices, where focus raises the on-screen keyboard over the
 * calendar. */
export declare function focusOnOpen(): boolean;
interface Props {
    /** The typed text (bindable). */
    value?: string;
    placeholder?: string;
    /** Accessible name of the text field. */
    ariaLabel?: string;
    clearLabel?: string;
    /** What the text resolves to, or a no-match message. Shown under the
     * field and announced politely to screen readers when it changes. */
    summary?: string;
    /** Shown under the field while `summary` is empty; never announced. */
    hint?: string;
    /** The summary is a no-match message: styles it and marks the field
     * aria-invalid. */
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
