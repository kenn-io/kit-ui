export interface FieldState {
    id: string;
    label: string;
    value: string;
    error?: string;
    disabled?: boolean;
}
export type FormFieldType = "text" | "email" | "password" | "tel" | "url";
interface Props {
    field: FieldState;
    type?: FormFieldType;
    name?: string;
    placeholder?: string;
    autocomplete?: HTMLInputElement["autocomplete"];
    required?: boolean;
    oninput?: (value: string) => void;
    onblur?: () => void;
}
declare const FormField: import("svelte").Component<Props, {}, "">;
type FormField = ReturnType<typeof FormField>;
export default FormField;
