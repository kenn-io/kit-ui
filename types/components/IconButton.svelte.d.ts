export type IconButtonSize = "sm" | "md";
export type IconButtonTone = "neutral" | "success" | "danger" | "info" | "workflow";
import type { Snippet } from "svelte";
import type { Attachment } from "svelte/attachments";
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
    /** The keyboard shortcut that also runs this action, in `aria-keyshortcuts`
     * form such as `Meta+B`. */
    ariaKeyshortcuts?: string;
    /** For toggle buttons — `true` renders the pressed (inset) look. */
    ariaPressed?: boolean;
    type?: "button" | "submit" | "reset";
    onclick?: ((event: MouseEvent) => void) | undefined;
    /** The icon (size 14 works well at both button sizes). */
    children: Snippet;
    class?: string;
    /** `{@attach}` on IconButton reaches its button, so a MenuTrigger or
     * Typeahead `attachment` can wire it as a popup trigger. */
    [attachment: symbol]: Attachment<HTMLButtonElement>;
}
declare const IconButton: import("svelte").Component<Props, {}, "">;
type IconButton = ReturnType<typeof IconButton>;
export default IconButton;
