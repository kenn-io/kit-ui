/*
 * Categorical palettes for charts and legends: standard color sequences as
 * plain data, plus helpers that hand each series a color, and, once colors
 * run out, a fill pattern, dash, and marker so series stay distinguishable.
 * Plain TypeScript with no Svelte or DOM, so stores, utilities, and server
 * code can use it too.
 */

import { hashIndex } from "./color-hash.js";

/** Standard categorical color sequences, verbatim from their sources. */
export const PALETTES = {
  /** matplotlib's default color cycle (Tableau 10). */
  tab10: [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ],
  /** matplotlib's tab20: tab10 with a light partner after each color. */
  tab20: [
    "#1f77b4",
    "#aec7e8",
    "#ff7f0e",
    "#ffbb78",
    "#2ca02c",
    "#98df8a",
    "#d62728",
    "#ff9896",
    "#9467bd",
    "#c5b0d5",
    "#8c564b",
    "#c49c94",
    "#e377c2",
    "#f7b6d2",
    "#7f7f7f",
    "#c7c7c7",
    "#bcbd22",
    "#dbdb8d",
    "#17becf",
    "#9edae5",
  ],
  /** matplotlib's tab20b: five hues in four shades each. */
  tab20b: [
    "#393b79",
    "#5254a3",
    "#6b6ecf",
    "#9c9ede",
    "#637939",
    "#8ca252",
    "#b5cf6b",
    "#cedb9c",
    "#8c6d31",
    "#bd9e39",
    "#e7ba52",
    "#e7cb94",
    "#843c39",
    "#ad494a",
    "#d6616b",
    "#e7969c",
    "#7b4173",
    "#a55194",
    "#ce6dbd",
    "#de9ed6",
  ],
  /** matplotlib's tab20c: five hues in four shades each. */
  tab20c: [
    "#3182bd",
    "#6baed6",
    "#9ecae1",
    "#c6dbef",
    "#e6550d",
    "#fd8d3c",
    "#fdae6b",
    "#fdd0a2",
    "#31a354",
    "#74c476",
    "#a1d99b",
    "#c7e9c0",
    "#756bb1",
    "#9e9ac8",
    "#bcbddc",
    "#dadaeb",
    "#636363",
    "#969696",
    "#bdbdbd",
    "#d9d9d9",
  ],
  /**
   * Petroff (2021), "Accessible Color Sequences for Data Visualization"
   * (matplotlib's petroff6, petroff8, and petroff10). Chosen to stay apart
   * under simulated color-vision deficiency and in grayscale, on a white
   * background. Each length was optimized on its own, so petroff8 is not the
   * start of petroff10.
   */
  petroff6: ["#5790fc", "#f89c20", "#e42536", "#964a8b", "#9c9ca1", "#7a21dd"],
  petroff8: [
    "#1845fb",
    "#ff5e02",
    "#c91f16",
    "#c849a9",
    "#adad7d",
    "#86c8dd",
    "#578dff",
    "#656364",
  ],
  petroff10: [
    "#3f90da",
    "#ffa90e",
    "#bd1f01",
    "#94a4a2",
    "#832db6",
    "#a96b59",
    "#e76300",
    "#b9ac70",
    "#717581",
    "#92dadd",
  ],
  /**
   * Okabe and Ito (2008), "Color Universal Design": the colors behind
   * matplotlib's seaborn-v0_8-colorblind style. Black is left out because it
   * disappears on dark themes.
   */
  okabeIto: ["#e69f00", "#56b4e9", "#009e73", "#f0e442", "#0072b2", "#d55e00", "#cc79a7"],
} as const satisfies Record<string, readonly string[]>;

/** Named palette families. A family lists sequences from shortest to
 * longest; a palette uses the shortest one that fits the series count. */
export type PaletteName = "matplotlib" | "petroff" | "okabe-ito";

const FAMILIES: Record<PaletteName, readonly (readonly string[])[]> = {
  matplotlib: [PALETTES.tab10, PALETTES.tab20, [...PALETTES.tab20b, ...PALETTES.tab20c]],
  petroff: [PALETTES.petroff6, PALETTES.petroff8, PALETTES.petroff10],
  "okabe-ito": [PALETTES.okabeIto],
};

const COLORBLIND_SAFE: ReadonlySet<PaletteName> = new Set(["petroff", "okabe-ito"]);

/** How a series fills an area: solid, or its color knocked out by a pattern. */
export type SeriesFill = "solid" | "hatch" | "crosshatch" | "dots";
/** How a series draws a line. */
export type SeriesDash = "solid" | "dashed" | "dotted" | "dash-dot";
/** The point shape a series marks data with; names match d3-shape symbols. */
export type SeriesMarker = "circle" | "square" | "triangle" | "diamond";

const FILLS: readonly SeriesFill[] = ["solid", "hatch", "crosshatch", "dots"];
const DASHES: readonly SeriesDash[] = ["solid", "dashed", "dotted", "dash-dot"];
const MARKERS: readonly SeriesMarker[] = ["circle", "square", "triangle", "diamond"];

