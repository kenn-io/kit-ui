import type { Snippet } from "svelte";
import type { ChipSize } from "./Chip.svelte";
declare function $$render<T>(): {
    props: {
        items: T[];
        /** Renders one item — typically a Chip, small Button, or badge. */
        chip: Snippet<[item: T, index: number]>;
        /** How many items show while collapsed; the rest sit behind a "+N"
         * expander chip. */
        maxVisible?: number;
        /** Bindable. Expansion state; parents can control or observe it. */
        expanded?: boolean;
        /** Stable key per item for keyed rendering; defaults to item identity. */
        key?: (item: T) => unknown;
        /** Gap between items as a spacing-scale step (--space-N). */
        gap?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
        wrap?: boolean;
        /** Size of the expander chip; match the chips you render. */
        size?: ChipSize;
        ariaLabel?: string;
        moreLabel?: (hidden: number) => string;
        lessLabel?: string;
        class?: string;
    };
    exports: {};
    bindings: "expanded";
    slots: {};
    events: {};
};
declare class __sveltets_Render<T> {
    props(): ReturnType<typeof $$render<T>>['props'];
    events(): ReturnType<typeof $$render<T>>['events'];
    slots(): ReturnType<typeof $$render<T>>['slots'];
    bindings(): "expanded";
    exports(): {};
}
interface $$IsomorphicComponent {
    new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<T>['bindings']>;
    } & ReturnType<__sveltets_Render<T>['exports']>;
    <T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
declare const ChipStack: $$IsomorphicComponent;
type ChipStack<T> = InstanceType<typeof ChipStack<T>>;
export default ChipStack;
