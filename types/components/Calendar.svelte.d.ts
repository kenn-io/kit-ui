import { type CalendarNavLabels, type DateRange } from "./date-range.js";
interface Props extends CalendarNavLabels {
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
    class?: string;
}
declare const Calendar: import("svelte").Component<Props, {}, "month">;
type Calendar = ReturnType<typeof Calendar>;
export default Calendar;
