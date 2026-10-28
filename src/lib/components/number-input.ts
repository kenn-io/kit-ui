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
  return formatNumber(n).split(".")[1]?.length ?? 0;
}

/** Whether a decimal separator may be typed: only when `step`, the `min` the
 * step grid is anchored on, or a `max` a clamp can land on has decimals. */
export function allowsDecimals({ min, max, step }: NumberBounds): boolean {
  return [step, min, max].some((n) => n !== undefined && decimalsOf(n) > 0);
}

/** The decimal separator `locale` writes between whole and fractional
 * digits, such as "." for en-US and "," for de-DE. The field shows plain
 * ASCII digits, so this is the separator the locale uses with Latin
 * digits: ar-EG gives ".", not the Arabic decimal separator it pairs with
 * its own digits. `undefined` means the runtime's default locale. */
export function decimalSeparator(locale?: string): string {
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat(locale, { numberingSystem: "latn" });
  } catch (error) {
    // Chromium's message names neither the component nor the tag, and a
    // POSIX-style "en_US" from a user setting is an easy mistake.
    if (!(error instanceof RangeError)) throw error;
    throw new RangeError(
      `NumberInput: locale must be a hyphenated BCP 47 tag such as "de-DE", got ${JSON.stringify(locale)}`,
      { cause: error },
    );
  }
  const parts = format.formatToParts(0.5);
  return parts.find((part) => part.type === "decimal")?.value ?? ".";
}

/** Whether a minus sign may be typed: only when the range reaches below 0. */
export function allowsNegative({ min }: NumberBounds): boolean {
  return min === undefined || min < 0;
}

/** Whether `text` is a number, or the start of one, that the field may
 * hold while the user types: an optional leading minus (when negatives are
 * allowed), digits, and one decimal separator (when the precision allows
 * decimals). The separator is `separator` or ".", which is accepted in
 * every locale so a number copied from elsewhere still pastes. "-", the
 * separator alone and "" are accepted as in-progress text. Numbers beyond
 * Number.MAX_SAFE_INTEGER are refused, since past it the parsed value
 * would no longer match the digits typed. */
export function isNumberDraft(text: string, bounds: NumberBounds, separator = "."): boolean {
  if (!isNumberText(text, bounds, separator)) return false;
  // Compare the digits themselves: Number() rounds "9007199254740991.1"
  // back onto the limit, so a check on the parsed value would let it in.
  const [whole = "", fraction = ""] = text.replace("-", "").replace(separator, ".").split(".");
  const size = BigInt(whole || "0");
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  return size < limit || (size === limit && !/[1-9]/.test(fraction));
}

/** Whether `text` has the shape of a number draft, whatever its size:
 * isNumberDraft without the safe-integer limit. The separator is a single
 * "." or ",", so a character class holds it without escaping. */
export function isNumberText(text: string, bounds: NumberBounds, separator = "."): boolean {
  const sign = allowsNegative(bounds) ? "-?" : "";
  const fraction = allowsDecimals(bounds) ? `(?:[.${separator}]\\d*)?` : "";
  return new RegExp(`^${sign}\\d*${fraction}$`).test(text);
}

/** The text the field keeps for an edit: surrounding whitespace dropped,
 * and a "." written as `separator`, so the field always shows the
 * locale's form. */
export function normalizeNumberDraft(text: string, separator = "."): string {
  return text.trim().replace(".", separator);
}

/** The number a draft means, or null while it has no digits yet. The
 * decimal separator may be `separator` or ".". */
export function parseNumberDraft(text: string, separator = "."): number | null {
  if (!/\d/.test(text)) return null;
  return Number(text.replace(separator, "."));
}

/** Canonical text for a value: "" for null, otherwise the shortest
 * decimal that round-trips, written out in full with `separator` as the
 * decimal separator and no grouping. */
export function formatNumber(value: number | null, separator = "."): string {
  return expandExponent(value).replace(".", separator);
}

/** `value` as the shortest round-tripping decimal. JavaScript switches to
 * exponent form ("1e-7", "1e+21") at the extremes, which the draft rules
 * do not accept, so those digits are expanded. */
function expandExponent(value: number | null): string {
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
 * going up and `max` going down (0 when that bound is unset). The grid math
 * is exact in decimal, so repeated 0.1 steps land on 0.2 and 0.3, then the
 * result is clamped to the range. Numbers stay within
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
    const safe = Math.min(Number.MAX_SAFE_INTEGER, Math.max(-Number.MAX_SAFE_INTEGER, start));
    const result = clampNumber(safe, bounds);
    return isSafeNumber(result) ? result : value;
  }
  const { min = 0, step } = bounds;
  // Binary floats cannot hold decimals such as 0.1 exactly, and lose digits
  // once a grid is anchored far away, so the grid math runs on whole
  // numbers: value, min and step scaled by the decimal places they carry.
  const places = Math.max(decimalsOf(value), decimalsOf(min), decimalsOf(step));
  const v = toScaled(value, places);
  const m = toScaled(min, places);
  const s = BigInt(direction) * toScaled(step, places);
  const offset = (((v - m) % s) + s) % s;
  const first = v + s - offset;
  const pointAt = (count: bigint): number => fromScaled(first + count * s, places);
  // A grid point no double can hold, such as 1.00000000000000001, can
  // round back to the value itself. Rounding never reverses order, so the
  // first point that rounds to a different number is found by doubling
  // the count of steps until one does, then bisecting.
  let low = -1n;
  let high = 0n;
  while (pointAt(high) === value) {
    low = high;
    high = high * 2n + 1n;
  }
  while (high - low > 1n) {
    const middle = (low + high) / 2n;
    if (pointAt(middle) === value) low = middle;
    else high = middle;
  }
  const result = clampNumber(pointAt(high), bounds);
  return isSafeNumber(result) ? result : value;
}

/** `n` times 10^places as an exact integer, read from its decimal digits. */
function toScaled(n: number, places: number): bigint {
  const [whole = "0", fraction = ""] = formatNumber(n).split(".");
  return BigInt(whole + fraction.padEnd(places, "0"));
}

/** The number `scaled` / 10^places names. */
function fromScaled(scaled: bigint, places: number): number {
  const sign = scaled < 0n ? "-" : "";
  const digits = (scaled < 0n ? -scaled : scaled).toString().padStart(places + 1, "0");
  const point = digits.length - places;
  return Number(`${sign}${digits.slice(0, point)}.${digits.slice(point)}`);
}

/** Whether typed digits for `n` still read back as exactly `n`. */
export function isSafeNumber(n: number): boolean {
  return Math.abs(n) <= Number.MAX_SAFE_INTEGER;
}
