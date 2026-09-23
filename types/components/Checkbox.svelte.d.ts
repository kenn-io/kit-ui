import type { Snippet } from "svelte";
interface Props {
    /** Checked state (bindable). */
    checked?: boolean;
    /** Tri-state "some children selected" dash (Forge's TreeCheckbox).
     * Purely visual on top of `checked`; the consumer owns clearing it. */
    indeterminate?: boolean;
    disabled?: boolean;
    /** Label text after the box; use `children` for rich label content. */
    label?: string | undefined;
    id?: string;
    name?: string;
    /** Submitted form value when checked (native default "on"). */
    value?: string;
    /** Native constraint validation — the form won't submit unchecked. */
    required?: boolean;
    /** Accessible name when there is no visible label. */
    ariaLabel?: string;
    /** Points at hint/error text elsewhere in the form. */
    ariaDescribedby?: string;
    onchange?: (checked: boolean) => void;
    class?: string;
    children?: Snippet;
}
declare const Checkbox: import("svelte").Component<Props, {}, "checked">;
type Checkbox = ReturnType<typeof Checkbox>;
export default Checkbox;
