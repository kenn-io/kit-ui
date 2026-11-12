import { type CalendarNavLabels, type WeekStart, type RangePreset, type RangeSelection } from "./date-range.js";
interface Props extends CalendarNavLabels {
    /** First weekday for calendar layout and week selection. */
    weekStart?: WeekStart | undefined;
    selection: RangeSelection;
    onSelect: (selection: RangeSelection) => void;
    /** Dim the trigger while the consumer reloads data. */
    busy?: boolean;
    /** Earliest known data date (YYYY-MM-DD); anchors the "All" preset. */
    earliestDate?: string | null;
    /** Popover edge alignment. Defaults to left. */
    align?: "left" | "right";
    /** Disable Next stepping past this date (YYYY-MM-DD). */
    maxDate?: string | null;
    /** Stretch the trigger to fill its container (for vertical sidebars). */
    block?: boolean;
    /** Relative presets shown as pills; override to relabel or reduce. */
    presets?: RangePreset[];
    relativeTabLabel?: string;
    calendarTabLabel?: string;
    customTabLabel?: string;
    dayLabel?: string;
    weekLabel?: string;
    monthLabel?: string;
    /** Week trigger label. A "{date}" placeholder is substituted with the
     * week-start date ("{date}所在周"); without one the label is a prefix
     * ("Week of" → "Week of Jun 29"). */
    weekOfLabel?: string;
    /** Trigger label template for non-preset relative windows. */
    lastDaysLabel?: string;
    /** Trigger label for an incomplete custom range. */
    customRangeLabel?: string;
    fromLabel?: string;
    toLabel?: string;
    dialogLabel?: string;
    relativeGroupLabel?: string;
    calendarGroupLabel?: string;
    /** BCP 47 tag for calendar-mode trigger labels and the embedded calendar.
     * Complete custom ranges deliberately stay as canonical YYYY-MM-DD so
     * cross-year bounds are unambiguous in every locale. Omitted = browser
     * locale. (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    locale?: string | undefined;
    /** Show the text field for typing dates ("last 30 days", "Sep 10 to
     * Oct 20", "since March") above the tabs. */
    textEntry?: boolean;
    /** Placeholder of the text field. */
    textEntryPlaceholder?: string;
    /** Accessible name of the text field. */
    textEntryLabel?: string;
    /** The text field's clear button label. */
    textEntryClearLabel?: string;
    /** The line under the text field while nothing is typed. */
    textEntryHint?: string;
    /** Shown when Enter is pressed on text that isn't a date or range. */
    noMatchLabel?: string;
    /** Day count after a typed range's dates in the summary line. */
    dayCountLabel?: (count: number) => string;
}
declare const DateRangePicker: import("svelte").Component<Props, {}, "">;
type DateRangePicker = ReturnType<typeof DateRangePicker>;
export default DateRangePicker;
