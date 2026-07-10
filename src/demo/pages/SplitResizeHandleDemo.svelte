<script lang="ts">
  import { SplitResizeHandle, type SplitResizeEvent } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let committed = $state(200);
  let drag = $state<number | null>(null);
  let startWidth = 0;
  const width = $derived(drag ?? committed);

  function clampWidth(event: SplitResizeEvent): number {
    return Math.max(120, Math.min(400, startWidth + event.deltaX));
  }
</script>

<DemoSection
  title="Split resize handle"
  description="A keyboard-accessible divider: drag with the mouse or focus it and press arrow keys (24px steps). It only reports deltas — the panes own their widths."
  code={`<SplitResizeHandle
  ariaLabel="Resize left pane"
  onResizeStart={() => (startWidth = width)}
  onResize={(e) => (drag = clampWidth(e))}
  onResizeEnd={(e) => { committed = clampWidth(e); drag = null; }}
/>`}
>
  <div class="split-host">
    <div class="split-pane" style:width="{width}px">left · {width}px</div>
    <SplitResizeHandle
      ariaLabel="Resize left pane"
      onResizeStart={() => (startWidth = width)}
      onResize={(e) => (drag = clampWidth(e))}
      onResizeEnd={(e) => {
        committed = clampWidth(e);
        drag = null;
      }}
    />
    <div class="split-pane split-pane--rest">right</div>
  </div>
</DemoSection>

<style>
  .split-host {
    width: 100%;
    height: 120px;
    display: flex;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .split-pane {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .split-pane--rest {
    flex: 1;
    background: var(--bg-primary);
  }
</style>
