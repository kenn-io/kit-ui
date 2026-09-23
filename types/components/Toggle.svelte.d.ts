import type { Snippet } from "svelte";
interface Props {
    /** On/off state (bindable). */
    checked?: boolean;
    disabled?: boolean;
    /** Label text after the switch; use `children` for rich content. */
    label?: string | undefined;
    id?: string;
    name?: string;
    /** Submitted form value when on (native default "on"). */
    value?: string;
    /** Native constraint validation — the form won't submit while off. */
    required?: boolean;
    /** Accessible name when there is no visible label. */
    ariaLabel?: string;
    /** Points at hint/error text elsewhere in the form. */
    ariaDescribedby?: string;
    onchange?: (checked: boolean) => void;
    class?: string;
    children?: Snippet;
}
declare const Toggle: import("svelte").Component<Props, {}, "checked">;
type Toggle = ReturnType<typeof Toggle>;
export default Toggle;
