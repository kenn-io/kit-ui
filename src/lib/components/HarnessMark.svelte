<script lang="ts">
  import claudeCode from "../assets/harness/claude-code.svg?raw";
  import codex from "../assets/harness/codex.svg?raw";
  import copilot from "../assets/harness/copilot.svg?raw";
  import cursor from "../assets/harness/cursor.svg?raw";
  import forge from "../assets/harness/forge.png?inline";
  import gemini from "../assets/harness/gemini.svg?raw";
  import opencode from "../assets/harness/opencode.svg?raw";
  import { harnessInfo, type HarnessId } from "./harness-mark.js";

  interface Props {
    harness: HarnessId;
    /** Accessible name; defaults to the harness display name. */
    label?: string;
    /** Hide from assistive tech when adjacent text already names the harness. */
    decorative?: boolean;
    /**
     * Mark height in px; width follows the artwork's aspect ratio. The root
     * box is exactly this tall; artwork with an optical correction (see
     * `HarnessInfo.opticalScale`) overflows it evenly on both sides.
     */
    size?: number;
    /** Flatten brand colours to the current text colour (raster marks are unaffected). */
    mono?: boolean;
    class?: string;
  }

  let {
    harness,
    label = undefined,
    decorative = false,
    size = 20,
    mono = false,
    class: className = "",
  }: Props = $props();

  // Vector wordmarks are bundled as markup so their brand-neutral fills can
  // use currentColor and follow the theme; nothing here is user-supplied.
  const VECTOR: Partial<Record<HarnessId, string>> = {
    "claude-code": claudeCode,
    codex,
    copilot,
    cursor,
    gemini,
    opencode,
  };
  const RASTER: Partial<Record<HarnessId, string>> = { forge };

  const info = $derived(harnessInfo(harness));
  const svg = $derived(VECTOR[harness]);
  const image = $derived(RASTER[harness]);
  const name = $derived(label ?? info.label);
  const scale = $derived(info.opticalScale ?? 1);
  const classes = $derived(
    [
      "kit-harness-mark",
      `kit-harness-mark--${harness}`,
      mono && "kit-harness-mark--mono",
      className,
    ]
      .filter(Boolean)
      .join(" "),
  );
</script>

<span
  class={classes}
  style:--harness-mark-size={`${size}px`}
  style:--harness-mark-scale={scale}
  role={decorative ? undefined : "img"}
  aria-label={decorative ? undefined : name}
  aria-hidden={decorative ? true : undefined}
>
  {#if svg}
    {@html svg}
  {:else if image}
    <img src={image} alt="" aria-hidden="true" />
  {:else}
    <span class="kit-harness-mark__text" style:color={mono ? undefined : info.color}>
      {info.label}
    </span>
  {/if}
</span>

<style>
  .kit-harness-mark {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    height: var(--harness-mark-size);
    vertical-align: middle;
    line-height: 1;
    color: inherit;
    overflow: visible;
  }

  /* Optically corrected artwork is drawn taller than the root box and
     centred on it, so rows and inline text keep a stable line box. */
  .kit-harness-mark :global(svg),
  .kit-harness-mark img {
    display: block;
    height: calc(var(--harness-mark-size) * var(--harness-mark-scale, 1));
    width: auto;
    flex: 0 0 auto;
  }

  /* Typeset wordmarks size with the mark (px, like an icon), not with the
     app's type scale — they stand in for artwork, not for UI copy. */
  .kit-harness-mark__text {
    font-family: inherit;
    font-size: var(--harness-mark-size);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .kit-harness-mark--mono :global(svg path),
  .kit-harness-mark--mono :global(.kit-harness-mark__gemini-fill) {
    fill: currentColor;
  }
</style>
