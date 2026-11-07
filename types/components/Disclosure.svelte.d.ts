export type DisclosureVariant = "card" | "plain";
import { type Snippet } from "svelte";
interface Props {
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
     * use, such as a collapsible tool call in a transcript. Ignored inside
     * an Accordion, which draws its own frame. */
    variant?: DisclosureVariant;
    ontoggle?: (open: boolean) => void;
    class?: string;
}
declare const Disclosure: import("svelte").Component<Props, {}, "open">;
type Disclosure = ReturnType<typeof Disclosure>;
export default Disclosure;
