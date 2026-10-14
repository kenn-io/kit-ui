import type { SplitResizeEvent, SplitResizeOrientation } from "./split-resize.js";
interface Props {
    ariaLabel: string;
    /** Direction in which the two panes are arranged. */
    orientation?: SplitResizeOrientation;
    /** `column` draws a 1px line for resizing a table column; its pointer
     * target stays as easy to grab as a pane divider's. */
    variant?: "pane" | "column";
    disabled?: boolean;
    /** Pixels moved per arrow-key press. */
    keyboardStep?: number;
    ariaValueMin: number;
    ariaValueMax: number;
    ariaValueNow: number;
    onResizeStart?: (event: KeyboardEvent | PointerEvent) => void;
    onResize?: (event: SplitResizeEvent) => void;
    onResizeEnd?: (event: SplitResizeEvent) => void;
}
declare const SplitResizeHandle: import("svelte").Component<Props, {}, "">;
type SplitResizeHandle = ReturnType<typeof SplitResizeHandle>;
export default SplitResizeHandle;
