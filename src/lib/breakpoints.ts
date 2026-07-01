/**
 * Canonical responsive breakpoints, formalized from middleman's mobile work.
 *
 * CSS media queries cannot read custom properties, so components must write
 * the pixel values inline — but only these values. `kit-ui-check` flags any
 * other width in an `@media` rule of a consuming project.
 *
 *   compact  ≤ 640px — phones; single-column layouts. (Type sizing is NOT
 *                      width-based — the theme.css tokens resize on handheld
 *                      touch devices via MEDIA.handheld.)
 *   medium   ≤ 760px — small tablets / split panels collapse
 *   wide     ≤ 900px — narrow desktop; secondary sidebars collapse
 *
 * In JS, prefer `MediaQuery` from svelte/reactivity over manual matchMedia:
 *
 *   import { MediaQuery } from "svelte/reactivity";
 *   import { MEDIA } from "@kenn-io/kit-ui";
 *
 *   const compact = new MediaQuery(MEDIA.compact);
 *   // compact.current is reactive
 */

export const BREAKPOINTS = {
  compact: 640,
  medium: 760,
  wide: 900,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

/** Media-query strings for matchMedia / svelte/reactivity MediaQuery. The
 * width queries are mobile-first "at or below" checks matching the CSS
 * convention (`@media (max-width: 640px)`). */
export const MEDIA = {
  compact: `(max-width: ${BREAKPOINTS.compact}px)`,
  medium: `(max-width: ${BREAKPOINTS.medium}px)`,
  wide: `(max-width: ${BREAKPOINTS.wide}px)`,
  /** Touch-first device: no hover affordances, larger hit targets. OR-form —
   * matches if either signal is present. */
  touch: "(hover: none), (pointer: coarse)",
  /** True handheld (both signals): what the theme.css touch type scale keys
   * on. Force it in tests/demos with the `kit-type-touch` root class. */
  handheld: "(hover: none) and (pointer: coarse)",
  /** Guard animations/transitions behind this. */
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;
