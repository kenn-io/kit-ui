import { type Snippet } from "svelte";
import type { TypeaheadInputAttributes, TypeaheadOption } from "./typeahead.js";
interface Props {
    options: TypeaheadOption[];
    value: string;
    fallbackLabel: string;
    placeholder: string;
    /** Native attributes for the open search input. Typeahead-owned behavior
     * and ARIA attributes take precedence. */
    inputAttributes?: TypeaheadInputAttributes;
    title?: string;
    emptyLabel?: string;
    disabled?: boolean;
    /** Prepend a row that selects `""`; the trigger falls back to
     * `fallbackLabel` when nothing matches the value. */
    allowClear?: boolean;
    clearLabel?: string;
    /** Offer any non-empty trimmed query that is not an exact option name as
     * a row that selects the query verbatim. */
    allowCustom?: boolean;
    /** Label of the custom-value row; `{query}` is replaced with the trimmed
     * query. */
    customLabel?: string;
    /** Force the list above/below the trigger; "auto" (default) flips near
     * the viewport bottom. */
    placement?: "auto" | "top" | "bottom";
    /** Dim text rendered before the value on the closed trigger. */
    triggerPrefix?: string;
    /** Replace the option rows with a loading row (async option sources). */
    loading?: boolean;
    loadingLabel?: string;
    /** Disable local filtering when the caller supplies remotely filtered options. */
    remote?: boolean;
    /** Called when the open input query changes, including reset on open and close. */
    onquery?: (query: string) => void;
    /** Error row rendered above the options, which stay selectable so the
     * user can retry (clear it in `onselect`). */
    error?: string;
    /** Rendered inside the popover above the option list (e.g. a tab
     * switcher); receives no arguments. */
    header?: Snippet;
    /** Decorative icon before each option and the selected trigger label. */
    icon?: Snippet<[TypeaheadOption]>;
    /** Return `false` (or a promise of `false`), or throw, to keep the list
     * open — e.g. to veto a value or surface `error`. */
    onselect: (value: string) => void | boolean | Promise<void | boolean>;
}
declare const Typeahead: import("svelte").Component<Props, {}, "">;
type Typeahead = ReturnType<typeof Typeahead>;
export default Typeahead;
