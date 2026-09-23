export type IconButtonSize = "sm" | "md";
export type IconButtonTone = "neutral" | "success" | "danger" | "info" | "workflow";
import type { Snippet } from "svelte";
interface Props {
    /** Accessible name — required, an icon carries no text of its own. */
    ariaLabel: string;
    /** Hover tooltip; defaults to the aria-label. */
    title?: string;
    /** sm = 24px, md = 28px square. */
    size?: IconButtonSize;
    /** Accent applied on hover (and to the pressed state). */
    tone?: IconButtonTone;
    disabled?: boolean;
    /** Keep the button focusable while exposing and enforcing an unavailable state. */
    ariaDisabled?: boolean;
    /** For menu/popover triggers. */
    ariaExpanded?: boolean;
    /** For menu/popover triggers: the kind of popup (e.g. "menu", "dialog",
     * true). */
    ariaHaspopup?: "menu" | "listbox" | "dialog" | "grid" | "tree" | boolean;
    /** id of the element this button controls (pairs with ariaExpanded). */
    ariaControls?: string;
    /** For toggle buttons — `true` renders the pressed (inset) look. */
    ariaPressed?: boolean;
    type?: "button" | "submit" | "reset";
    onclick?: ((event: MouseEvent) => void) | undefined;
    /** The icon (size 14 works well at both button sizes). */
    children: Snippet;
    class?: string;
}
declare const IconButton: import("svelte").Component<Props, {}, "">;
type IconButton = ReturnType<typeof IconButton>;
export default IconButton;
