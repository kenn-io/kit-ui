<script lang="ts">
  import { ScrollBox } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const lines = Array.from({ length: 60 }, (_, i) => `Log line ${i + 1}`);

  let viewport = $state<HTMLDivElement>();
  let scrollTop = $state(0);
</script>

<DemoSection
  title="Native vertical scroller"
  description="The browser and operating system render the vertical scrollbar and provide its native interactions. The viewport is also a labelled, focusable region, so keyboard users can scroll it with arrow keys."
  code={`<ScrollBox label="Activity feed" bind:viewport onscroll={handleScroll}>
  {#each lines as line}
    <p>{line}</p>
  {/each}
</ScrollBox>`}
>
  <div class="host">
    <ScrollBox
      label="Demo log"
      bind:viewport
      onscroll={() => (scrollTop = Math.round(viewport?.scrollTop ?? 0))}
    >
      {#each lines as line (line)}
        <p class="row">{line}</p>
      {/each}
    </ScrollBox>
  </div>
  <p class="note">scrollTop: <code data-test="scrolltop">{scrollTop}</code></p>
</DemoSection>

<DemoSection
  title="Content that fits"
  description="When the content is shorter than the viewport, the browser does not need to present a scrollbar."
>
  <div class="host host--short">
    <ScrollBox label="Short list">
      <p class="row">Only line</p>
    </ScrollBox>
  </div>
</DemoSection>

<style>
  .host {
    display: flex;
    flex-direction: column;
    height: 220px;
    width: 100%;
    max-width: 420px;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .host--short {
    height: 120px;
  }

  .row {
    margin: 0;
    padding: var(--space-2) var(--space-5);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-muted);
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
