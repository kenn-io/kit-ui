import type { Snippet } from "svelte";
declare function $$render<T>(): {
    props: {
        /** Every row's data; only the rows on screen are rendered. */
        items: T[];
        /** Header cells — <TableHeaderCell> (or <th>) elements. */
        header: Snippet;
        /** Renders exactly one `<tr>` for `items[index]`. */
        row: Snippet<[T, number]>;
        /** A `<tr>` shown in the body when `items` is empty. */
        empty?: Snippet;
        /** Stable identity of a row, for keyed rendering. Defaults to the index. */
        rowKey?: (item: T, index: number) => unknown;
        /** What scrolls the rows: the table's own wrapper (give it a bounded
         * height), or the page or panel the table sits in. */
        scroll?: "self" | "page";
        /** With `scroll="page"`, the element that scrolls the table. Defaults to
         * the nearest scrolling ancestor, or the document. */
        scrollElement?: () => HTMLElement | null;
        /** Height in px of rows not yet rendered. Set it near the real row
         * height: it sizes the scrollbar and places unmeasured rows. */
        estimateRowHeight?: number;
        /** Rows rendered beyond each edge of the visible area. */
        overscan?: number;
        /** Keep the header visible while the body scrolls. */
        stickyHeader?: boolean;
        /** Stripe even rows. */
        zebra?: boolean;
        ariaLabel?: string;
        /** Opts this table out of sorting, as on Table. */
        unsorted?: boolean;
        /** The width in px the content of column `column` needs, for fitting it
         * when its resize handle is double-clicked; undefined measures the
         * column's rows sampled across the list. The table adds the header
         * cell's padding and clamps to the column's limits. */
        fitColumn?: (column: number) => number | undefined;
        /** Called with every column's width, in order, after a resize or fit,
         * for an app to keep them. */
        oncolumnwidthschange?: (widths: number[]) => void;
        class?: string;
    };
    exports: {
        refresh: () => void;
    };
    bindings: "";
    slots: {};
    events: {};
};
declare class __sveltets_Render<T> {
    props(): ReturnType<typeof $$render<T>>['props'];
    events(): ReturnType<typeof $$render<T>>['events'];
    slots(): ReturnType<typeof $$render<T>>['slots'];
    bindings(): "";
    exports(): {
        refresh: () => void;
    };
}
interface $$IsomorphicComponent {
    new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<T>['bindings']>;
    } & ReturnType<__sveltets_Render<T>['exports']>;
    <T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
declare const VirtualTable: $$IsomorphicComponent;
type VirtualTable<T> = InstanceType<typeof VirtualTable<T>>;
export default VirtualTable;
