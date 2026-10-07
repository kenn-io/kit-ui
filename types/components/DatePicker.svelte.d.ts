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
}
declare const DatePicker: import("svelte").Component<Props, {}, "">;
type DatePicker = ReturnType<typeof DatePicker>;
export default DatePicker;
