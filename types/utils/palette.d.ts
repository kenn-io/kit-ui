/** Standard categorical color sequences, verbatim from their sources. */
export declare const PALETTES: {
    /** matplotlib's default color cycle (Tableau 10). */
    readonly tab10: readonly ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
    /** matplotlib's tab20: tab10 with a light partner after each color. */
    readonly tab20: readonly ["#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5"];
    /** matplotlib's tab20b: five hues in four shades each. */
    readonly tab20b: readonly ["#393b79", "#5254a3", "#6b6ecf", "#9c9ede", "#637939", "#8ca252", "#b5cf6b", "#cedb9c", "#8c6d31", "#bd9e39", "#e7ba52", "#e7cb94", "#843c39", "#ad494a", "#d6616b", "#e7969c", "#7b4173", "#a55194", "#ce6dbd", "#de9ed6"];
    /** matplotlib's tab20c: five hues in four shades each. */
    readonly tab20c: readonly ["#3182bd", "#6baed6", "#9ecae1", "#c6dbef", "#e6550d", "#fd8d3c", "#fdae6b", "#fdd0a2", "#31a354", "#74c476", "#a1d99b", "#c7e9c0", "#756bb1", "#9e9ac8", "#bcbddc", "#dadaeb", "#636363", "#969696", "#bdbdbd", "#d9d9d9"];
    /**
     * Petroff (2021), "Accessible Color Sequences for Data Visualization"
     * (matplotlib's petroff6, petroff8, and petroff10). Chosen to stay apart
     * under simulated color-vision deficiency and in grayscale, on a white
     * background. Each length was optimized on its own, so petroff8 is not the
     * start of petroff10.
     */
    readonly petroff6: readonly ["#5790fc", "#f89c20", "#e42536", "#964a8b", "#9c9ca1", "#7a21dd"];
    readonly petroff8: readonly ["#1845fb", "#ff5e02", "#c91f16", "#c849a9", "#adad7d", "#86c8dd", "#578dff", "#656364"];
    readonly petroff10: readonly ["#3f90da", "#ffa90e", "#bd1f01", "#94a4a2", "#832db6", "#a96b59", "#e76300", "#b9ac70", "#717581", "#92dadd"];
    /**
     * Okabe and Ito (2008), "Color Universal Design": the colors behind
     * matplotlib's seaborn-v0_8-colorblind style. Black is left out because it
     * disappears on dark themes.
     */
    readonly okabeIto: readonly ["#e69f00", "#56b4e9", "#009e73", "#f0e442", "#0072b2", "#d55e00", "#cc79a7"];
};
/** Named palette families. A family lists sequences from shortest to
 * longest; a palette uses the shortest one that fits the series count. */
export type PaletteName = "matplotlib" | "petroff" | "okabe-ito";
/** How a series fills an area: solid, or its color knocked out by a pattern. */
export type SeriesFill = "solid" | "hatch" | "crosshatch" | "dots";
/** How a series draws a line. */
export type SeriesDash = "solid" | "dashed" | "dotted" | "dash-dot";
/** The point shape a series marks data with; names match d3-shape symbols. */
export type SeriesMarker = "circle" | "square" | "triangle" | "diamond";
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
    assign(keys: readonly string[], options?: {
        order?: PaletteOrder;
    }): ReadonlyMap<string, string>;
    /** Styles for every key, distinct until colors and, with
     * `overflow: "pattern"`, patterns run out. */
    assignStyles(keys: readonly string[], options?: {
        order?: PaletteOrder;
    }): ReadonlyMap<string, SeriesStyle>;
}
/**
 * Builds a palette from a named family or a custom color list.
 *
 * ```ts
 * const palette = createPalette("matplotlib", { colorblind: true });
 * palette.assign(["api", "web", "docs"], { order: "sorted" });
 * ```
 */
export declare function createPalette(source: PaletteName | readonly string[], options?: PaletteOptions): Palette;
/** Tile geometry for a fill pattern, in CSS pixels. Lines run across the
 * tile at `rotate` degrees; dots sit at the tile center. */
export interface SeriesPattern {
    size: number;
    lines: readonly {
        rotate: number;
        width: number;
    }[];
    dotRadius: number;
}
/** The tile a patterned fill repeats, or null for a solid fill. Charts
 * build their SVG or canvas patterns from this so they match
 * `seriesSwatchBackground`. */
export declare function seriesPattern(fill: SeriesFill): SeriesPattern | null;
/**
 * A CSS `background` value that draws a series swatch for legends and
 * tooltips: the series color with the pattern knocked out in `ink`, which
 * defaults to the surface color.
 */
export declare function seriesSwatchBackground(style: Pick<SeriesStyle, "color" | "fill">, ink?: string): string;
/** An SVG `stroke-dasharray` value for a line style, scaled to the stroke
 * width so dashes stay readable on thick lines. */
export declare function seriesDashArray(dash: SeriesDash, strokeWidth?: number): string;
