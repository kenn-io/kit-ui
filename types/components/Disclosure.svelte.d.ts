import type { HTMLAttributes, HTMLDetailsAttributes } from "svelte/elements";
export type DisclosureVariant = "card" | "plain" | "bare";
/** Extra attributes and handlers for the summary, the element that
 * toggles the disclosure. `class` is added to the summary's own classes.
 * Handlers run before the native toggle; `preventDefault` in `onclick`
 * cancels it. */
export type DisclosureSummaryAttributes = Omit<HTMLAttributes<HTMLElement>, "children">;
import { type Snippet } from "svelte";
/** Other attributes, such as `inert` or `data-*`, go on the `<details>`
 * element. */
interface Props extends Omit<HTMLDetailsAttributes, "title" | "children" | "open" | "id" | "name" | "ontoggle" | "class"> {
    /** Header text. Use `summary` for rich header content. */
    title?: string;
    /** Rich header content, rendered instead of `title`. */
    summary?: Snippet;
    /** Trailing header content such as a count or status chip. It sits
     * inside the toggle, so keep it non-interactive. */
    meta?: Snippet;
    children: Snippet;
    /** Expanded state (bindable). Starts collapsed. */
    open?: boolean;
    /** Anchor for deep links: the disclosure opens when the URL hash
     * matches it, on load and on hash changes. */
    id?: string;
    /** Native exclusive group: opening one disclosure closes the others
     * with the same name. Accordion sets this for its items. */
    name?: string;
    /** `card` is a bordered panel; `plain` is a bare toggle row for inline
     * use, such as a collapsible tool call in a transcript. `bare` drops
     * the chevron, padding, and type styles and renders the header and body
     * without wrappers, so the summary can be laid out as a data row.
     * Ignored inside an Accordion, which draws its own frame. */
    variant?: DisclosureVariant;
    ontoggle?: (open: boolean) => void;
    /** Extra attributes and handlers for the summary, such as `aria-label`,
     * `data-*`, `onclick`, or `onkeydown`. */
    summaryAttributes?: DisclosureSummaryAttributes;
    class?: string;
}
declare const Disclosure: import("svelte").Component<Props, {}, "open">;
type Disclosure = ReturnType<typeof Disclosure>;
export default Disclosure;