/** Everything a chart needs to draw one series. */
export interface SeriesStyle {
  color: string;
  fill: SeriesFill;
  dash: SeriesDash;
  marker: SeriesMarker;
}

export interface PaletteOptions {
  /**
   * Use the Petroff family instead of `source` unless `source` is already a
   * color-blind safe family. Custom color lists are replaced too, since
   * kit-ui cannot vouch for them. `omit` does not apply to the replacement.
   */
  colorblind?: boolean;
  /** Colors to leave out of `source`, such as grays an app reserves for
   * "other". Compared case-insensitively. */
  omit?: readonly string[];
  /**
   * What happens after the longest sequence runs out. `"wrap"` (default)
   * repeats the colors. `"pattern"` repeats them with the next fill, dash,
   * and marker, so 10 colors give 40 distinct styles before anything
   * repeats.
   */
  overflow?: "wrap" | "pattern";
  /** Keys with a color of their own, such as `{ __other__: "var(--text-muted)" }`.
   * They take no slot from the palette. */
  fixed?: Readonly<Record<string, string>>;
  /** Color for empty keys and an empty palette. Default `var(--text-muted)`. */
  fallback?: string;
}

/**
 * How `assign` orders keys before handing out colors:
 * - `"given"`: first appearance in the list, e.g. ranked by size.
 * - `"sorted"`: code-unit order, so a key keeps its color across charts that
 *   show the same set.
 * - `"hash"`: each key starts from its `hashColor` slot and steps forward
 *   past slots already taken, so a key keeps its color across charts that
 *   show different sets.
 */
export type PaletteOrder = "given" | "sorted" | "hash";

export interface Palette {
  /** The longest sequence in use. */
  readonly colors: readonly string[];
  /** The color for series `index` of `count`, wrapping past the end. */
  at(index: number, count?: number): string;
  /** The full style for series `index` of `count`. */
  styleAt(index: number, count?: number): SeriesStyle;
  /** A stable color for a key, from its name hash. */
  forKey(key: string): string;
  /** Colors for every key, distinct until the longest sequence runs out. */
  assign(keys: readonly string[], options?: { order?: PaletteOrder }): ReadonlyMap<string, string>;
  /** Styles for every key, distinct until colors and, with
   * `overflow: "pattern"`, patterns run out. */
  assignStyles(
    keys: readonly string[],
    options?: { order?: PaletteOrder },
  ): ReadonlyMap<string, SeriesStyle>;
}

const DEFAULT_FALLBACK = "var(--text-muted)";

function sequencesFor(
  source: PaletteName | readonly string[],
  options: PaletteOptions,
): readonly (readonly string[])[] {
  const safe = typeof source === "string" && COLORBLIND_SAFE.has(source);
  if (options.colorblind && !safe) return FAMILIES.petroff;
  const sequences = typeof source === "string" ? FAMILIES[source] : [source];
  const omitted = new Set((options.omit ?? []).map((color) => color.toLowerCase()));
  if (omitted.size === 0) return sequences;
  // Omitting can shorten a longer sequence below a shorter one, so sort
  // again: callers take the first that fits and the last as the longest.
  return sequences
    .map((sequence) => sequence.filter((color) => !omitted.has(color.toLowerCase())))
    .filter((sequence) => sequence.length > 0)
    .sort((a, b) => a.length - b.length);
}

/**
 * Builds a palette from a named family or a custom color list.
 *
 * ```ts
 * const palette = createPalette("matplotlib", { colorblind: true });
 * palette.assign(["api", "web", "docs"], { order: "sorted" });
 * ```
 */
