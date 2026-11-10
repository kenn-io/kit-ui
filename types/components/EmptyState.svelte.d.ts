import type { Snippet } from "svelte";
interface Props {
    /** A neutral glyph for the page or feature, typically a lucide icon.
     * It renders in muted ink at the size the caller gives it; 24px is the
     * size for empty states. */
    icon?: Snippet;
    /** What is missing, as a short phrase ("No pinned messages"). */
    title: string;
    /** Why it is missing or how to fill it, in one or two sentences. */
    description?: string;
    /** Where it sits in its container. `center` centers it in a pane.
     * `top` puts it a fixed step (48px) below the container's top, so every
     * page shows it in the same place under its header. */
    align?: "top" | "center";
    /** `status` when the state replaces content that was loading, so screen
     * readers announce it; `note` for a fixed explanation. */
    role?: "status" | "note";
    class?: string;
    /** Rendered under the text: controls that fill the gap, such as Retry
     * or Add repository. */
    children?: Snippet;
}
declare const EmptyState: import("svelte").Component<Props, {}, "">;
type EmptyState = ReturnType<typeof EmptyState>;
export default EmptyState;
