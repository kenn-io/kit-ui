<script lang="ts">
  import { Checkbox, HARNESSES, HarnessMark } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let size = $state(20);
  let mono = $state(false);
</script>

<DemoSection
  title="Every harness"
  description="Wordmarks for the coding-agent harnesses agentsview knows about. Vector marks draw their neutral fills in currentColor so they follow the theme; typeset marks keep the brand colour from the docs."
  code={`<HarnessMark harness="claude-code" />
<HarnessMark harness="codex" size={16} />

{#each HARNESSES as { id } (id)}
  <HarnessMark harness={id} />
{/each}`}
>
  <div class="gallery" data-demo="harness-gallery">
    {#each HARNESSES as { id } (id)}
      <div class="gallery__cell">
        <HarnessMark harness={id} />
        <code class="gallery__id">{id}</code>
      </div>
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Size and mono"
  description="size sets the height in px and width follows the artwork. mono flattens brand colours (Claude's asterisk, Gemini's gradient, typeset colours) to the current text colour; the Forge raster is left as-is."
  code={`<HarnessMark harness="gemini" size={32} />
<HarnessMark harness="claude-code" mono />`}
>
  <div class="controls">
    <label class="controls__field">
      size
      <input type="range" min="12" max="48" step="1" bind:value={size} data-demo="harness-size" />
      <span>{size}px</span>
    </label>
    <span class="controls__field" data-demo="harness-mono">
      <Checkbox bind:checked={mono} label="mono" />
    </span>
  </div>
  <div class="row" data-demo="harness-sized">
    <HarnessMark harness="claude-code" {size} {mono} />
    <HarnessMark harness="codex" {size} {mono} />
    <HarnessMark harness="gemini" {size} {mono} />
    <HarnessMark harness="opencode" {size} {mono} />
    <HarnessMark harness="hermes" {size} {mono} />
    <HarnessMark harness="forge" {size} {mono} />
  </div>
</DemoSection>

<DemoSection
  title="Inline and muted"
  description="Marks sit on the text baseline and inherit colour, so a muted row dims them with it. Pass decorative when the surrounding text already names the harness."
  code={`<span class="muted">
  Session ran in <HarnessMark harness="cursor" size={14} decorative mono /> Cursor
</span>`}
>
  <p class="inline" data-demo="harness-inline">
    Session ran in <HarnessMark harness="cursor" size={14} decorative /> Cursor, then handed off to
    <HarnessMark harness="codex" size={14} decorative /> Codex.
  </p>
  <p class="inline inline--muted">
    <HarnessMark harness="claude-code" size={14} mono /> ·
    <HarnessMark harness="copilot" size={14} mono /> ·
    <HarnessMark harness="kimi" size={14} mono /> ·
    <HarnessMark harness="gemini" size={14} mono />
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
    min-width: 140px;
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
