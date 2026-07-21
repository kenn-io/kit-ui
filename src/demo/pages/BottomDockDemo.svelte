<script lang="ts">
  import {
    BottomDock,
    Button,
    SegmentedControl,
    setThemeName,
    type SegmentedControlOption,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  type DockTab = "review" | "log" | "prompt";
  type LimitMode = "pixels" | "container" | "viewport" | "theme";

  const tabs: SegmentedControlOption[] = [
    { value: "review", label: "Review" },
    { value: "log", label: "Log" },
    { value: "prompt", label: "Prompt" },
  ];
  const bodyItems = Array.from({ length: 20 }, (_, index) => index + 1);

  let open = $state(true);
  let activeTab = $state<DockTab>("review");
  let initialHeight = $state("260px");
  let limitMode = $state<LimitMode>("pixels");
  let workspaceTall = $state(false);
  let controlledOpen = $state(true);
  let controlledHeight = $state("240px");
  let lastRequestedHeight = $state("");

  function applyLastRequestedHeight(): void {
    if (lastRequestedHeight) controlledHeight = lastRequestedHeight;
  }
  const minHeight = $derived(
    limitMode === "container"
      ? "25%"
      : limitMode === "viewport"
        ? "20vh"
        : limitMode === "theme"
          ? "var(--kit-demo-dock-min-height)"
          : "180px",
  );
  const maxHeight = $derived(
    limitMode === "container"
      ? "calc(75% - 10px)"
      : limitMode === "viewport"
        ? "80vh"
        : limitMode === "theme"
          ? "var(--kit-demo-dock-max-height)"
          : "360px",
  );
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
    <Button label="Use container limits" onclick={() => (limitMode = "container")} />
    <Button label="Use viewport limits" onclick={() => (limitMode = "viewport")} />
    <Button label="Use theme variable limits" onclick={() => (limitMode = "theme")} />
    <Button label="Switch dock limit theme" onclick={() => setThemeName("control-room")} />
    <Button label="Make workspace taller" onclick={() => (workspaceTall = true)} />
    <Button label="Set initial height to 300px" onclick={() => (initialHeight = "300px")} />
    {#if !open}
      <Button label="Open dock" onclick={() => (open = true)} />
    {/if}
  </div>

  <div class="workspace-surface">
    <div class="workspace-content">
      <strong>Workspace content</strong>
      <span>The dock occupies layout space instead of covering this area.</span>
      <span
        class={["dock-size-signal", workspaceTall && "dock-size-signal--tall"]}
        aria-hidden="true"
      ></span>
    </div>

    <div class="dock-layout-context">
      <BottomDock
        {open}
        ariaLabel="Review details"
        {initialHeight}
        {minHeight}
        {maxHeight}
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
  </div>
</DemoSection>

<DemoSection
  title="Controlled height"
  description="Pass height to make the parent own the dock's size — the dock renders exactly that value. User resizes (pointer or keyboard) call onHeightChange with the requested height instead of applying it; the parent decides whether and when to adopt it."
  code={`let height = $state("240px");
let lastRequested = $state("");

<BottomDock
  {open}
  ariaLabel="Controlled dock"
  {height}
  onHeightChange={(next) => (lastRequested = next)}
  onclose={() => (open = false)}
>
  ...
</BottomDock>`}
>
  <div class="dock-controls">
    <Button label="Set height to 400px" onclick={() => (controlledHeight = "400px")} />
    <Button label="Apply last requested height" onclick={applyLastRequestedHeight} />
    {#if !controlledOpen}
      <Button label="Open controlled dock" onclick={() => (controlledOpen = true)} />
    {/if}
  </div>
  <p class="dock-status-line">
    Last requested height:
    <code data-testid="controlled-last-requested">{lastRequestedHeight || "none"}</code>
  </p>

  <div class="controlled-workspace-surface">
    <div class="workspace-content">
      <strong>Controlled workspace</strong>
      <span>The parent owns this dock's height.</span>
    </div>

    <div class="dock-layout-context">
      <BottomDock
        open={controlledOpen}
        ariaLabel="Controlled dock"
        height={controlledHeight}
        minHeight="150px"
        maxHeight="450px"
        onHeightChange={(next) => (lastRequestedHeight = next)}
        onclose={() => (controlledOpen = false)}
      >
        {#snippet header()}
          <strong>Controlled review</strong>
        {/snippet}

        <div class="review-body">
          {#each bodyItems as item (item)}
            <div class="review-row">Controlled body item {item}</div>
          {/each}
        </div>
      </BottomDock>
    </div>
  </div>
</DemoSection>

<style>
  :global(:root) {
    --kit-demo-dock-min-height: 150px;
    --kit-demo-dock-max-height: 390px;
  }

  :global(:root[data-kit-theme="control-room"]) {
    --kit-demo-dock-min-height: 190px;
    --kit-demo-dock-max-height: 430px;
  }

  .dock-controls {
    min-height: 28px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .dock-status-line {
    margin: var(--space-3) 0 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .workspace-surface,
  .controlled-workspace-surface {
    height: 520px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
  }

  .workspace-surface:has(.dock-size-signal--tall) {
    height: 600px;
  }

  .dock-size-signal {
    display: none;
  }

  .dock-layout-context {
    display: contents;
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
