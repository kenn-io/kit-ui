import { type CalendarNavLabels, type WeekStart, type DateRange } from "./date-range.js";
interface Props extends CalendarNavLabels {
    /** First weekday for calendar layout and week selection. */
    weekStart?: WeekStart | undefined;
    /** Any date inside the visible month (YYYY-MM-DD, bindable). */
    month?: string;
    /** Inclusive range to highlight (e.g. the current selection). */
    selected?: DateRange | null;
    /** Called with the clicked date (YYYY-MM-DD). */
    onpick?: (date: string) => void;
    /** Dates after this are disabled; paging into fully-later months too. */
    maxDate?: string | null;
    /** BCP 47 tag for month/weekday/day names, for apps whose language
     * setting can diverge from the browser locale. Omitted = browser locale.
     * (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    locale?: string | undefined;
    /** Activity per day, keyed by `YYYY-MM-DD`: a count such as messages or
     * documents. Days with a count are shaded in four steps and their
     * accessible label includes it. */
    activity?: Readonly<Record<string, number>> | null;
    /** Shade step (0–4) for a day's count, for apps with their own scale.
     * Defaults to quarters of the busiest day in view. */
    activityScale?: ((count: number, date: string) => number) | undefined;
    /** Text for a day's count in its accessible label, after the date. */
    activityLabel?: (count: number) => string;
    class?: string;
}
declare const Calendar: import("svelte").Component<Props, {}, "month">;
type Calendar = ReturnType<typeof Calendar>;
export default Calendar;
