<script lang="ts">
  import { overlayScrollbars, ScrollBox } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const lines = Array.from({ length: 60 }, (_, i) => `Log line ${i + 1}`);
  const wideLines = Array.from(
    { length: 40 },
    (_, i) =>
      `Row ${String(i + 1).padStart(2, "0")} — diff --git a/src/lib/components/ScrollBox.svelte b/src/lib/components/ScrollBox.svelte (column-spanning content to exercise horizontal and vertical overlay thumbs)`,
  );

  let viewport = $state<HTMLDivElement>();
  let scrollTop = $state(0);
  let stickyHeaderEl = $state<HTMLDivElement>();
  let customHostEl = $state<HTMLDivElement>();
</script>

<DemoSection
  title="Overlay vertical scroller"
  description="ScrollBox hides the native scrollbar so scrolling takes 0px of layout gutter, and renders floating overlay thumbs that appear on hover or scroll, support pointer drag and track click, and stay clear of rounded corners. The viewport remains a labelled focusable region for keyboard scrolling."
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
  title="Two-axis scrolling with sticky header clearance"
  description="Pass axis=&quot;both&quot; for wide panes such as diff views or logs, and insetTop for sticky headers so the vertical thumb starts cleanly below the header."
  code={`<ScrollBox label="Diff preview" axis="both" insetTop={() => headerEl}>
  <div class="sticky-head" bind:this={headerEl}>Sticky header</div>
  {#each rows as row}
    <pre>{row}</pre>
  {/each}
</ScrollBox>`}
>
  <div class="host host--wide">
    <ScrollBox label="Sticky diff preview" axis="both" insetTop={stickyHeaderEl}>
      <div class="sticky-head" bind:this={stickyHeaderEl}>Sticky header</div>
      {#each wideLines as line (line)}
        <div class="wide-row">{line}</div>
      {/each}
    </ScrollBox>
  </div>
</DemoSection>

<DemoSection
  title="Custom container attachment"
  description="Attach overlayScrollbars() directly to any page scroller, sidebar, or custom panel without hand-rolling scrollbar chrome. Pass host when an outer non-scrolling frame exists."
  code={`<div class="frame" bind:this={hostEl}>
  <div class="scroller" {@attach overlayScrollbars({ axis: "y", host: () => hostEl })}>
    …
  </div>
</div>`}
>
  <div class="host" bind:this={customHostEl}>
    <div
      class="custom-scroller"
      data-test="attached-scroller"
      {@attach overlayScrollbars({ axis: "y", host: customHostEl })}
    >
      {#each lines.slice(0, 30) as line (line)}
        <p class="row">{line}</p>
      {/each}
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Content that fits"
  description="When the content fits inside the viewport, no overlay thumb is shown."
>
  <div class="host host--short">
    <ScrollBox label="Short list">
      <p class="row">Only line</p>
    </ScrollBox>
  </div>
</DemoSection>

<style>
  .host {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 220px;
    width: 100%;
    max-width: 420px;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .host--wide {
    max-width: 520px;
  }

  .host--short {
    height: 120px;
  }

  .custom-scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .sticky-head {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: var(--space-3) var(--space-5);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
    background: var(--bg-inset);
    border-bottom: 1px solid var(--border-default);
  }

  .row {
    margin: 0;
    padding: var(--space-2) var(--space-5);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-muted);
  }

  .wide-row {
    padding: var(--space-2) var(--space-5);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    white-space: nowrap;
    border-bottom: 1px solid var(--border-muted);
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
