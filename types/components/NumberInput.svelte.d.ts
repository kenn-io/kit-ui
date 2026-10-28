import type { Snippet } from "svelte";
import { type TextInputSize } from "./TextInput.svelte";
interface Props {
    /** Current number, or null when the field is empty (bindable). */
    value?: number | null;
    min?: number;
    max?: number;
    /** Arrow-key increment, and the grid the arrows snap to (anchored at
     * `min`). Its decimal places, and those of `min` and `max`, decide
     * whether a decimal point can be typed: the default 1 takes integers
     * only. */
    step?: number;
    placeholder?: string;
    size?: TextInputSize;
    /** Red border + aria-invalid, e.g. failed validation. */
    invalid?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    /** Stretch to the container width. */
    block?: boolean;
    id?: string;
    name?: string;
    /** Accessible name when there is no associated `<label for>`. */
    ariaLabel?: string;
    /** Validation message when a required field holds text that is not a
     * number yet, such as a lone "-". An empty required field uses the
     * browser's own message. */
    requiredMessage?: string;
    ariaDescribedby?: string;
    /** Focus the input when it mounts. */
    autofocus?: boolean;
    /** Called when typing or an arrow key changes the number. */
    oninput?: (value: number | null) => void;
    /** Called when a change is committed: an arrow step, or leaving the
     * field (blur or Enter) with a different number than on entry. */
    onchange?: (value: number | null) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onblur?: () => void;
    /** Leading adornment inside the border. */
    prefix?: Snippet;
    /** Trailing adornment inside the border, e.g. a unit such as "sec". */
    suffix?: Snippet;
    /** The underlying input element (bindable) — for focus management. */
    inputEl?: HTMLInputElement | undefined;
    class?: string;
}
declare const NumberInput: import("svelte").Component<Props, {}, "value" | "inputEl">;
type NumberInput = ReturnType<typeof NumberInput>;
export default NumberInput;
