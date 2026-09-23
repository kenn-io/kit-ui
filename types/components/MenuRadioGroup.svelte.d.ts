import { type Snippet } from "svelte";
interface Props {
    value: string;
    onchange: (value: string) => void;
    ariaLabel?: string;
    children: Snippet;
}
declare const MenuRadioGroup: import("svelte").Component<Props, {}, "">;
type MenuRadioGroup = ReturnType<typeof MenuRadioGroup>;
export default MenuRadioGroup;
