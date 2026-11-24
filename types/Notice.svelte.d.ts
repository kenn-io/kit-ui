export type NoticeTone = "info" | "success" | "warning" | "error" | "note" | "tip" | "important";
export type NoticeVariant = "card" | "inline";
import type { Snippet } from "svelte";
interface Props {
    tone?: NoticeTone;
    variant?: NoticeVariant;
    toneLabel?: string;
    title?: string;
    /** Plain-text body. Use `children` for rich content (links, code,
     * lists); when both are passed, `children` wins. */
    message?: string;
    children?: Snippet;
    /** Replaces the tone dot. For inline notices, use an icon that conveys
     * the tone visually. The tone label remains available to assistive tech. */
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
