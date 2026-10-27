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

/** Decimal places a value can carry: enough for `step`, for the `min` the
 * step grid is anchored on, and for a `max` a clamp can land on. 0 means
 * the field takes integers only. */
export function numberPrecision({ min, max, step }: NumberBounds): number {
  return Math.max(
    decimalsOf(step),
    min === undefined ? 0 : decimalsOf(min),
    max === undefined ? 0 : decimalsOf(max),
  );
}

/** Whether a minus sign may be typed: only when the range reaches below 0. */
export function allowsNegative({ min }: NumberBounds): boolean {
  return min === undefined || min < 0;
}

/** Whether `text` is a number, or the start of one, that the field may
 * hold while the user types: an optional leading minus (when negatives are
 * allowed), digits, and one decimal point (when the precision allows
 * decimals). "-", "." and "" are accepted as in-progress text. Numbers
 * beyond Number.MAX_SAFE_INTEGER are refused, since past it the parsed
 * value would no longer match the digits typed. */
export function isNumberDraft(text: string, bounds: NumberBounds): boolean {
  if (!isNumberText(text, bounds)) return false;
  const value = parseNumberDraft(text);
  return value === null || isSafeNumber(value);
}

/** Whether `text` has the shape of a number draft, whatever its size:
 * isNumberDraft without the safe-integer limit. */
export function isNumberText(text: string, bounds: NumberBounds): boolean {
  const sign = allowsNegative(bounds) ? "-?" : "";
  const fraction = numberPrecision(bounds) > 0 ? "(?:\\.\\d*)?" : "";
  return new RegExp(`^${sign}\\d*${fraction}$`).test(text);
}

/** The number a draft means, or null while it has no digits yet. */
export function parseNumberDraft(text: string): number | null {
  if (!/\d/.test(text)) return null;
  return Number(text);
}

/** Canonical text for a value: "" for null, otherwise the shortest
 * decimal that round-trips, written out in full. JavaScript switches to
 * exponent form ("1e-7", "1e+21") at the extremes, which the draft rules
 * do not accept, so those digits are expanded. */
export function formatNumber(value: number | null): string {
  if (value === null) return "";
  const text = String(value);
  const exponent = text.match(/^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/);
  if (!exponent) return text;
  const [, sign = "", whole = "", fraction = "", power = "0"] = exponent;
  const digits = whole + fraction;
  const point = whole.length + Number(power);
  if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
  // Exponent form only appears below 1e-6 or from 1e21 up, so the point
  // never falls inside the digits.
  return sign + digits + "0".repeat(point - digits.length);
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
 * is rounded to the decimals of `step` and `min`, so repeated 0.1 steps
 * stay exact, then clamped to the range. Numbers stay within
 * ±Number.MAX_SAFE_INTEGER, where typed digits still match the value: a
 * step past it changes nothing, an empty field starts inside it, a value
 * supplied beyond it moves to its edge on a press toward zero, and a
 * range entirely beyond it leaves the field empty (null). */
export function stepNumber(
  value: number | null,
  direction: 1 | -1,
  bounds: NumberBounds,
): number | null {
  if (value === null || !isSafeNumber(value)) {
    if (value !== null && Math.sign(value) !== -direction) return value;
    const start = value ?? (direction === 1 ? bounds.min : bounds.max) ?? 0;
    const result = clampNumber(clampToSafe(start), bounds);
    return isSafeNumber(result) ? result : value;
  }
  const { min = 0, step } = bounds;
  // Round to the grid's own decimals. max's decimals only decide whether a
  // decimal point may be typed; rounding to a long max such as
  // 0.9999999999999999 would keep float noise like 0.7999999999999999.
  const precision = Math.max(decimalsOf(step), decimalsOf(min));
  // toFixed takes at most 100 places; a step finer than that is left
  // unrounded rather than rounded to zero.
  const round = (n: number): number => (precision > 100 ? n : Number(n.toFixed(precision)));
  // Distances from the value to the grid points below and above it. The
  // remainders of value and min are taken separately, so subtracting a
  // distant min never rounds, and kept signed, since adding a whole step
  // to a tiny negative remainder would round it to exactly one step. The
  // step is then taken from the value itself, so no count of grid points
  // is built that could outgrow exact integers.
  const remainder = ((value % step) - (min % step)) % step;
  const down = remainder >= 0 ? remainder : step + remainder;
  const up = remainder > 0 ? step - remainder : -remainder;
  // Within a few rounding errors of a grid point counts as on it: the
  // noise a value picks up from repeated decimal steps
  // (0.30000000000000004) plus the error in min's own decimal form. It
  // follows those sizes, not the step's, so a huge step still snaps a
  // small value, and stays under a quarter step so neighboring grid
  // points never merge.
  const tolerance = Math.min(Number.EPSILON * (16 * Math.abs(value) + 2 * Math.abs(min)), step / 4);
  const onGrid = down <= tolerance || up <= tolerance;
  const next = onGrid ? value + direction * step : direction === 1 ? value + up : value - down;
  const result = clampNumber(round(next), bounds);
  return isSafeNumber(result) ? result : value;
}

function clampToSafe(n: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(-Number.MAX_SAFE_INTEGER, n));
}

/** Whether typed digits for `n` still read back as exactly `n`. */
export function isSafeNumber(n: number): boolean {
  return Math.abs(n) <= Number.MAX_SAFE_INTEGER;
}
