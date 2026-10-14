/**
 * Column sizing shared between VirtualTable and its TableHeaderCells: the
 * table owns each column's width; a header cell shows the resize handle and
 * reports drags and fit requests by its own `<th>`.
 */
export interface ColumnSizing {
    /** Changes whenever any width changes; read it to track widths reactively. */
    readonly version: number;
    /** The width the column is shown at, or undefined before the columns are
     * sized. */
    width(cell: HTMLTableCellElement): number | undefined;
    /** The column's resize limits. */
    limits(cell: HTMLTableCellElement): {
        min: number;
        max: number;
    };
    /** A drag or key press starts resizing the column. */
    resizeStart(cell: HTMLTableCellElement): void;
    /** Size the column to its width at the start plus `delta`. */
    resize(cell: HTMLTableCellElement, delta: number): void;
    /** The resize is done; report the widths. */
    resizeEnd(cell: HTMLTableCellElement): void;
    /** Fit the column to its content. */
    fit(cell: HTMLTableCellElement): void;
}
export declare const columnSizingContext: unique symbol;
/** Default resize limits, as in gpui-kit's columns. */
export declare const DEFAULT_MIN_COLUMN_WIDTH = 20;
export declare const DEFAULT_MAX_COLUMN_WIDTH = 1200;
