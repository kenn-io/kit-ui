import { type Snippet } from "svelte";
import type { ClassValue } from "svelte/elements";
interface Props {
    onselect: () => void;
    disabled?: boolean;
    closeOnSelect?: boolean;
    tone?: "neutral" | "danger";
    textValue?: string;
    class?: ClassValue;
    /** Decorative leading icon. Reserves a leading column only when passed; an empty snippet keeps alignment with icon items. */
    icon?: Snippet;
    children: Snippet;
}
declare const MenuItem: import("svelte").Component<Props, {}, "">;
type MenuItem = ReturnType<typeof MenuItem>;
export default MenuItem;
