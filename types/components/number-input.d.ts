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
/** Whether a decimal separator may be typed: only when `step`, the `min` the
 * step grid is anchored on, or a `max` a clamp can land on has decimals. */
export declare function allowsDecimals({ min, max, step }: NumberBounds): boolean;
/** The decimal separator `locale` writes between whole and fractional
 * digits, such as "." for en-US and "," for de-DE. The field shows plain
 * ASCII digits, so this is the separator the locale uses with Latin
 * digits: ar-EG gives ".", not the Arabic decimal separator it pairs with
 * its own digits. `undefined` means the runtime's default locale. */
export declare function decimalSeparator(locale?: string): string;
/** Whether a minus sign may be typed: only when the range reaches below 0. */
export declare function allowsNegative({ min }: NumberBounds): boolean;
/** Whether `text` is a number, or the start of one, that the field may
 * hold while the user types: an optional leading minus (when negatives are
 * allowed), digits, and one decimal separator (when the precision allows
 * decimals). The separator is `separator` or ".", which is accepted in
 * every locale so a number copied from elsewhere still pastes. "-", the
 * separator alone and "" are accepted as in-progress text. Numbers beyond
 * Number.MAX_SAFE_INTEGER are refused, since past it the parsed value
 * would no longer match the digits typed. */
export declare function isNumberDraft(text: string, bounds: NumberBounds, separator?: string): boolean;
/** Whether `text` has the shape of a number draft, whatever its size:
 * isNumberDraft without the safe-integer limit. */
export declare function isNumberText(text: string, bounds: NumberBounds, separator?: string): boolean;
/** The text the field keeps for an edit: surrounding whitespace dropped,
 * and a "." written as `separator`, so the field always shows the
 * locale's form. */
export declare function normalizeNumberDraft(text: string, separator?: string): string;
/** The number a draft means, or null while it has no digits yet. The
 * decimal separator may be `separator` or ".". */
export declare function parseNumberDraft(text: string, separator?: string): number | null;
/** Canonical text for a value: "" for null, otherwise the shortest
 * decimal that round-trips, written out in full with `separator` as the
 * decimal separator and no grouping. */
export declare function formatNumber(value: number | null, separator?: string): string;
export declare function clampNumber(value: number, { min, max }: NumberBounds): number;
/** The value one arrow press moves to. A value on the step grid moves one
 * step; a value between grid points snaps to the next point in that
 * direction, as native number inputs do. An empty field starts from `min`
 * going up and `max` going down (0 when that bound is unset). The grid math
 * is exact in decimal, so repeated 0.1 steps land on 0.2 and 0.3, then the
 * result is clamped to the range. Numbers stay within
 * ±Number.MAX_SAFE_INTEGER, where typed digits still match the value: a
 * step past it changes nothing, an empty field starts inside it, a value
 * supplied beyond it moves to its edge on a press toward zero, and a
 * range entirely beyond it leaves the field empty (null). */
export declare function stepNumber(value: number | null, direction: 1 | -1, bounds: NumberBounds): number | null;
/** Whether typed digits for `n` still read back as exactly `n`. */
export declare function isSafeNumber(n: number): boolean;
