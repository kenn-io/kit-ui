import type { Snippet } from "svelte";
interface Props {
    /** Optional leading glyph, typically a lucide icon. */
    icon?: Snippet;
    title: string;
    description?: string;
    /** Rendered under the text, typically action buttons. */
    children?: Snippet;
}
declare const EmptyState: import("svelte").Component<Props, {}, "">;
type EmptyState = ReturnType<typeof EmptyState>;
export default EmptyState;
