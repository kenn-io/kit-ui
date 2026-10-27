/*
 * WCAG 2 contrast math for caller-supplied hex colors. Theme tokens can't be
 * measured in JS, so apps that let users pick colors check the picks against
 * known surfaces (for example the palettes in brand.json) with these helpers.
 */

/** WCAG 2 AA minimum for body text (1.4.3). */
export const WCAG_AA_TEXT = 4.5;
/** WCAG 2 AA minimum for large text and for UI components and graphics,
 * such as borders and icons (1.4.3, 1.4.11). */
export const WCAG_AA_NON_TEXT = 3;

/** Normalizes a hex color (with or without `#`, 3 or 6 digits) to
 * lowercase `#rrggbb`. Returns null for anything else. */
export function parseHexColor(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${[...hex].map((char) => `${char}${char}`).join("")}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  return null;
}

function channels(color: string): [number, number, number] {
  const hex = parseHexColor(color);
  if (hex === null) throw new Error(`not a hex color: ${color}`);
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** WCAG relative luminance (0 for black, 1 for white). Throws on a
 * non-hex color. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = channels(color).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors, from 1 to 21. Order does
 * not matter. Throws on a non-hex color. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** The candidate with the highest contrast against `background`; ties go
 * to the earlier candidate. Defaults to dark ink or white. */
export function readableInk(
  background: string,
  candidates: readonly string[] = ["#1f2328", "#ffffff"],
): string {
  let best = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    if (contrastRatio(candidate, background) > contrastRatio(best, background)) best = candidate;
  }
  return best;
}

/** Mixes two hex colors channel by channel, matching CSS
 * `color-mix(in srgb, a <weight * 100>%, b)` to within one step per channel
 * (engines round exact halves differently), so JS can measure a tint that
 * CSS draws. `weight` is the share of `a`, from 0 to 1. */
export function mixHexColors(a: string, b: string, weight: number): string {
  const share = Math.min(1, Math.max(0, weight));
  const first = channels(a);
  const second = channels(b);
  return `#${first
    .map((value, index) =>
      Math.round(value * share + second[index]! * (1 - share))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
