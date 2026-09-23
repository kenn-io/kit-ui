import type { Snippet } from "svelte";
interface Props {
    /** Header cells — <TableHeaderCell> (or <th>) elements. */
    header: Snippet;
    /** Body rows — <tr> elements. */
    children: Snippet;
    /** Keep the header visible while the body scrolls. */
    stickyHeader?: boolean;
    /** Stripe even rows. */
    zebra?: boolean;
    ariaLabel?: string;
    class?: string;
}
declare const Table: import("svelte").Component<Props, {}, "">;
type Table = ReturnType<typeof Table>;
export default Table;
