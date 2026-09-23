import type { ChipTone } from "./Chip.svelte";
export type TimelineTone = ChipTone;
import type { Snippet } from "svelte";
interface Props {
    /** Dot accent, using the Chip tone vocabulary. Untinted dots read as
     * system events. */
    tone?: TimelineTone | undefined;
    class?: string;
    children?: Snippet;
}
declare const TimelineItem: import("svelte").Component<Props, {}, "">;
type TimelineItem = ReturnType<typeof TimelineItem>;
export default TimelineItem;
