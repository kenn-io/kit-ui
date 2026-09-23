import type { Snippet } from "svelte";
interface Props {
    /** Simple text tooltip; for rich content use the `content` snippet. */
    text?: string;
    content?: Snippet;
    /** The trigger the tooltip describes. */
    children: Snippet;
    /** Add tabindex so a non-interactive trigger (plain text/icon) is
     * keyboard-reachable. Leave false when the child is already focusable
     * (button, link, input). */
    focusable?: boolean;
    align?: "start" | "end";
    openDelayMs?: number;
    closeDelayMs?: number;
    /** Extra classes on the popover panel. */
    class?: string;
}
declare const Tooltip: import("svelte").Component<Props, {}, "">;
type Tooltip = ReturnType<typeof Tooltip>;
export default Tooltip;
