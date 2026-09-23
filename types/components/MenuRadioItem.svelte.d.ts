import { type Snippet } from "svelte";
import type { ClassValue } from "svelte/elements";
interface Props {
    value: string;
    disabled?: boolean;
    closeOnSelect?: boolean;
    textValue?: string;
    class?: ClassValue;
    children: Snippet;
}
declare const MenuRadioItem: import("svelte").Component<Props, {}, "">;
type MenuRadioItem = ReturnType<typeof MenuRadioItem>;
export default MenuRadioItem;
