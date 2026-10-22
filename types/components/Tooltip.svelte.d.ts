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
    /** Horizontal placement against the trigger. `center` (default) puts
     * the bubble straight under or over it. The arrow always points at the
     * trigger's center, even when the viewport edge pushes the bubble aside. */
    align?: "start" | "center" | "end";
    /** `bottom` (default) puts the bubble under the trigger, or over it when
     * there is no room below. `right` puts it beside the trigger, as for an
     * icon in a narrow column, where a bubble below covers the next icon. */
    side?: "bottom" | "right";
    /** Hover intent before the first tooltip opens. While another tooltip is
     * open, this one opens at once. */
    openDelayMs?: number;
    closeDelayMs?: number;
    /** Extra classes on the popover panel. */
    class?: string;
}
declare const Tooltip: import("svelte").Component<Props, {}, "">;
type Tooltip = ReturnType<typeof Tooltip>;
export default Tooltip;
