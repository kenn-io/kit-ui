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
        /** Height guess in px for rows not yet rendered; replaced by the
         * average of the first rows that render, which then stays fixed. */
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
        class?: string;
    };
    exports: {};
    bindings: "";
    slots: {};
    events: {};
};
declare class __sveltets_Render<T> {
    props(): ReturnType<typeof $$render<T>>['props'];
    events(): ReturnType<typeof $$render<T>>['events'];
    slots(): ReturnType<typeof $$render<T>>['slots'];
    bindings(): "";
    exports(): {};
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
