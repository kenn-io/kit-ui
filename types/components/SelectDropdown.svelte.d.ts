import type { SelectDropdownOption } from "./select-dropdown.js";
interface Props {
    value: string;
    options: SelectDropdownOption[];
    onchange: (value: string) => void;
    title?: string;
    disabled?: boolean;
    /** Menu edge to align with the trigger. Keep the default `start` —
     * the menu clamps/flips itself when the viewport runs out of room. */
    align?: "start" | "end";
    class?: string;
}
declare const SelectDropdown: import("svelte").Component<Props, {}, "">;
type SelectDropdown = ReturnType<typeof SelectDropdown>;
export default SelectDropdown;
