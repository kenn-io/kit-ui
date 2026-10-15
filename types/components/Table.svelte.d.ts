import type { Snippet } from "svelte";
interface BaseProps {
    /** Body rows — <tr> elements. With `bare`, everything inside the <table>. */
    children: Snippet;
    ariaLabel?: string;
    /** Opts this table out of sorting. Every other table must sort:
     * kit-ui-check's `unsorted-table-header` rule requires sortable headers
     * unless this is set. */
    unsorted?: boolean;
    class?: string;
}
type Props = BaseProps & ({
    /** Header cells — <TableHeaderCell> (or <th>) elements. */
    header: Snippet;
    /** What scrolls the rows: the table's own wrapper (give it a bounded
     * height), or the page or panel the table sits in. */
    scroll?: "self" | "page";
    /** Keep the header visible while the body scrolls. */
    stickyHeader?: boolean;
    /** Stripe even rows. */
    zebra?: boolean;
    bare?: false;
} | {
    /** Render only a plain <table> carrying `class` and `ariaLabel`, so
     * `children` can hold its own <thead>, several <tbody> groups or a
     * <colgroup>. kit-ui's table styles do not apply. */
    bare: true;
    header?: undefined;
    scroll?: undefined;
    stickyHeader?: undefined;
    zebra?: undefined;
});
declare const Table: import("svelte").Component<Props, {}, "">;
type Table = ReturnType<typeof Table>;
export default Table;
