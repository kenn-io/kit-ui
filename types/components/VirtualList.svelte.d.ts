import type { Snippet } from "svelte";
declare function $$render<T>(): {
    props: {
        items: T[];
        /** Fixed row height in px — the fast path. Omit for variable-height
         * rows (measured as they render, `estimateHeight` until then). */
        itemHeight?: number;
        /** Initial height guess for unmeasured variable rows. */
        estimateHeight?: number;
        /** Rows rendered beyond each edge of the viewport. */
        overscan?: number;
        /** CSS height of the scroll container. */
        height?: string;
        /** Active (keyboard-highlighted) row index (bindable). −1 = none. */
        activeIndex?: number;
        /** Enter/double-click on the active row. */
        onactivate?: (item: T, index: number) => void;
        /** Fires when the rendered range changes: [start, end). */
        onrangechange?: (start: number, end: number) => void;
        /** Accessible name for the listbox — required: the container is the
         * focusable keyboard target and must be announced with a name. */
        ariaLabel: string;
        row: Snippet<[T, number, boolean]>;
        empty?: Snippet;
        class?: string;
    };
    exports: {
        scrollToIndex: (index: number) => Promise<void>;
    };
    bindings: "activeIndex";
    slots: {};
    events: {};
};
declare class __sveltets_Render<T> {
    props(): ReturnType<typeof $$render<T>>['props'];
    events(): ReturnType<typeof $$render<T>>['events'];
    slots(): ReturnType<typeof $$render<T>>['slots'];
    bindings(): "activeIndex";
    exports(): {
        scrollToIndex: (index: number) => Promise<void>;
    };
}
interface $$IsomorphicComponent {
    new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<T>['bindings']>;
    } & ReturnType<__sveltets_Render<T>['exports']>;
    <T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
declare const VirtualList: $$IsomorphicComponent;
type VirtualList<T> = InstanceType<typeof VirtualList<T>>;
export default VirtualList;
