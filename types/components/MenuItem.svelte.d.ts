import { type Snippet } from "svelte";
import type { ClassValue } from "svelte/elements";
interface Props {
    onselect: () => void;
    disabled?: boolean;
    closeOnSelect?: boolean;
    tone?: "neutral" | "danger";
    textValue?: string;
    class?: ClassValue;
    /** Decorative leading icon. The icon column shows when any item in the menu passes one. */
    icon?: Snippet | undefined;
    /** Right-aligned secondary text, such as a count or a shortcut hint. */
    trailing?: Snippet | undefined;
    children: Snippet;
}
declare const MenuItem: import("svelte").Component<Props, {}, "">;
type MenuItem = ReturnType<typeof MenuItem>;
export default MenuItem;
