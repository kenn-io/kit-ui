export type NoticeTone = "info" | "success" | "warning" | "error" | "note" | "tip" | "important";
import type { Snippet } from "svelte";
interface Props {
    tone?: NoticeTone;
    toneLabel?: string;
    title?: string;
    /** Plain-text body. Use `children` for rich content (links, code,
     * lists); when both are passed, `children` wins. */
    message?: string;
    children?: Snippet;
    /** Replaces the tone dot, e.g. a Lucide icon. Decorative: the tone
     * label carries the meaning. */
    icon?: Snippet;
    /** `true` (default) announces the notice as a live status (alert for
     * errors), for feedback that appears in response to something. Set
     * `false` for a static callout in page content; it renders as a
     * `note` and is not announced. */
    live?: boolean;
    actionLabel?: string;
    onaction?: () => void;
    class?: string;
}
declare const Notice: import("svelte").Component<Props, {}, "">;
type Notice = ReturnType<typeof Notice>;
export default Notice;
