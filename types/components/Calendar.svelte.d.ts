import { type CalendarNavLabels, type WeekStart, type DateRange } from "./date-range.js";
interface Props extends CalendarNavLabels {
    /** First weekday for calendar layout and week selection. */
    weekStart?: WeekStart | undefined;
    /** Any date inside the visible month (YYYY-MM-DD, bindable). */
    month?: string;
    /** Inclusive range to highlight (e.g. the current selection). */
    selected?: DateRange | null;
    /** Called with the picked date (YYYY-MM-DD) on click, Enter, or Space. */
    onpick?: (date: string) => void;
    /** Dates after this are disabled (still focusable, never picked);
     * paging into fully-later months is blocked. */
    maxDate?: string | null;
    /** BCP 47 tag for month/weekday/day names, for apps whose language
     * setting can diverge from the browser locale. Omitted = browser locale.
     * (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    locale?: string | undefined;
    class?: string;
}
declare const Calendar: import("svelte").Component<Props, {
    focus: (options?: FocusOptions) => void;
}, "month">;
type Calendar = ReturnType<typeof Calendar>;
export default Calendar;
