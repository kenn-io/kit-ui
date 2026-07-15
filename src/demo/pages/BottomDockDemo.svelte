<script lang="ts">
  import {
    BottomDock,
    Button,
    SegmentedControl,
    type SegmentedControlOption,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  type DockTab = "review" | "log" | "prompt";

  const tabs: SegmentedControlOption[] = [
    { value: "review", label: "Review" },
    { value: "log", label: "Log" },
    { value: "prompt", label: "Prompt" },
  ];
  const bodyItems = Array.from({ length: 20 }, (_, index) => index + 1);

  let open = $state(true);
  let activeTab = $state<DockTab>("review");
</script>

<DemoSection
  title="Bottom dock"
  description="A controlled inline panel that keeps surrounding workspace chrome visible. Resize from the top edge with the pointer or Up/Down keys; Escape remains available to the parent application."
  code={`<BottomDock
  {open}
  ariaLabel="Review details"
  initialHeight="260px"
  minHeight="180px"
  maxHeight="360px"
  onclose={() => (open = false)}
>
  {#snippet header()}...{/snippet}
  ...
</BottomDock>`}
>
  <div class="dock-controls">
    {#if !open}
      <Button label="Open dock" onclick={() => (open = true)} />
    {/if}
  </div>

  <div class="workspace-surface">
    <div class="workspace-content">
      <strong>Workspace content</strong>
      <span>The dock occupies layout space instead of covering this area.</span>
    </div>

    <BottomDock
      {open}
      ariaLabel="Review details"
      initialHeight="260px"
      minHeight="180px"
      maxHeight="360px"
      onclose={() => (open = false)}
    >
      {#snippet header()}
        <div class="dock-header-content">
          <div class="dock-title-row">
            <strong>Review #42</strong>
            <span class="dock-status">running</span>
          </div>
          <SegmentedControl
            options={tabs}
            value={activeTab}
            onchange={(value) => (activeTab = value as DockTab)}
            ariaLabel="Review detail view"
            variant="borderless"
          />
        </div>
      {/snippet}

      <div class="review-body" data-active-tab={activeTab}>
        {#each bodyItems as item (item)}
          <div class="review-row">Review body item {item}</div>
        {/each}
      </div>

      {#snippet footer()}
        <span class="dock-ready">Ready to merge</span>
        <div class="dock-actions">
          <Button size="sm" label="Rerun" />
          <Button size="sm" tone="danger" label="Cancel" />
        </div>
      {/snippet}
    </BottomDock>
  </div>
</DemoSection>

<style>
  .dock-controls {
    min-height: 28px;
    display: flex;
    align-items: center;
  }

  .workspace-surface {
    height: 520px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
  }

  .workspace-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .dock-header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .dock-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }

  .dock-status {
    padding: var(--space-1) var(--space-3);
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium, 500);
  }

  .review-body {
    display: flex;
    flex-direction: column;
  }

  .review-row {
    padding: var(--space-4) var(--space-6);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    border-bottom: var(--border-width) solid var(--border-muted);
  }

  .dock-ready {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .dock-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
</style>
