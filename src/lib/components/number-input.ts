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

/** Digits after the decimal point in `n`'s shortest decimal form. */
function decimalsOf(n: number): number {
  const text = String(n);
  const exponent = text.match(/e-(\d+)$/);
  if (exponent) {
    const mantissa = text.slice(0, exponent.index);
    const dot = mantissa.indexOf(".");
    return Number(exponent[1]) + (dot === -1 ? 0 : mantissa.length - dot - 1);
  }
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Decimal places a value can carry: enough for `step` and for the `min`
 * the step grid is anchored on. 0 means the field takes integers only. */
export function numberPrecision({ min, step }: NumberBounds): number {
  return Math.max(decimalsOf(step), min === undefined ? 0 : decimalsOf(min));
}

/** Whether a minus sign may be typed: only when the range reaches below 0. */
export function allowsNegative({ min }: NumberBounds): boolean {
  return min === undefined || min < 0;
}

/** Whether `text` is a number, or the start of one, that the field may
 * hold while the user types: an optional leading minus (when negatives are
 * allowed), digits, and one decimal point (when the precision allows
 * decimals). "-", "." and "" are accepted as in-progress text. */
export function isNumberDraft(text: string, bounds: NumberBounds): boolean {
  const sign = allowsNegative(bounds) ? "-?" : "";
  const fraction = numberPrecision(bounds) > 0 ? "(?:\\.\\d*)?" : "";
  return new RegExp(`^${sign}\\d*${fraction}$`).test(text);
}

/** The number a draft means, or null while it has no digits yet. */
export function parseNumberDraft(text: string): number | null {
  if (!/\d/.test(text)) return null;
  return Number(text);
}

/** Canonical text for a value: "" for null, shortest decimal otherwise. */
export function formatNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

export function clampNumber(value: number, { min, max }: NumberBounds): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

/** The value one arrow press moves to. A value on the step grid moves one
 * step; a value between grid points snaps to the next point in that
 * direction, as native number inputs do. An empty field starts from `min`
 * going up and `max` going down (0 when that bound is unset). The result
 * is rounded to the field's precision so repeated 0.1 steps stay exact,
 * then clamped to the range. */
export function stepNumber(value: number | null, direction: 1 | -1, bounds: NumberBounds): number {
  const precision = numberPrecision(bounds);
  const round = (n: number): number => Number(n.toFixed(precision));
  if (value === null) {
    return clampNumber((direction === 1 ? bounds.min : bounds.max) ?? 0, bounds);
  }
  const base = bounds.min ?? 0;
  // Round the grid index so float noise (0.30000000000000004) counts as
  // on-grid instead of snapping a step short.
  const index = Number(((value - base) / bounds.step).toFixed(9));
  const next = Number.isInteger(index)
    ? index + direction
    : direction === 1
      ? Math.ceil(index)
      : Math.floor(index);
  return clampNumber(round(base + next * bounds.step), bounds);
}

/** The text an insertion (typing, paste, drop) would leave in the field:
 * `inserted` replaces the selected range. Deletions need no such check,
 * since removing characters from an allowed draft leaves an allowed one. */
export function draftAfterInsert(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  inserted: string,
): string {
  return current.slice(0, selectionStart) + inserted + current.slice(selectionEnd);
}
