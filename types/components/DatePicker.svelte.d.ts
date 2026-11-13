import { type CalendarNavLabels } from "./date-range.js";
interface Props extends CalendarNavLabels {
    /** The chosen date (YYYY-MM-DD), or null when none is chosen yet. */
    value: string | null;
    /** Called with the picked date; the popover closes after a pick. */
    onchange: (date: string) => void;
    /** Trigger text while no date is chosen. */
    placeholder?: string;
    /** Accessible name for the trigger; the chosen date is appended. */
    ariaLabel?: string;
    /** Dates after this are disabled (YYYY-MM-DD). */
    maxDate?: string | null;
    disabled?: boolean;
    /** Popover edge alignment. Defaults to left. */
    align?: "left" | "right";
    /** Stretch the trigger to fill its container. */
    block?: boolean;
    dialogLabel?: string;
    /** BCP 47 tag for the trigger label and calendar. Omitted = browser
     * locale. (`| undefined` keeps exactOptionalPropertyTypes consumers
     * happy.) */
    locale?: string | undefined;
    /** Show the text field for typing a date ("tomorrow", "Sep 10",
     * "last Friday") above the calendar. */
    textEntry?: boolean;
    /** Placeholder of the text field. */
    textEntryPlaceholder?: string;
    /** Accessible name of the text field. */
    textEntryLabel?: string;
    /** The text field's clear button label. */
    textEntryClearLabel?: string;
    /** The line under the text field while nothing is typed. */
    textEntryHint?: string;
    /** Shown when Enter is pressed on text that isn't a date. */
    noMatchLabel?: string;
}
declare const DatePicker: import("svelte").Component<Props, {}, "">;
type DatePicker = ReturnType<typeof DatePicker>;
export default DatePicker;
