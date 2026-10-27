export interface RadioGroupOption {
    value: string;
    label: string;
    disabled?: boolean;
}
interface Props {
    options: RadioGroupOption[];
    /** Chosen option value (bindable); undefined leaves every option unchosen. */
    value?: string | undefined;
    /** The group's visible name, rendered as the fieldset's legend. */
    legend: string;
    /** Shared input name: it groups the radios for arrow keys and form
     * submission. Defaults to an id unique to this instance. */
    name?: string;
    /** Id of the fieldset. */
    id?: string;
    /** Disables every option. */
    disabled?: boolean;
    /** Native constraint validation: the form won't submit with no choice. */
    required?: boolean;
    /** Points at hint/error text elsewhere in the form. */
    ariaDescribedby?: string;
    onchange?: (value: string) => void;
    class?: string;
}
declare const RadioGroup: import("svelte").Component<Props, {}, "value">;
type RadioGroup = ReturnType<typeof RadioGroup>;
export default RadioGroup;
