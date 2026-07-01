<script lang="ts">
  import { showFlash, VirtualList } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  interface Row {
    id: number;
    title: string;
    detail: string;
  }

  const rows: Row[] = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    title: `Session #${i}`,
    detail:
      i % 7 === 0
        ? "A longer variable-height row: this one wraps onto multiple lines to show measurement-based windowing keeping offsets correct while scrolling."
        : `worked on feature/branch-${i % 40} · ${(i * 37) % 90}m`,
  }));

  let active = $state(-1);
  let range = $state<[number, number]>([0, 0]);
  let list = $state<ReturnType<typeof VirtualList<Row>>>();
  let jump = $state(5000);
</script>

<DemoSection
  title="10,000 variable-height rows"
  description="Only the visible window (plus overscan) is in the DOM. Rows are measured as they render, so wrapped rows keep offsets correct. Focus the list and use ↑/↓/Home/End — keyboard state lives on the container, so recycling rows never drops focus. Enter or double-click activates."
  code={`<VirtualList {items} estimateHeight={36} bind:activeIndex onactivate={open} ariaLabel="Sessions">
  {#snippet row(item, index, isActive)}
    <div class="row">{item.title} — {item.detail}</div>
  {/snippet}
</VirtualList>

<!-- fixed-height fast path: -->
<VirtualList {items} itemHeight={32} … />`}
>
  <div class="controls">
    <label class="control">
      Jump to
      <input type="number" min="0" max="9999" bind:value={jump} />
    </label>
    <button
      class="jump-btn"
      type="button"
      onclick={() => list?.scrollToIndex(jump)}
    >
      scrollToIndex
    </button>
    <span class="control-note">
      rendered: <code>{range[0]}–{range[1]}</code>, active: <code>{active}</code>
    </span>
  </div>
  <div class="host">
    <VirtualList
      items={rows}
      estimateHeight={36}
      bind:activeIndex={active}
      bind:this={list}
      onactivate={(item) => showFlash(`Opened ${item.title}`)}
      onrangechange={(start, end) => (range = [start, end])}
      ariaLabel="Sessions"
    >
      {#snippet row(item, _index, isActive)}
        <div class="demo-row" class:is-active={isActive}>
          <span class="demo-row__title">{item.title}</span>
          <span class="demo-row__detail">{item.detail}</span>
        </div>
      {/snippet}
      {#snippet empty()}
        <p>No rows.</p>
      {/snippet}
    </VirtualList>
  </div>
</DemoSection>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
    width: 100%;
  }

  .control {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .control input {
    width: 80px;
    height: 24px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    padding: 0 var(--space-3);
  }

  .jump-btn {
    height: 24px;
    padding: 0 var(--space-4);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-inset);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .jump-btn:hover {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  .jump-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  .control-note {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .host {
    height: 360px;
    width: 100%;
    max-width: 560px;
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .demo-row {
    display: flex;
    flex-direction: column;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--border-muted);
    cursor: default;
  }

  .demo-row__title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
  }

  .demo-row__detail {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .demo-row.is-active .demo-row__title {
    color: var(--accent-blue);
  }
</style>
