<script lang="ts">
  import { SplitResizeHandle, type SplitResizeEvent } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let committedWidth = $state(200);
  let dragWidth = $state<number | null>(null);
  let startWidth = 0;
  const width = $derived(dragWidth ?? committedWidth);

  let committedHeight = $state(88);
  let dragHeight = $state<number | null>(null);
  let startHeight = 0;
  const height = $derived(dragHeight ?? committedHeight);

  function clampWidth(event: SplitResizeEvent): number {
    return Math.max(120, Math.min(400, startWidth + event.delta));
  }

  function clampHeight(event: SplitResizeEvent): number {
    return Math.max(56, Math.min(160, startHeight + event.delta));
  }
</script>

<DemoSection
  title="Split resize handle"
  description="A keyboard-accessible divider for horizontal or vertical pane layouts. Drag on the active axis, or focus it and press the matching arrow keys (24px steps). It only reports deltas; the panes own their dimensions."
  code={`<SplitResizeHandle
  ariaLabel="Resize left pane"
  orientation="horizontal"
  onResizeStart={() => (startWidth = width)}
  onResize={(e) => (dragWidth = clampWidth(e))}
  onResizeEnd={(e) => { committedWidth = clampWidth(e); dragWidth = null; }}
/>`}
>
  <div class="split-host split-host--horizontal" data-testid="horizontal-split">
    <div class="split-pane" style:width="{width}px">left · {width}px</div>
    <SplitResizeHandle
      ariaLabel="Resize left pane"
      orientation="horizontal"
      ariaValueMin={120}
      ariaValueMax={400}
      ariaValueNow={width}
      onResizeStart={() => (startWidth = width)}
      onResize={(e) => (dragWidth = clampWidth(e))}
      onResizeEnd={(e) => {
        committedWidth = clampWidth(e);
        dragWidth = null;
      }}
    />
    <div class="split-pane split-pane--rest">right</div>
  </div>

  <div class="split-host split-host--vertical" data-testid="vertical-split">
    <div class="split-pane" style:height="{height}px">top · {height}px</div>
    <SplitResizeHandle
      ariaLabel="Resize top pane"
      orientation="vertical"
      ariaValueMin={56}
      ariaValueMax={160}
      ariaValueNow={height}
      onResizeStart={() => (startHeight = height)}
      onResize={(e) => (dragHeight = clampHeight(e))}
      onResizeEnd={(e) => {
        committedHeight = clampHeight(e);
        dragHeight = null;
      }}
    />
    <div class="split-pane split-pane--rest">bottom</div>
  </div>
</DemoSection>

<style>
  .split-host {
    width: 100%;
    height: 180px;
    display: flex;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .split-host--horizontal {
    flex-direction: row;
  }

  .split-host--vertical {
    flex-direction: column;
    max-width: 320px;
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
