export type SplitResizeOrientation = "horizontal" | "vertical";
export interface SplitResizeEvent {
    /** Pane layout direction. Horizontal panes resize on the x axis. */
    orientation: SplitResizeOrientation;
    /** Pixels moved from the start position on the active axis. */
    delta: number;
    /** Pointer position at resize start on the active axis. */
    start: number;
    /** Current pointer position on the active axis. */
    current: number;
    event: KeyboardEvent | PointerEvent;
}
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
    /** Reads the value aloud in place of `ariaValueNow`, such as "Collapsed". */
    ariaValueText?: string;
    /** Called when someone presses Enter on the focused handle or
     * double-clicks it, for example to collapse or restore a pane. */
    onActivate?: (event: KeyboardEvent | MouseEvent) => void;
    onResizeStart?: (event: KeyboardEvent | PointerEvent) => void;
    onResize?: (event: SplitResizeEvent) => void;
    onResizeEnd?: (event: SplitResizeEvent) => void;
}
declare const SplitResizeHandle: import("svelte").Component<Props, {}, "">;
type SplitResizeHandle = ReturnType<typeof SplitResizeHandle>;
export default SplitResizeHandle;
