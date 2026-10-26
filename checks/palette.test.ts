import { describe, expect, test } from "bun:test";
import { hashColor } from "../src/lib/utils/color-hash.js";
import {
  createPalette,
  PALETTES,
  seriesDashArray,
  seriesPattern,
  seriesSwatchBackground,
} from "../src/lib/utils/palette.js";

const keys = (count: number) =>
  Array.from({ length: count }, (_, i) => `k${String(i).padStart(2, "0")}`);

describe("createPalette families", () => {
  test("uses the shortest sequence that fits the series count", () => {
    const palette = createPalette("petroff");
    expect([...palette.assign(keys(5)).values()]).toEqual(PALETTES.petroff6.slice(0, 5));
    expect([...palette.assign(keys(7)).values()]).toEqual(PALETTES.petroff8.slice(0, 7));
    expect([...palette.assign(keys(9)).values()]).toEqual(PALETTES.petroff10.slice(0, 9));
  });

  test("wraps past the longest sequence", () => {
    const palette = createPalette("petroff");
    const colors = [...palette.assign(keys(12)).values()];
    expect(colors[10]).toBe(PALETTES.petroff10[0]);
    expect(colors[11]).toBe(PALETTES.petroff10[1]);
    expect(palette.at(13)).toBe(PALETTES.petroff10[3]);
  });

  test("grows matplotlib from tab10 to tab20 to tab20b and tab20c", () => {
    const palette = createPalette("matplotlib");
    expect(palette.assign(keys(10)).get("k09")).toBe(PALETTES.tab10[9]);
    expect(palette.assign(keys(11)).get("k01")).toBe(PALETTES.tab20[1]);
    expect(palette.assign(keys(21)).get("k20")).toBe(PALETTES.tab20c[0]);
  });

  test("omit drops colors case-insensitively before sizing", () => {
    const palette = createPalette("matplotlib", { omit: ["#7F7F7F", "#c7c7c7"] });
    const nine = [...palette.assign(keys(9)).values()];
    expect(nine).not.toContain("#7f7f7f");
    expect(nine).toHaveLength(9);
    expect(new Set(nine).size).toBe(9);
    // Ten series no longer fit the nine remaining tab10 colors.
    expect(palette.assign(keys(10)).get("k01")).toBe(PALETTES.tab20[1]);
  });
});

describe("colorblind option", () => {
  test("swaps a family that is not color-blind safe for Petroff", () => {
    const palette = createPalette("matplotlib", { colorblind: true, omit: ["#94a4a2"] });
    expect([...palette.assign(keys(10)).values()]).toEqual(PALETTES.petroff10);
  });

  test("replaces custom lists", () => {
    const palette = createPalette(["var(--accent-red)", "var(--accent-green)"], {
      colorblind: true,
    });
    expect(palette.at(0)).toBe(PALETTES.petroff10[0]);
  });

  test("keeps a family that is already color-blind safe", () => {
    const palette = createPalette("okabe-ito", { colorblind: true });
    expect(palette.colors).toEqual(PALETTES.okabeIto);
  });
});

describe("assign orders", () => {
  test("sorted order gives a key the same color whatever order it arrives in", () => {
    const palette = createPalette("petroff");
    const a = palette.assign(["web", "api", "docs"], { order: "sorted" });
    const b = palette.assign(["docs", "web", "api"], { order: "sorted" });
    expect(a).toEqual(b);
    expect(a.get("api")).toBe(PALETTES.petroff6[0]);
  });

  test("given order follows the list and ignores repeats", () => {
    const colors = createPalette("petroff").assign(["b", "a", "b", "c"]);
    expect([...colors.entries()]).toEqual([
      ["b", PALETTES.petroff6[0]],
      ["a", PALETTES.petroff6[1]],
      ["c", PALETTES.petroff6[2]],
    ]);
  });

  test("hash order starts each key at its hashColor slot", () => {
    const list = ["red", "green", "blue", "gold"];
    const colors = createPalette(list).assign(["api"], { order: "hash" });
    expect(colors.get("api")).toBe(hashColor("api", list));
  });

  test("hash order steps past taken slots, then repeats once all are taken", () => {
    const list = ["red", "green", "blue"];
    const many = keys(5);
    const colors = createPalette(list).assign(many, { order: "hash" });
    const firstThree = many.slice(0, 3).map((key) => colors.get(key));
    expect(new Set(firstThree).size).toBe(3);
    expect(colors.get("k03")).toBe(hashColor("k03", list));
  });

  test("fixed keys and empty keys take no slot", () => {
    const palette = createPalette("petroff", {
      fixed: { __other__: "var(--muted)" },
      fallback: "gray",
    });
    const colors = palette.assign(["a", "__other__", "", "b"]);
    expect(colors.get("a")).toBe(PALETTES.petroff6[0]);
    expect(colors.get("b")).toBe(PALETTES.petroff6[1]);
    expect(colors.get("__other__")).toBe("var(--muted)");
    expect(colors.get("")).toBe("gray");
    expect(palette.forKey("")).toBe("gray");
    expect(palette.forKey("__other__")).toBe("var(--muted)");
  });

  test("an empty palette falls back for every key", () => {
    const palette = createPalette([]);
    expect(palette.assign(["a"]).get("a")).toBe("var(--text-muted)");
    expect(palette.at(0)).toBe("var(--text-muted)");
    expect(palette.forKey("a")).toBe("var(--text-muted)");
  });
});

describe("pattern overflow", () => {
  test("keeps series distinct past the last color with fills, dashes, and markers", () => {
    const styles = createPalette("petroff", { overflow: "pattern" }).assignStyles(keys(21));
    expect(styles.get("k00")).toEqual({
      color: PALETTES.petroff10[0],
      fill: "solid",
      dash: "solid",
      marker: "circle",
    });
    expect(styles.get("k10")).toEqual({
      color: PALETTES.petroff10[0],
      fill: "hatch",
      dash: "dashed",
      marker: "square",
    });
    expect(styles.get("k20")?.fill).toBe("crosshatch");
    const distinct = new Set([...styles.values()].map((style) => JSON.stringify(style)));
    expect(distinct.size).toBe(21);
  });

  test("wrap overflow repeats styles as well as colors", () => {
    const styles = createPalette("petroff").assignStyles(keys(11));
    expect(styles.get("k10")).toEqual(styles.get("k00"));
  });

  test("hash order moves to the next pattern once every color is taken", () => {
    const list = ["red", "green"];
    const styles = createPalette(list, { overflow: "pattern" }).assignStyles(keys(3), {
      order: "hash",
    });
    const fills = [...styles.values()].map((style) => style.fill).sort();
    expect(fills).toEqual(["hatch", "solid", "solid"]);
  });
});

describe("pattern helpers", () => {
  test("solid fills have no tile and draw as the plain color", () => {
    expect(seriesPattern("solid")).toBeNull();
    expect(seriesSwatchBackground({ color: "#3f90da", fill: "solid" })).toBe("#3f90da");
  });

  test("patterned swatches keep the series color as the base layer", () => {
    for (const fill of ["hatch", "crosshatch", "dots"] as const) {
      expect(
        seriesSwatchBackground({ color: "#3f90da", fill }, "white").endsWith(", #3f90da"),
      ).toBe(true);
    }
  });

  test("dash arrays scale with the stroke width", () => {
    expect(seriesDashArray("solid")).toBe("none");
    expect(seriesDashArray("dashed", 1)).toBe("3 2");
    expect(seriesDashArray("dashed", 2)).toBe("6 4");
  });
});
