interface Props {
    /** When provided, the button copies this text itself and manages the
     * copied indicator. Omit it (and pass `copied` + `onclick`) to control
     * the copy behavior from the parent. */
    text?: string;
    copied?: boolean;
    ariaLabel?: string;
    copiedAriaLabel?: string;
    title?: string;
    copiedTitle?: string;
    /** Hide until the parent is hovered (requires the parent to reveal
     * `.kit-copy-btn` on hover); default false — always visible. */
    revealOnHover?: boolean;
    onclick?: (event: MouseEvent) => void | Promise<void>;
    class?: string;
}
declare const CopyButton: import("svelte").Component<Props, {}, "">;
type CopyButton = ReturnType<typeof CopyButton>;
export default CopyButton;
