import type { Snippet } from "svelte";
interface Props {
    title?: string;
    /** Called when the user dismisses via Escape, overlay click, or the close button. */
    onclose?: () => void;
    /** Panel width; clamped to the viewport. */
    width?: string;
    /** Render the X button in the header (default true). */
    closable?: boolean;
    /** Dismiss when the overlay backdrop is clicked (default true). */
    closeOnOverlayClick?: boolean;
    /** Accessible dialog name. With a custom `header` and no ariaLabel, the
     * dialog falls back to aria-labelledby on the header container (its full
     * text content becomes the name) — pass ariaLabel for a concise name. */
    ariaLabel?: string;
    /** Tooltip on the close button. */
    closeTitle?: string;
    closeAriaLabel?: string;
    children?: Snippet;
    /** Replaces the default title + close header entirely. */
    header?: Snippet;
    /** Optional footer row, typically action buttons. */
    footer?: Snippet;
}
declare const DetailDrawer: import("svelte").Component<Props, {}, "">;
type DetailDrawer = ReturnType<typeof DetailDrawer>;
export default DetailDrawer;
