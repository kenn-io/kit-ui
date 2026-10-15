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
    /**
     * The shortcut the trailing hint shows, in `aria-keyshortcuts` form such as `F2` or
     * `Meta+1`. Assistive technology reads the shortcut from this attribute, so the
     * visual hint is left out of the item's name.
     */
    keyshortcuts?: string | undefined;
    children: Snippet;
}
declare const MenuItem: import("svelte").Component<Props, {}, "">;
type MenuItem = ReturnType<typeof MenuItem>;
export default MenuItem;
