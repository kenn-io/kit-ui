/** WCAG 2 AA minimum for body text (1.4.3). */
export declare const WCAG_AA_TEXT = 4.5;
/** WCAG 2 AA minimum for large text and for UI components and graphics,
 * such as borders and icons (1.4.3, 1.4.11). */
export declare const WCAG_AA_NON_TEXT = 3;
/** Normalizes a hex color (with or without `#`, 3 or 6 digits) to
 * lowercase `#rrggbb`. Returns null for anything else. */
export declare function parseHexColor(value: string): string | null;
/** WCAG relative luminance (0 for black, 1 for white). Throws on a
 * non-hex color. */
export declare function relativeLuminance(color: string): number;
/** WCAG contrast ratio between two hex colors, from 1 to 21. Order does
 * not matter. Throws on a non-hex color. */
export declare function contrastRatio(a: string, b: string): number;
/** The candidate with the highest contrast against `background`; ties go
 * to the earlier candidate. Defaults to dark ink or white. */
export declare function readableInk(background: string, candidates?: readonly string[]): string;
/** Mixes two hex colors channel by channel, matching CSS
 * `color-mix(in srgb, a <weight * 100>%, b)` to within one step per channel
 * (engines round exact halves differently), so JS can measure a tint that
 * CSS draws. `weight` is the share of `a`, from 0 to 1. */
export declare function mixHexColors(a: string, b: string, weight: number): string;
