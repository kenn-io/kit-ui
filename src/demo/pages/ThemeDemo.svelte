<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { BREAKPOINTS, MEDIA } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const compact = new MediaQuery(MEDIA.compact);
  const medium = new MediaQuery(MEDIA.medium);
  const wide = new MediaQuery(MEDIA.wide);
  const touch = new MediaQuery(MEDIA.touch);

  const typeScale = [
    { token: "--font-size-2xs", desktop: "10px", compact: "12px" },
    { token: "--font-size-xs", desktop: "11px", compact: "14px" },
    { token: "--font-size-sm", desktop: "12px", compact: "15px" },
    { token: "--font-size-md", desktop: "13px", compact: "16px" },
    { token: "--font-size-lg", desktop: "14px", compact: "17px" },
    { token: "--font-size-xl", desktop: "18px", compact: "20px" },
    { token: "--font-size-2xl", desktop: "24px", compact: "28px" },
  ];

  const colorTokens = [
    "--bg-primary",
    "--bg-surface",
    "--bg-surface-hover",
    "--bg-inset",
    "--border-default",
    "--border-muted",
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--accent-blue",
    "--accent-amber",
    "--accent-purple",
    "--accent-green",
    "--accent-red",
    "--accent-teal",
    "--status-waiting",
  ];
</script>

<DemoSection
  title="Design tokens"
  description="Every component reads only these CSS variables (plus radii, shadows, and font sizes). Import theme.css once, toggle dark mode by adding the dark class to <html>, and retheme by overriding any variable."
  code={`import "@kenn-io/kit-ui/theme.css";

// dark mode
document.documentElement.classList.toggle("dark");`}
>
  <div class="swatches">
    {#each colorTokens as token (token)}
      <div class="swatch">
        <span class="swatch__chip" style:background="var({token})"></span>
        <code>{token}</code>
      </div>
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Breakpoints"
  description="Shared responsive breakpoints (formalized from middleman's mobile work). Use the pixel values in CSS @media rules and the MEDIA strings with svelte/reactivity's MediaQuery in code — kit-ui-check flags any other width. Resize this window to see the matches flip."
  code={`import { MediaQuery } from "svelte/reactivity";
import { BREAKPOINTS, MEDIA } from "@kenn-io/kit-ui";

const compact = new MediaQuery(MEDIA.compact); // compact.current is reactive

/* in CSS */
@media (max-width: 640px) { … }`}
>
  <table class="bp-table">
    <thead>
      <tr><th>name</th><th>query</th><th>matches now</th></tr>
    </thead>
    <tbody>
      <tr
        ><td><code>compact</code></td><td><code>≤ {BREAKPOINTS.compact}px</code></td><td
          >{compact.current ? "✓" : "—"}</td
        ></tr
      >
      <tr
        ><td><code>medium</code></td><td><code>≤ {BREAKPOINTS.medium}px</code></td><td
          >{medium.current ? "✓" : "—"}</td
        ></tr
      >
      <tr
        ><td><code>wide</code></td><td><code>≤ {BREAKPOINTS.wide}px</code></td><td
          >{wide.current ? "✓" : "—"}</td
        ></tr
      >
      <tr
        ><td><code>touch</code></td><td><code>{MEDIA.touch}</code></td><td
          >{touch.current ? "✓" : "—"}</td
        ></tr
      >
    </tbody>
  </table>
</DemoSection>

<DemoSection
  title="Typography"
  description="One rem-based scale (so text follows the user's browser font-size preference, not just zoom). The same tokens are redefined on handheld touch devices — keyed to pointer type, not viewport width, so narrowing a desktop window never resizes text. Components never write their own type media queries. See the Mobile preview page for it in action. Never pin html font-size; kit-ui-check flags it."
  code={`.title { font-size: var(--font-size-xl); }  /* 18px desktop, 20px on touch devices — automatically */`}
>
  <div class="type-scale">
    {#each typeScale as row (row.token)}
      <div class="type-row">
        <span class="type-sample" style:font-size="var({row.token})">Middleman</span>
        <code>{row.token}</code>
        <span class="type-values">{row.desktop} · {row.compact} touch</span>
      </div>
    {/each}
  </div>
</DemoSection>

<style>
  .bp-table {
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }

  .bp-table th,
  .bp-table td {
    text-align: left;
    padding: 4px 16px 4px 0;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-muted);
  }

  .bp-table th {
    color: var(--text-muted);
    font-weight: 600;
  }

  .type-scale {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .type-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
  }

  .type-sample {
    min-width: 160px;
    color: var(--text-primary);
  }

  .type-row code {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    min-width: 140px;
  }

  .type-values {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
    width: 100%;
  }

  .swatch {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .swatch__chip {
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-default);
    flex-shrink: 0;
  }
</style>
