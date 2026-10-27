import { type CalendarNavLabels, type WeekStart, type RangeChoice, type RangePickerSelection, type RangePreset } from "./date-range.js";
declare function $$render<V extends string = never>(): {
    props: CalendarNavLabels & {
        /** First weekday for calendar layout and week selection. */
        weekStart?: WeekStart | undefined;
        selection: RangePickerSelection<V>;
        onSelect: (selection: RangePickerSelection<V>) => void;
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
        /** Choices that are not date ranges (e.g. "No date"), shown as pills
         * below the tabs. Picking one reports `{ mode: "choice", value }`
         * through `onSelect` and closes the panel. */
        extraChoices?: RangeChoice<V>[] | undefined;
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
        choiceGroupLabel?: string;
        /** BCP 47 tag for calendar-mode trigger labels and the embedded calendar.
         * Complete custom ranges deliberately stay as canonical YYYY-MM-DD so
         * cross-year bounds are unambiguous in every locale. Omitted = browser
         * locale. (`| undefined` keeps forwarding consumers with
         * exactOptionalPropertyTypes happy.) */
        locale?: string | undefined;
    };
    exports: {};
    bindings: "";
    slots: {};
    events: {};
};
declare class __sveltets_Render<V extends string = never> {
    props(): ReturnType<typeof $$render<V>>['props'];
    events(): ReturnType<typeof $$render<V>>['events'];
    slots(): ReturnType<typeof $$render<V>>['slots'];
    bindings(): "";
    exports(): {};
}
interface $$IsomorphicComponent {
    new <V extends string = never>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<V>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<V>['props']>, ReturnType<__sveltets_Render<V>['events']>, ReturnType<__sveltets_Render<V>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<V>['bindings']>;
    } & ReturnType<__sveltets_Render<V>['exports']>;
    <V extends string = never>(internal: unknown, props: ReturnType<__sveltets_Render<V>['props']> & {}): ReturnType<__sveltets_Render<V>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
declare const DateRangePicker: $$IsomorphicComponent;
type DateRangePicker<V extends string = never> = InstanceType<typeof DateRangePicker<V>>;
export default DateRangePicker;
