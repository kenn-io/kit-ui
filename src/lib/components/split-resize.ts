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
