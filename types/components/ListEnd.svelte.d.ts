import type { ListEndState } from "../utils/more-rows.svelte.js";
type $$ComponentProps = {
    rows: ListEndState;
    /** Whether the server has another batch. A `VirtualTable` end row leaves
     * it out: `withEndRow` adds that row only while there is one. */
    more?: boolean;
    /** False while the list's first batch or a new order is still reading. */
    idle: boolean;
    /** The table's column count, for the row's single cell. Leave it out at
     * the end of a list, where this renders an item. */
    columns?: number;
    /** What the list holds, such as "changes", for the status and failure. */
    label: string;
    /** Starts the next batch; called when this row comes near the visible part of the table. */
    onmore: () => void;
};
declare const ListEnd: import("svelte").Component<$$ComponentProps, {}, "">;
type ListEnd = ReturnType<typeof ListEnd>;
export default ListEnd;
