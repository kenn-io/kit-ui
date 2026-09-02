<script lang="ts">
  import claude from "../assets/harness-icons/claude.svg?raw";
  import openai from "../assets/harness-icons/openai.svg?raw";
  import gemini from "../assets/harness-icons/gemini.svg?raw";
  import copilot from "../assets/harness-icons/copilot.svg?raw";
  import vscode from "../assets/harness-icons/vscode.svg?raw";
  import visualstudio from "../assets/harness-icons/visualstudio.svg?raw";
  import cursor from "../assets/harness-icons/cursor.svg?raw";
  import warp from "../assets/harness-icons/warp.svg?raw";
  import qwen from "../assets/harness-icons/qwen.svg?raw";
  import deepseek from "../assets/harness-icons/deepseek.svg?raw";
  import mistral from "../assets/harness-icons/mistral.svg?raw";
  import zed from "../assets/harness-icons/zed.svg?raw";
  import posit from "../assets/harness-icons/posit.svg?raw";
  import sourcegraph from "../assets/harness-icons/sourcegraph.svg?raw";
  import opencode from "../assets/harness-icons/opencode.svg?raw";
  import antigravity from "../assets/harness-icons/antigravity.svg?raw";
  import kilo from "../assets/harness-icons/kilo.svg?raw";
  import kimi from "../assets/harness-icons/kimi.svg?raw";
  import kiro from "../assets/harness-icons/kiro.svg?raw";
  import openhands from "../assets/harness-icons/openhands.svg?raw";
  import zencoder from "../assets/harness-icons/zencoder.svg?raw";
  import snowflake from "../assets/harness-icons/snowflake.svg?raw";
  import goose from "../assets/harness-icons/goose.svg?raw";
  import grok from "../assets/harness-icons/grok.svg?raw";
  import hermes from "../assets/harness-icons/hermes.svg?raw";
  import xiaomi from "../assets/harness-icons/xiaomi.svg?raw";
  import openclaw from "../assets/harness-icons/openclaw.svg?raw";
  import pi from "../assets/harness-icons/pi.svg?raw";
  import poolside from "../assets/harness-icons/poolside.svg?raw";
  import qoder from "../assets/harness-icons/qoder.svg?raw";
  import roocode from "../assets/harness-icons/roocode.svg?raw";
  import trae from "../assets/harness-icons/trae.svg?raw";
  import aider from "../assets/harness-icons/aider.svg?raw";
  import gptme from "../assets/harness-icons/gptme.svg?raw";
  import omnigent from "../assets/harness-icons/omnigent.svg?raw";
  import zai from "../assets/harness-icons/zai.svg?raw";
  import commandcode from "../assets/harness-icons/commandcode.svg?raw";
  import codebuff from "../assets/harness-icons/codebuff.svg?raw";
  import forge from "../assets/harness-icons/forge.svg?raw";
  import iflow from "../assets/harness-icons/iflow.svg?raw";
  import omp from "../assets/harness-icons/omp.svg?raw";
  import prime from "../assets/harness-icons/prime.svg?raw";
  import piebald from "../assets/harness-icons/piebald.svg?raw";
  import tencent from "../assets/harness-icons/tencent.svg?raw";
  import reasonix from "../assets/harness-icons/reasonix.svg?raw";
  import shelley from "../assets/harness-icons/shelley.svg?raw";
  import workbuddy from "../assets/harness-icons/workbuddy.svg?raw";
  import windsurf from "../assets/harness-icons/windsurf.svg?raw";
  import devin from "../assets/harness-icons/devin.svg?raw";
  import { harnessIconInfo, type HarnessIconId } from "./harness-icon.js";

  interface Props {
    harness: HarnessIconId;
    /** Accessible name; defaults to the harness brand name. */
    label?: string;
    /** Hide from assistive tech when adjacent text already names the harness. */
    decorative?: boolean;
    /** Icon size in px; every glyph is square. */
    size?: number;
    class?: string;
  }

  let {
    harness,
    label = undefined,
    decorative = false,
    size = 16,
    class: className = "",
  }: Props = $props();

  // Glyphs are bundled as markup so they paint in currentColor and follow the
  // theme like a lucide icon would; nothing here is user-supplied.
  const GLYPHS: Record<HarnessIconId, string> = {
    claude,
    openai,
    gemini,
    copilot,
    vscode,
    visualstudio,
    cursor,
    warp,
    qwen,
    deepseek,
    mistral,
    zed,
    posit,
    sourcegraph,
    opencode,
    antigravity,
    kilo,
    kimi,
    kiro,
    openhands,
    zencoder,
    snowflake,
    goose,
    grok,
    hermes,
    xiaomi,
    openclaw,
    pi,
    poolside,
    qoder,
    roocode,
    trae,
    aider,
    gptme,
    omnigent,
    zai,
    commandcode,
    codebuff,
    forge,
    iflow,
    omp,
    prime,
    piebald,
    tencent,
    reasonix,
    shelley,
    workbuddy,
    windsurf,
    devin,
  };

  const info = $derived(harnessIconInfo(harness));
  const svg = $derived(GLYPHS[harness]);
  const name = $derived(label ?? info.label);
  const classes = $derived(
    ["kit-harness-icon", `kit-harness-icon--${harness}`, className].filter(Boolean).join(" "),
  );
</script>

<span
  class={classes}
  style:--harness-icon-size={`${size}px`}
  role={decorative ? undefined : "img"}
  aria-label={decorative ? undefined : name}
  aria-hidden={decorative ? true : undefined}
>
  {@html svg}
</span>

<style>
  .kit-harness-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: var(--harness-icon-size);
    height: var(--harness-icon-size);
    vertical-align: middle;
    line-height: 1;
    color: inherit;
  }

  /* The sprite draws every glyph without a fill so the page colours it; the
     two stroked glyphs carry their own stroke="currentColor". */
  .kit-harness-icon :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
</style>
