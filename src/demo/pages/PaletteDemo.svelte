<script lang="ts">
  import SegmentedControl from "../../lib/components/SegmentedControl.svelte";
  import Toggle from "../../lib/components/Toggle.svelte";
  import {
    createPalette,
    seriesDashArray,
    seriesSwatchBackground,
    type PaletteName,
  } from "../../lib/utils/palette.js";
  import DemoSection from "../DemoSection.svelte";

  const FAMILY_OPTIONS: { value: PaletteName; label: string }[] = [
    { value: "matplotlib", label: "matplotlib" },
    { value: "petroff", label: "petroff" },
    { value: "okabe-ito", label: "okabe-ito" },
  ];
  const COUNT_OPTIONS = ["5", "9", "15", "24"].map((value) => ({ value, label: value }));

  let family = $state<PaletteName>("matplotlib");
  let count = $state("9");
  let colorblind = $state(false);

  const seriesKeys = (n: number) => Array.from({ length: n }, (_, i) => `series ${i + 1}`);

  const familyColors = $derived(
    createPalette(family, { colorblind }).assign(seriesKeys(Number(count))),
  );

  const patterned = createPalette("petroff", { overflow: "pattern" }).assignStyles(seriesKeys(40));
  // Two series from each round, so every dash and marker shows.
  const lineStyles = [0, 1, 10, 11, 20, 21, 30, 31].map((index) => [...patterned.values()][index]!);
</script>

<DemoSection
  title="Families"
  description="A family grows with the series count: matplotlib goes tab10 → tab20 → tab20b + tab20c, petroff goes 6 → 8 → 10. The color-blind option swaps any family that is not color-blind safe for petroff."
  code={`const palette = createPalette("matplotlib", { colorblind });
palette.assign(keys, { order: "sorted" }); // Map<key, color>`}
>
  <div class="controls">
    <SegmentedControl
      options={FAMILY_OPTIONS}
      value={family}
      onchange={(value) => (family = value as PaletteName)}
      ariaLabel="Palette family"
    />
    <SegmentedControl
      options={COUNT_OPTIONS}
      value={count}
      onchange={(value) => (count = value)}
      ariaLabel="Series count"
    />
    <Toggle bind:checked={colorblind} label="Color-blind safe" />
  </div>
  <ul class="swatches" data-testid="family-swatches">
    {#each familyColors as [key, color] (key)}
      <li class="swatch" style:background={color} title={`${key}: ${color}`}></li>
    {/each}
  </ul>
</DemoSection>

<DemoSection
  title="Patterns past the last color"
  description={'With overflow: "pattern", petroff\'s 10 colors repeat with hatching, then cross-hatching, then dots, so 40 series stay distinct. Legends use seriesSwatchBackground; charts build SVG patterns from seriesPattern.'}
  code={`const styles = createPalette("petroff", { overflow: "pattern" }).assignStyles(keys);
<span style:background={seriesSwatchBackground(styles.get(key))}></span>`}
>
  <ul class="swatches swatches--large" data-testid="pattern-swatches">
    {#each patterned as [key, style] (key)}
      <li
        class="swatch"
        style:background={seriesSwatchBackground(style)}
        title={`${key}: ${style.color}, ${style.fill}`}
        data-fill={style.fill}
        data-color={style.color}
      ></li>
    {/each}
  </ul>
</DemoSection>

<DemoSection
  title="Line styles"
  description="Line charts can't hatch, so later rounds change the dash and the marker instead."
  code={`<path stroke={style.color} stroke-dasharray={seriesDashArray(style.dash)} />`}
>
  <svg
    class="lines"
    viewBox="0 0 280 {lineStyles.length * 14 + 6}"
    role="img"
    aria-label="Line styles"
  >
    {#each lineStyles as style, index (index)}
      {@const y = index * 14 + 10}
      <line
        x1="8"
        x2="240"
        y1={y}
        y2={y}
        stroke={style.color}
        stroke-width="2"
        stroke-dasharray={seriesDashArray(style.dash)}
      />
      {#if style.marker === "circle"}
        <circle cx="258" cy={y} r="4" fill={style.color} />
      {:else if style.marker === "square"}
        <rect x="254" y={y - 4} width="8" height="8" fill={style.color} />
      {:else if style.marker === "triangle"}
        <path d="M258 {y - 5} L263 {y + 4} L253 {y + 4} Z" fill={style.color} />
      {:else}
        <path d="M258 {y - 5} L263 {y} L258 {y + 5} L253 {y} Z" fill={style.color} />
      {/if}
    {/each}
  </svg>
</DemoSection>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .swatch {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
  }

  .swatches--large .swatch {
    width: 36px;
    height: 36px;
  }

  .lines {
    width: 100%;
    max-width: 420px;
  }
</style>
