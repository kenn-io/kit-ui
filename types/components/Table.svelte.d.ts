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
    /** Declares that this table always has at most this many rows, from a
     * set fixed when the code is written (one row per status, say). Every
     * other table must sort: kit-ui-check's `unsorted-table-header` rule
     * requires sortable headers unless this is set. */
    fixedRows?: 1 | 2 | 3 | 4;
    class?: string;
}
declare const Table: import("svelte").Component<Props, {}, "">;
type Table = ReturnType<typeof Table>;
export default Table;