export function createPalette(
  source: PaletteName | readonly string[],
  options: PaletteOptions = {},
): Palette {
  const sequences = sequencesFor(source, options);
  const longest = sequences.at(-1) ?? [];
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  const fixed = options.fixed ?? {};
  const patterned = options.overflow === "pattern";

  function sequenceFor(count: number | undefined): readonly string[] {
    if (count === undefined) return longest;
    return sequences.find((sequence) => sequence.length >= count) ?? longest;
  }

  function styleFor(colors: readonly string[], slot: number): SeriesStyle {
    if (colors.length === 0) {
      return { color: fallback, fill: "solid", dash: "solid", marker: "circle" };
    }
    const round = patterned ? Math.floor(slot / colors.length) : 0;
    return {
      color: colors[slot % colors.length]!,
      fill: FILLS[round % FILLS.length]!,
      dash: DASHES[round % DASHES.length]!,
      marker: MARKERS[round % MARKERS.length]!,
    };
  }

  function solid(color: string): SeriesStyle {
    return { color, fill: "solid", dash: "solid", marker: "circle" };
  }

  const isFixed = (key: string) => Object.hasOwn(fixed, key);

  // Slots per key, in assignment order; a slot past the sequence length
  // means a later round.
  function slots(keys: readonly string[], order: PaletteOrder): Map<string, number> {
    const active = [...new Set(keys)].filter((key) => key !== "" && !isFixed(key));
    const result = new Map<string, number>();
    if (order !== "hash") {
      if (order === "sorted") active.sort();
      active.forEach((key, index) => result.set(key, index));
      return result;
    }
    const length = longest.length;
    if (length === 0) return result;
    const taken = new Set<number>();
    for (const key of active.sort()) {
      const preferred = hashIndex(key, length);
      let slot = preferred;
      for (let round = 0; ; round++) {
        const free = Array.from({ length }, (_, offset) => (preferred + offset) % length).find(
          (candidate) => !taken.has(round * length + candidate),
        );
        if (free !== undefined) {
          slot = round * length + free;
          break;
        }
      }
      taken.add(slot);
      result.set(key, slot);
    }
    return result;
  }

  function assignStyles(
    keys: readonly string[],
    { order = "given" }: { order?: PaletteOrder } = {},
  ): ReadonlyMap<string, SeriesStyle> {
    const keySlots = slots(keys, order);
    const colors = order === "hash" ? longest : sequenceFor(keySlots.size);
    const styleOf = (key: string): SeriesStyle => {
      const slot = keySlots.get(key);
      if (slot !== undefined) return styleFor(colors, slot);
      return solid(isFixed(key) ? fixed[key]! : fallback);
    };
    const unique = [...new Set(keys)];
    // Given order keeps the caller's order, such as a ranked legend. Sorted
    // and hash maps list palette keys first, then fixed and empty keys
    // sorted, so they come out the same for any input order.
    const listed =
      order === "given"
        ? unique
        : [...keySlots.keys(), ...unique.filter((key) => !keySlots.has(key)).sort()];
    return new Map(listed.map((key) => [key, styleOf(key)]));
  }

  return {
    colors: longest,
    at: (index, count) => styleFor(sequenceFor(count), index).color,
    styleAt: (index, count) => styleFor(sequenceFor(count), index),
    forKey(key) {
      if (isFixed(key)) return fixed[key]!;
      if (key === "" || longest.length === 0) return fallback;
      return longest[hashIndex(key, longest.length)]!;
    },
    assign(keys, options) {
      const colors = new Map<string, string>();
      for (const [key, style] of assignStyles(keys, options)) colors.set(key, style.color);
      return colors;
    },
    assignStyles,
  };
}

/** Tile geometry for a fill pattern, in CSS pixels. Lines run across the
 * tile at `rotate` degrees; dots sit at the tile center. */
export interface SeriesPattern {
  size: number;
  lines: readonly { rotate: number; width: number }[];
  dotRadius: number;
}

const PATTERN_SIZE = 6;

/** The tile a patterned fill repeats, or null for a solid fill. Charts
 * build their SVG or canvas patterns from this so they match
 * `seriesSwatchBackground`. */
export function seriesPattern(fill: SeriesFill): SeriesPattern | null {
  switch (fill) {
    case "solid":
      return null;
    case "hatch":
      return { size: PATTERN_SIZE, lines: [{ rotate: 45, width: 2 }], dotRadius: 0 };
    case "crosshatch":
      return {
        size: PATTERN_SIZE,
        lines: [
          { rotate: 45, width: 1.5 },
          { rotate: -45, width: 1.5 },
        ],
        dotRadius: 0,
      };
    case "dots":
      return { size: PATTERN_SIZE, lines: [], dotRadius: 1.5 };
  }
}

/**
 * A CSS `background` value that draws a series swatch for legends and
 * tooltips: the series color with the pattern knocked out in `ink`, which
 * defaults to the surface color.
 */
export function seriesSwatchBackground(
  style: Pick<SeriesStyle, "color" | "fill">,
  ink = "var(--bg-surface)",
): string {
  const pattern = seriesPattern(style.fill);
  if (pattern === null) return style.color;
  const layers = pattern.lines.map(
    ({ rotate, width }) =>
      `repeating-linear-gradient(${rotate}deg, ${ink} 0 ${width}px, transparent ${width}px ${pattern.size}px)`,
  );
  if (pattern.dotRadius > 0) {
    const edge = pattern.dotRadius + 0.5;
    layers.push(
      `radial-gradient(circle, ${ink} ${pattern.dotRadius}px, transparent ${edge}px) 0 0 / ${pattern.size}px ${pattern.size}px`,
    );
  }
  return [...layers, style.color].join(", ");
}

/** An SVG `stroke-dasharray` value for a line style, scaled to the stroke
 * width so dashes stay readable on thick lines. */
export function seriesDashArray(dash: SeriesDash, strokeWidth = 2): string {
  const w = strokeWidth;
  switch (dash) {
    case "solid":
      return "none";
    case "dashed":
      return `${3 * w} ${2 * w}`;
    case "dotted":
      return `${w} ${1.5 * w}`;
    case "dash-dot":
      return `${4 * w} ${1.5 * w} ${w} ${1.5 * w}`;
  }
}
