export type ModalTone = "neutral" | "info" | "success" | "warning" | "danger";
import type { Snippet } from "svelte";
interface Props {
    title?: string;
    /** Header accent. `neutral` is a plain inset header; the others tint the
     * header and title with the matching semantic accent. */
    tone?: ModalTone;
    /** Called when the user dismisses via Escape, overlay click, or the close button. */
    onclose?: () => void;
    /** Render the X button in the header. */
    closable?: boolean;
    /** Accessible label for the close button. */
    closeLabel?: string;
    /** Dismiss when the overlay backdrop is clicked (default true). */
    closeOnOverlayClick?: boolean;
    width?: string;
    maxWidth?: string;
    /** Cap on the panel's height. Defaults to the small viewport height less
     * a margin, so the whole dialog, footer included, is on screen even on a
     * phone showing its URL bar. */
    maxHeight?: string;
    ariaLabel?: string;
    children?: Snippet;
    /** Optional footer row, typically action buttons. */
    footer?: Snippet;
}
declare const Modal: import("svelte").Component<Props, {}, "">;
type Modal = ReturnType<typeof Modal>;
export default Modal;
