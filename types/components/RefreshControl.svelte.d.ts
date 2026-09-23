import { type Snippet } from "svelte";
interface Props {
    /** Epoch ms of the last successful fetch, or null before the first load. */
    lastUpdatedAt: number | null;
    /** Spins the icon and disables the button while a refresh is in flight. */
    busy?: boolean;
    /** Refetches the data; invoked on the interval and on click. */
    onRefresh: () => void;
    /** Accessible name for the button (aria-label). */
    label?: string;
    /** Tooltip text; defaults to `label` when omitted. */
    title?: string;
    /** Auto-refresh cadence in ms; defaults to 5 minutes. */
    intervalMs?: number;
    /** Renders the age label; override to localize the default English
     * `formatRefreshAge` strings ("Updated 3m ago", …). `now` is the
     * component's minute clock tick, clamped so it is never earlier than
     * `lastUpdatedAt` — formatters can assume a non-negative age.
     * (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    formatAge?: ((lastUpdatedAt: number | null, now: number) => string) | undefined;
    /** BCP 47 tag for the timestamp tooltip on the age label, for apps whose
     * language setting can diverge from the browser locale. Omitted =
     * browser locale. Must be a valid tag — `toLocaleString` throws on
     * malformed input. */
    locale?: string | undefined;
    /** Strings the age box must be able to show without changing width.
     * The box reserves the width of the widest sample and clips anything
     * longer with an ellipsis, so swapping label variants ("Updated just
     * now" -> "Updated 3m ago") never moves whatever is laid out after the
     * control. Omitted = the box hugs its content. */
    ageWidthSamples?: readonly string[] | undefined;
    /** Rich hover/focus content for the age label, e.g. a per-step
     * breakdown of the last fetch. Replaces the label's default timestamp
     * `title`, so include the timestamp in the snippet if it still matters. */
    ageTooltip?: Snippet | undefined;
}
declare const RefreshControl: import("svelte").Component<Props, {}, "">;
type RefreshControl = ReturnType<typeof RefreshControl>;
export default RefreshControl;
