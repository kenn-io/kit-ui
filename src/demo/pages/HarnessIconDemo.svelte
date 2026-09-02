<script lang="ts">
  import { HARNESS_ICONS, HarnessIcon } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let size = $state(24);
</script>

<DemoSection
  title="Every harness"
  description="One monochrome glyph per coding-agent harness, painted in currentColor so it follows the theme like a lucide icon."
  code={`<HarnessIcon harness="claude" />
<HarnessIcon harness="openai" size={20} />

{#each HARNESS_ICONS as { id } (id)}
  <HarnessIcon harness={id} />
{/each}`}
>
  <div class="gallery" data-demo="harness-icon-gallery">
    {#each HARNESS_ICONS as { id } (id)}
      <div class="gallery__cell">
        <HarnessIcon harness={id} size={24} />
        <code class="gallery__id">{id}</code>
      </div>
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Size"
  description="size sets both dimensions in px; every glyph is square."
  code={`<HarnessIcon harness="gemini" size={32} />`}
>
  <div class="controls">
    <label class="controls__field">
      size
      <input
        type="range"
        min="12"
        max="48"
        step="1"
        bind:value={size}
        data-demo="harness-icon-size"
      />
      <span>{size}px</span>
    </label>
  </div>
  <div class="row" data-demo="harness-icon-sized">
    <HarnessIcon harness="claude" {size} />
    <HarnessIcon harness="openai" {size} />
    <HarnessIcon harness="gemini" {size} />
    <HarnessIcon harness="opencode" {size} />
    <HarnessIcon harness="hermes" {size} />
    <HarnessIcon harness="forge" {size} />
  </div>
</DemoSection>

<DemoSection
  title="Inline and muted"
  description="Icons sit on the text baseline and inherit colour, so a muted row dims them with it. Pass decorative when the surrounding text already names the harness."
  code={`<span class="muted">
  Session ran in <HarnessIcon harness="cursor" size={14} decorative /> Cursor
</span>`}
>
  <p class="inline" data-demo="harness-icon-inline">
    Session ran in <HarnessIcon harness="cursor" size={14} decorative /> Cursor, then handed off to
    <HarnessIcon harness="openai" size={14} decorative /> Codex.
  </p>
  <p class="inline inline--muted">
    <HarnessIcon harness="claude" size={14} /> ·
    <HarnessIcon harness="copilot" size={14} /> ·
    <HarnessIcon harness="kimi" size={14} /> ·
    <HarnessIcon harness="gemini" size={14} />
  </p>
</DemoSection>

<style>
  .gallery {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .gallery__cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    min-width: 120px;
    padding: var(--space-3);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
  }

  .gallery__id {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .controls__field {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-5);
  }

  .inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-3);
  }

  .inline--muted {
    color: var(--text-muted);
  }
</style>
