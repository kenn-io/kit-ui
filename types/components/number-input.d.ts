/** Pure parsing and stepping rules behind NumberInput. The component keeps
 * the raw text the user is typing; these functions decide which text is
 * allowed, what number it means, and where the arrow keys move it. */
export interface NumberBounds {
    min?: number;
    max?: number;
    /** Arrow-key increment, and the grid the arrows snap to (anchored at
     * `min`, or 0 without one). Must be positive. */
    step: number;
}
/** Decimal places a value can carry: enough for `step` and for the `min`
 * the step grid is anchored on. 0 means the field takes integers only. */
export declare function numberPrecision({ min, step }: NumberBounds): number;
/** Whether a minus sign may be typed: only when the range reaches below 0. */
export declare function allowsNegative({ min }: NumberBounds): boolean;
/** Whether `text` is a number, or the start of one, that the field may
 * hold while the user types: an optional leading minus (when negatives are
 * allowed), digits, and one decimal point (when the precision allows
 * decimals). "-", "." and "" are accepted as in-progress text. Numbers
 * beyond Number.MAX_SAFE_INTEGER are refused, since past it the parsed
 * value would no longer match the digits typed. */
export declare function isNumberDraft(text: string, bounds: NumberBounds): boolean;
/** The number a draft means, or null while it has no digits yet. */
export declare function parseNumberDraft(text: string): number | null;
/** Canonical text for a value: "" for null, otherwise the shortest
 * decimal that round-trips, written out in full. JavaScript switches to
 * exponent form ("1e-7", "1e+21") at the extremes, which the draft rules
 * do not accept, so those digits are expanded. */
export declare function formatNumber(value: number | null): string;
export declare function clampNumber(value: number, { min, max }: NumberBounds): number;
/** The value one arrow press moves to. A value on the step grid moves one
 * step; a value between grid points snaps to the next point in that
 * direction, as native number inputs do. An empty field starts from `min`
 * going up and `max` going down (0 when that bound is unset). The result
 * is rounded to the field's precision so repeated 0.1 steps stay exact,
 * then clamped to the range. */
export declare function stepNumber(value: number | null, direction: 1 | -1, bounds: NumberBounds): number;
