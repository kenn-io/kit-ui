import { type Snippet } from "svelte";
import { type DayLaneItem, type DayLaneItemContext, type DayLaneLane, type DayLaneTick } from "./day-lane.js";
interface Props {
    /** The day's items, placed in minutes from the start of the day. */
    items: DayLaneItem[];
    /** Length of the day in minutes: 1440, or 1380 and 1500 on DST days. */
    dayMinutes?: number;
    /** Hour labels. Defaults to one per hour from `formatMinute`; DST days pass their own. */
    ticks?: DayLaneTick[] | undefined;
    /** Renders the inside of one card: title, icons, avatars, badges. */
    item: Snippet<[DayLaneItemContext]>;
    /** Lanes side by side on one axis ("By person"); items pick theirs with `lane`. */
    lanes?: DayLaneLane[] | undefined;
    /** Lane header content; gets the lane and its timed item count. Defaults to the label. */
    laneHeader?: Snippet<[DayLaneLane, number]> | undefined;
    /** Narrowest a lane gets before the view scrolls sideways, in pixels. */
    laneMinWidth?: number;
    /** Pixels per hour. */
    hourHeight?: number;
    /** Smallest card height in pixels; point items get exactly this. */
    minItemHeight?: number;
    /** Side-by-side columns before the rest go into a "+N more" item. */
    maxColumns?: number;
    /** Empty stretches of at least this many minutes fold into a band. 0 turns folding off. */
    foldQuietMinutes?: number;
    /** The current minute of the day. Draws a "now" line; omit on other days. */
    nowMinute?: number | undefined;
    /** Scroll the first timed item into view when `dayKey` changes. */
    scrollToFirst?: boolean;
    /** Identifies the day shown, so a new day scrolls and resets folds. */
    dayKey?: string | number;
    /** Wall-clock text for a minute (folds, "+N more", screen readers).
     * Defaults to the minute as a clock time, right for any day without a DST change. */
    formatMinute?: ((minute: number) => string) | undefined;
    /** BCP 47 tag for the default `formatMinute` and ticks. */
    locale?: string | undefined;
    ariaLabel?: string;
    dateOnlyLabel?: string;
    overflowLabel?: (count: number, from: string) => string;
    foldLabel?: (from: string, to: string, hours: number) => string;
    refoldLabel?: (hours: number) => string;
    /** A card was clicked or chosen with Enter or Space. */
    onselect?: ((id: string) => void) | undefined;
    /** A "+N more" item was chosen; the app shows the list. */
    onoverflow?: ((overflow: {
        ids: string[];
        startMinute: number;
    }) => void) | undefined;
    /** A fold was opened or closed. */
    onfoldchange?: ((fold: {
        startMinute: number;
        endMinute: number;
        expanded: boolean;
    }) => void) | undefined;
    class?: string;
}
declare const DayLane: import("svelte").Component<Props, {}, "">;
type DayLane = ReturnType<typeof DayLane>;
export default DayLane;
