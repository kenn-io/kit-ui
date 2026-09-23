import { type Snippet } from "svelte";
import type { ClassValue } from "svelte/elements";
interface Props {
    onselect: () => void;
    disabled?: boolean;
    closeOnSelect?: boolean;
    tone?: "neutral" | "danger";
    textValue?: string;
    class?: ClassValue;
    children: Snippet;
}
declare const MenuItem: import("svelte").Component<Props, {}, "">;
type MenuItem = ReturnType<typeof MenuItem>;
export default MenuItem;
