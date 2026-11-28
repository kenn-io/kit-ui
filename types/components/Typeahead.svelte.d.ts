import type { Attachment } from "svelte/attachments";
import type { HTMLInputAttributes } from "svelte/elements";
type TypeaheadOwnedInputAttribute = "aria-activedescendant" | "aria-autocomplete" | "aria-controls" | "aria-expanded" | "aria-haspopup" | "aria-label" | "autocomplete" | "class" | "disabled" | "oninput" | "onkeydown" | "placeholder" | "role" | "type" | "value";
export type TypeaheadInputAttributes = Omit<HTMLInputAttributes, TypeaheadOwnedInputAttribute>;
export interface TypeaheadOption {
    name: string;
    label: string;
    /** Shown on the closed trigger instead of `label` when provided. */
    displayLabel?: string;
    count?: number;
    /** Secondary text: searched together with the label, rendered dim at the
     * row's trailing edge. */
    meta?: string;
    /** Makes this option a group row: it expands/collapses its children
     * instead of being selectable. `name` must still be unique across the
     * whole tree (it keys rows and tracks expansion). */
    children?: TypeaheadOption[];
    /** Initial expansion for a group row (default true). */
    expanded?: boolean;
}
/** Passed to a Typeahead `trigger` snippet. Attach it to the caller's button
 * with `{@attach attachment}`. */
export interface TypeaheadTriggerProps {
    attachment: Attachment<HTMLButtonElement>;
}
import { type Snippet } from "svelte";
interface Props {
    options: TypeaheadOption[];
    /** The chosen option name. Unused in `multiple` mode, which reads
     * `values`. */
    value?: string;
    /** Choose several options: each choice calls `onselect` with that
     * option's name and the list stays open. The caller adds or removes it
     * from `values`. */
    multiple?: boolean;
    /** The chosen option names in `multiple` mode. */
    values?: readonly string[];
    /** Closed-trigger text when `multiple` has more than one choice;
     * `{count}` is replaced with the number chosen. */
    multipleLabel?: string;
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
    /** Start on the first visible choice instead of a group row. */
    highlightFirstOption?: boolean;
    /** Offer any non-empty trimmed query that is not an exact option name as
     * a row that selects the query verbatim. */
    allowCustom?: boolean;
    /** Label of the custom-value row; `{query}` is replaced with the trimmed
     * query. */
    customLabel?: string;
    /** Force the list above/below the trigger; "auto" (default) flips near
     * the viewport bottom. */
    placement?: "auto" | "top" | "bottom";
    /** Align the panel's left edge and width with this element. */
    panelAnchor?: HTMLElement;
    /** Dim text rendered before the value on the closed trigger. */
    triggerPrefix?: string;
    /** Replace the option rows with a loading row (async option sources). */
    loading?: boolean;
    loadingLabel?: string;
    /** Disable local filtering when the caller supplies remotely filtered options. */
    remote?: boolean;
    /** Called when the query changes, including the initial query on open and reset on close. */
    onquery?: (query: string) => void;
    /** Error row rendered above the options, which stay selectable so the
     * user can retry (clear it in `onselect`). */
    error?: string;
    /** Rendered inside the popover above the option list (e.g. a tab
     * switcher); receives no arguments. */
    header?: Snippet;
    /** Decorative icon before each option and the selected trigger label. */
    icon?: Snippet<[TypeaheadOption]>;
    /** Replaces the built-in trigger with a button the caller renders, such as an
     * IconButton. Attach `attachment` to it. The button stays in place while
     * the list is open and the search field moves into the popover. The
     * caller names the button. */
    trigger?: Snippet<[TypeaheadTriggerProps]>;
    /** Return `false` (or a promise of `false`), or throw, to keep the list
     * open — e.g. to veto a value or surface `error`. */
    onselect: (value: string) => void | boolean | Promise<void | boolean>;
}
declare const Typeahead: import("svelte").Component<Props, {}, "">;
type Typeahead = ReturnType<typeof Typeahead>;
export default Typeahead;
