export type ColorInputSize = "sm" | "md";
/** A quick pick shown as a swatch button beside the field. */
export interface ColorInputSwatch {
    /** Hex color, with or without `#`, 3 or 6 digits. */
    value: string;
    /** Accessible name and tooltip, for example "Okabe-Ito blue". */
    label: string;
}
interface Props {
    /** Current color as `#rrggbb` (bindable). */
    value?: string;
    /** Called with the normalized `#rrggbb` color for every pick: while
     * the native picker is open, on a swatch click, and when a valid hex
     * typed into the field is committed with Enter or blur. */
    onchange?: (value: string) => void;
    /** Quick picks shown as swatch buttons after the field. */
    swatches?: readonly ColorInputSwatch[];
    /** Accessible name for the whole control. */
    ariaLabel?: string;
    /** Accessible name for the native picker. */
    pickerLabel?: string;
    /** Accessible name for the hex text field. */
    hexLabel?: string;
    /** Marks the control invalid, for example when the app finds the color
     * has too little contrast. The hex field also marks itself invalid
     * after a commit of text that is not a hex color. */
    invalid?: boolean;
    /** Points at the app's explanation, such as a contrast warning. */
    ariaDescribedby?: string;
    /** sm = 24px, md = 28px tall, matching TextInput. */
    size?: ColorInputSize;
    disabled?: boolean;
    /** id of the hex text field, for an external `<label for>`. */
    id?: string;
    class?: string;
}
declare const ColorInput: import("svelte").Component<Props, {}, "value">;
type ColorInput = ReturnType<typeof ColorInput>;
export default ColorInput;
