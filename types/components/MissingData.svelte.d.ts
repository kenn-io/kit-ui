import type { Snippet } from "svelte";
interface Props {
    /** What is missing, as a short phrase ("No pinned messages"). */
    title: string;
    /** Why it is missing or how to fill it, in one or two sentences. */
    description?: string;
    /** A neutral glyph for the page or feature, typically a lucide icon.
     * It renders at 24px whatever size the icon was given. */
    icon?: Snippet;
    /** Controls that fill the gap, such as Retry or Build now. */
    action?: Snippet;
    /** `status` when the state replaces content that was loading, so screen
     * readers announce it; `note` for a fixed explanation. */
    role?: "status" | "note";
    class?: string;
}
declare const MissingData: import("svelte").Component<Props, {}, "">;
type MissingData = ReturnType<typeof MissingData>;
export default MissingData;
