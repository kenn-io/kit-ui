import { type Snippet } from "svelte";
interface Props {
    /** Keep at most one item open: opening an item closes the others.
     * Uses the native `<details name>` group, so it needs no script. */
    exclusive?: boolean;
    /** Group name for `exclusive`; generated when omitted. */
    name?: string;
    /** Disclosure items. */
    children: Snippet;
    class?: string;
}
declare const Accordion: import("svelte").Component<Props, {}, "">;
type Accordion = ReturnType<typeof Accordion>;
export default Accordion;
