<script module lang="ts">
  import { parseHexColor, readableInk } from "../utils/color-contrast.js";

  export type ColorLabelSize = "sm" | "md";

  /* Candidate text colors: GitHub's label ink and plain white. Raw hex is
   * intentional — these feed the WCAG contrast math against an arbitrary
   * caller-supplied background, so they can't be theme tokens. */
  const TEXT_COLORS = ["#1f2328", "#ffffff"];
  const FALLBACK_BACKGROUND = "#6e7781";
</script>

<script lang="ts">
  interface Props {
    /** Label text. */
    name: string;
    /** Background hex color, with or without `#` (3 or 6 digits). Invalid
     * values fall back to a neutral gray. */
    color: string;
    size?: ColorLabelSize;
    title?: string | undefined;
    class?: string;
  }

  let { name, color, size = "md", title = undefined, class: className = "" }: Props = $props();

  const background = $derived(parseHexColor(color) ?? FALLBACK_BACKGROUND);
  const foreground = $derived(readableInk(background, TEXT_COLORS));
</script>

<span
  class={["kit-color-label", `kit-color-label--${size}`, className]}
  style:--kit-color-label-hue={background}
  style:--kit-color-label-ink={foreground}
  {title}>{name}</span
>

<style>
  /* Two theme tokens choose between the GitHub-style solid pill and a
   * tinted one. --color-label-fill is how much of the label color fills
   * the pill (100% = solid). --color-label-ink-mix is how much of the
   * contrast-picked ink the text keeps (100%); the remainder is the label
   * hue mixed toward --text-primary, which stays legible on a light tint
   * of any label color. The inset edge carries the hue on tinted pills and
   * disappears into a solid fill. */
  .kit-color-label {
    box-sizing: border-box;
    background-color: color-mix(
      in srgb,
      var(--kit-color-label-hue) var(--color-label-fill, 100%),
      var(--bg-surface)
    );
    color: color-mix(
      in srgb,
      var(--kit-color-label-ink) var(--color-label-ink-mix, 100%),
      color-mix(in srgb, var(--kit-color-label-hue) 35%, var(--text-primary))
    );
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kit-color-label-hue) 40%, transparent);
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    border-radius: 999px;
    font-weight: var(--font-weight-semibold, 600);
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
  }

  .kit-color-label--md {
    padding: 1px 8px;
    font-size: var(--font-size-xs);
  }

  .kit-color-label--sm {
    padding: 1px 6px;
    font-size: var(--font-size-2xs);
  }
</style>
