<script module lang="ts">
  export type ColorLabelSize = "sm" | "md";

  /* Candidate text colors: GitHub's label ink and plain white. Raw hex is
   * intentional — these feed the WCAG contrast math against an arbitrary
   * caller-supplied background, so they can't be theme tokens. */
  const DARK_TEXT_COLOR = "#1f2328";
  const WHITE_TEXT_COLOR = "#ffffff";
  const FALLBACK_BACKGROUND = "#6e7781";

  /** Expands/validates a hex color (with or without `#`, 3 or 6 digits).
   * Invalid input falls back to a neutral gray. */
  function normalizeColor(color: string): string {
    const hex = color.trim().replace(/^#/, "");

    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return `#${hex
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
        .toLowerCase()}`;
    }

    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return `#${hex.toLowerCase()}`;
    }

    return FALLBACK_BACKGROUND;
  }

  /** WCAG relative luminance of a normalized `#rrggbb` color. */
  function luminance(normalizedHex: string): number {
    const hex = normalizedHex.slice(1);

    const channel = (value: number): number => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    return (
      0.2126 * channel(Number.parseInt(hex.slice(0, 2), 16)) +
      0.7152 * channel(Number.parseInt(hex.slice(2, 4), 16)) +
      0.0722 * channel(Number.parseInt(hex.slice(4, 6), 16))
    );
  }

  /** Picks dark or white text, whichever has the higher WCAG contrast
   * ratio against the (normalized) background. */
  function textColor(normalizedBackground: string): string {
    const bg = luminance(normalizedBackground);

    const contrastRatio = (foreground: string): number => {
      const fg = luminance(foreground);
      const lighter = Math.max(bg, fg);
      const darker = Math.min(bg, fg);
      return (lighter + 0.05) / (darker + 0.05);
    };

    return contrastRatio(DARK_TEXT_COLOR) >= contrastRatio(WHITE_TEXT_COLOR)
      ? DARK_TEXT_COLOR
      : WHITE_TEXT_COLOR;
  }
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

  let {
    name,
    color,
    size = "md",
    title = undefined,
    class: className = "",
  }: Props = $props();

  const background = $derived(normalizeColor(color));
  const foreground = $derived(textColor(background));
</script>

<span
  class={["kit-color-label", `kit-color-label--${size}`, className]}
  style:background-color={background}
  style:color={foreground}
  {title}
>{name}</span>

<style>
  .kit-color-label {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    border-radius: 999px;
    font-weight: 600;
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
