<script lang="ts">
  import DownloadIcon from "@lucide/svelte/icons/download";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import {
    AdaptiveActionGrid,
    Button,
    FilterDropdown,
    IconButton,
    SegmentedControl,
    SelectDropdown,
    TextInput,
    showFlash,
    type AdaptiveActionGridFrame,
    type AdaptiveActionGridItem,
    type AdaptiveActionGridMode,
    type AdaptiveActionGridRadius,
    type AdaptiveActionGridSpace,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let paneWidth = $state(860);
  let mode = $state<AdaptiveActionGridMode>("row");
  let open = $state(false);
  let view = $state("all");
  let projectActive = $state(false);
  let modelActive = $state(false);
  let conciseLabels = $state(false);
  let longFilterLabel = $state(false);
  let archiveIncluded = $state(false);
  let reverseItems = $state(false);
  let requiredQuery = $state("");
  let validationOpen = $state(false);
  let frame = $state<AdaptiveActionGridFrame>("none");
  let radius = $state<AdaptiveActionGridRadius>("md");
  let itemRadius = $state<AdaptiveActionGridRadius>("sm");
  let rowGap = $state<AdaptiveActionGridSpace>(3);
  let columnGap = $state<AdaptiveActionGridSpace>(3);
  let padding = $state<AdaptiveActionGridSpace>(0);
  let filledWidth = $state(700);
  let filledFive = $state(false);

  const filledItems = $derived.by(() => {
    const next: AdaptiveActionGridItem[] = [
      { id: "approve", content: filledApprove },
      { id: "merge", content: filledMerge },
      { id: "close", content: filledClose },
      { id: "workspace", content: filledWorkspace },
    ];
    if (filledFive) next.push({ id: "labels", content: filledLabels });
    return next;
  });

  const activeFilters = $derived(Number(projectActive) + Number(modelActive));
  const actionItems = $derived.by(() => {
    const next: AdaptiveActionGridItem[] = [
      { id: "state", content: stateSelector },
      { id: "project", content: projectFilter },
      { id: "model", content: modelFilter },
      { id: "refresh", content: refreshAction },
      { id: "export", content: exportAction },
      { id: "settings", content: settingsAction },
    ];
    if (archiveIncluded) next.push({ id: "archive", content: archiveAction });
    return reverseItems ? next.reverse() : next;
  });

  const frameOptions = [
    { value: "none", label: "None" },
    { value: "outline", label: "Outline" },
  ];

  const radiusOptions = [
    { value: "none", label: "Square" },
    { value: "sm", label: "Small radius" },
    { value: "md", label: "Medium radius" },
    { value: "lg", label: "Large radius" },
    { value: "pill", label: "Pill" },
  ];

  const spaceLabels = ["0px", "2px", "4px", "6px", "8px", "12px", "16px", "24px", "32px"];

  function notify(message: string): void {
    showFlash(message);
  }
</script>

{#snippet filledApprove()}
  <Button label="Approve" tone="success" surface="soft" />
{/snippet}

{#snippet filledMerge()}
  <Button label="Squash and merge" tone="success" surface="solid" />
{/snippet}

{#snippet filledClose()}
  <Button label="Close" tone="danger" surface="outline" />
{/snippet}

{#snippet filledWorkspace()}
  <Button label="Create Workspace" tone="info" surface="soft" />
{/snippet}

{#snippet filledLabels()}
  <Button label="Labels" />
{/snippet}

{#snippet stateSelector()}
  <SegmentedControl
    options={[
      { value: "all", label: conciseLabels ? "Any" : "All" },
      { value: "open", label: conciseLabels ? "On" : "Open" },
      { value: "closed", label: conciseLabels ? "Off" : "Closed" },
    ]}
    value={view}
    onchange={(next) => (view = next)}
    ariaLabel="Result state"
    variant="borderless"
  />
{/snippet}

{#snippet projectFilter()}
  <FilterDropdown
    label={longFilterLabel
      ? "Project assignment across every connected workspace"
      : conciseLabels
        ? "Repo"
        : "Project"}
    active={projectActive}
    badgeCount={projectActive ? 1 : 0}
    sections={[
      {
        items: [
          {
            id: "kit-ui",
            label: "kit-ui",
            active: projectActive,
            onSelect: () => (projectActive = !projectActive),
          },
        ],
      },
    ]}
  />
{/snippet}

{#snippet modelFilter()}
  <FilterDropdown
    label={conciseLabels ? "AI" : "Model"}
    active={modelActive}
    badgeCount={modelActive ? 1 : 0}
    sections={[
      {
        items: [
          {
            id: "fable",
            label: "Fable",
            active: modelActive,
            onSelect: () => (modelActive = !modelActive),
          },
        ],
      },
    ]}
  />
{/snippet}

{#snippet refreshAction()}
  <Button
    label={conciseLabels ? "Sync" : "Refresh"}
    tone="success"
    surface="soft"
    onclick={() => notify("Refreshed results")}
  >
    <RefreshCwIcon size={13} strokeWidth={2} aria-hidden="true" />
  </Button>
{/snippet}

{#snippet exportAction()}
  <Button
    label={conciseLabels ? "CSV" : "Export CSV"}
    tone="info"
    surface="solid"
    onclick={() => notify("Export started")}
  >
    <DownloadIcon size={13} strokeWidth={2} aria-hidden="true" />
  </Button>
{/snippet}

{#snippet settingsAction()}
  <IconButton
    ariaLabel="View settings"
    tone="workflow"
    onclick={() => notify("Opened view settings")}
  >
    <Settings2Icon size={14} strokeWidth={2} aria-hidden="true" />
  </IconButton>
{/snippet}

{#snippet archiveAction()}
  <Button
    label="Archive selected results"
    tone="workflow"
    surface="soft"
    onclick={() => notify("Archived selected results")}
  />
{/snippet}

{#snippet requiredQueryAction()}
  <TextInput
    bind:value={requiredQuery}
    name="query"
    ariaLabel="Required query"
    placeholder="Required query"
    required
  />
{/snippet}

{#snippet savedQueryAction()}
  <Button label="Use saved query" onclick={() => (requiredQuery = "is:open")} />
{/snippet}

{#snippet compactSummary()}
  <span>{activeFilters} active</span>
{/snippet}

<DemoSection
  title="Container-aware actions"
  description="The same controls move from a row to an equal-track grid, then into an inline disclosure. Drag the width and change the geometry."
  code={`<AdaptiveActionGrid
  items={[
    { id: "state", content: stateSelector },
    { id: "project", content: projectFilter },
    { id: "model", content: modelFilter },
    { id: "refresh", content: refreshAction },
    { id: "export", content: exportAction },
  ]}
  ariaLabel="Result controls"
  onmodechange={(next) => (mode = next)}
  bind:open
  frame="none"
  radius="md"
  itemRadius="sm"
  rowGap={3}
  columnGap={3}
  padding={0}
/>

{#snippet refreshAction()}
  <Button label="Refresh" tone="success" surface="soft">
    <RefreshCwIcon />
  </Button>
{/snippet}

{#snippet exportAction()}
  <Button label="Export CSV" tone="info" surface="solid">
    <DownloadIcon />
  </Button>
{/snippet}

<!-- Joined mobile preset -->
<AdaptiveActionGrid
  {items}
  rowGap={0}
  columnGap={0}
  padding={0}
  itemRadius="none"
/>`}
>
  <div class="demo-controls">
    <label class="parameter-control parameter-control--wide">
      <span>Preview width <output>{paneWidth}px</output></span>
      <input type="range" min="300" max="900" bind:value={paneWidth} />
    </label>
    <div class="parameter-control">
      <span>Outer frame</span>
      <SelectDropdown
        value={frame}
        options={frameOptions}
        onchange={(next) => (frame = next as AdaptiveActionGridFrame)}
        title="Outer frame"
      />
    </div>
    <div class="parameter-control">
      <span>Outer corners</span>
      <SelectDropdown
        value={radius}
        options={radiusOptions}
        onchange={(next) => (radius = next as AdaptiveActionGridRadius)}
        title="Outer corner radius"
      />
    </div>
    <div class="parameter-control">
      <span>Item corners</span>
      <SelectDropdown
        value={itemRadius}
        options={radiusOptions}
        onchange={(next) => (itemRadius = next as AdaptiveActionGridRadius)}
        title="Item corner radius"
      />
    </div>
    <label class="parameter-control">
      <span>Row gap <output>{spaceLabels[rowGap]}</output></span>
      <input type="range" min="0" max="8" step="1" bind:value={rowGap} />
    </label>
    <label class="parameter-control">
      <span>Column gap <output>{spaceLabels[columnGap]}</output></span>
      <input type="range" min="0" max="8" step="1" bind:value={columnGap} />
    </label>
    <label class="parameter-control">
      <span>Outer padding <output>{spaceLabels[padding]}</output></span>
      <input type="range" min="0" max="8" step="1" bind:value={padding} />
    </label>
    <div class="parameter-control">
      <span>Label length</span>
      <Button
        label={conciseLabels ? "Use full labels" : "Use concise labels"}
        onclick={() => (conciseLabels = !conciseLabels)}
      />
    </div>
    <div class="parameter-control">
      <span>Filter label</span>
      <Button
        label={longFilterLabel ? "Use regular filter label" : "Use long filter label"}
        onclick={() => (longFilterLabel = !longFilterLabel)}
      />
    </div>
    <div class="parameter-control">
      <span>Item set</span>
      <Button
        label={archiveIncluded ? "Remove archive action" : "Add archive action"}
        onclick={() => (archiveIncluded = !archiveIncluded)}
      />
    </div>
    <div class="parameter-control">
      <span>Item order</span>
      <Button
        label={reverseItems ? "Restore item order" : "Reverse item order"}
        onclick={() => (reverseItems = !reverseItems)}
      />
    </div>
    <div class="parameter-control">
      <span>Compact panel</span>
      <Button
        label={mode !== "compact"
          ? "Compact only"
          : open
            ? "Close compact panel"
            : "Open compact panel"}
        disabled={mode !== "compact"}
        onclick={() => (open = !open)}
      />
    </div>
    <span class="mode-readout">Current layout <code>{mode}</code></span>
  </div>

  <div class="sizing-pane" style:width="{paneWidth}px">
    <AdaptiveActionGrid
      class={`demo-action-grid demo-action-grid--radius-${radius}`}
      items={actionItems}
      ariaLabel="Result controls"
      compactLabel="Filters and actions"
      summary={compactSummary}
      bind:open
      onmodechange={(next) => (mode = next)}
      collapseBelow={480}
      minTrackWidth={180}
      {frame}
      {radius}
      {itemRadius}
      {rowGap}
      {columnGap}
      {padding}
    />
  </div>
</DemoSection>

<DemoSection
  title="Filled grid layout"
  description="layout=&quot;grid&quot; never renders a natural-width row: equal tracks fill the container at every width, rows stay balanced, and a leftover item spans the remaining tracks."
  code={`<AdaptiveActionGrid
  items={phoneActions}
  ariaLabel="Pull request actions"
  layout="grid"
  collapseBelow={0}
  minTrackWidth={140}
  radius="md"
  itemRadius="none"
  rowGap={0}
  columnGap={0}
  padding={0}
/>`}
>
  <div class="parameter-grid">
    <label class="parameter-control">
      <span>Container width</span>
      <input class="filled-width" type="range" min="240" max="900" bind:value={filledWidth} />
    </label>
    <div class="parameter-control">
      <span>Item count</span>
      <Button
        label={filledFive ? "Four actions" : "Five actions"}
        onclick={() => (filledFive = !filledFive)}
      />
    </div>
  </div>
  <div class="sizing-pane" style:width="{filledWidth}px">
    <AdaptiveActionGrid
      class="filled-action-grid"
      items={filledItems}
      ariaLabel="Pull request actions"
      layout="grid"
      collapseBelow={0}
      minTrackWidth={140}
      radius="md"
      itemRadius="none"
      rowGap={0}
      columnGap={0}
      padding={0}
    />
  </div>
</DemoSection>

<DemoSection
  title="Validated compact controls"
  description="A native validation error opens the inline disclosure before the browser focuses the required field."
  code={`<form onsubmit={save}>
  <AdaptiveActionGrid
    items={[
      { id: "query", content: requiredQueryAction },
      { id: "saved", content: savedQueryAction },
    ]}
    ariaLabel="Query controls"
    compactLabel="Query controls"
    collapseBelow={400}
    rowGap={0}
    columnGap={0}
    padding={0}
  />
  <Button type="submit" label="Submit form" />
</form>`}
>
  <form
    class="validation-form"
    onsubmit={(event) => {
      event.preventDefault();
      notify(`Submitted query: ${requiredQuery}`);
    }}
  >
    <AdaptiveActionGrid
      class="validation-action-grid"
      items={[
        { id: "query", content: requiredQueryAction },
        { id: "saved", content: savedQueryAction },
      ]}
      ariaLabel="Query controls"
      compactLabel="Query controls"
      collapseBelow={400}
      minTrackWidth={180}
      rowGap={0}
      columnGap={0}
      padding={0}
      bind:open={validationOpen}
    />
    <Button type="submit" label="Submit form" tone="info" surface="solid" />
  </form>
</DemoSection>

<DemoSection
  title="Icon-only actions"
  description="Square icon buttons keep their full control width when the container decides whether the row fits."
  code={`<AdaptiveActionGrid
  items={iconActions}
  ariaLabel="Icon actions"
  collapseBelow={0}
  minTrackWidth={28}
/>`}
>
  <div class="icon-pane">
    <AdaptiveActionGrid
      class="icon-action-grid"
      items={[
        { id: "one", content: settingsAction },
        { id: "two", content: settingsAction },
        { id: "three", content: settingsAction },
        { id: "four", content: settingsAction },
        { id: "five", content: settingsAction },
        { id: "six", content: settingsAction },
      ]}
      ariaLabel="Icon actions"
      collapseBelow={0}
      minTrackWidth={28}
    />
  </div>
</DemoSection>

{#snippet todayAction()}
  <Button label="Today" onclick={() => notify("Showing today")} />
{/snippet}

{#snippet weekAction()}
  <Button label="7 days" onclick={() => notify("Showing seven days")} />
{/snippet}

{#snippet monthAction()}
  <Button label="30 days" onclick={() => notify("Showing thirty days")} />
{/snippet}

{#snippet allTimeAction()}
  <Button label="All time" tone="info" surface="solid" onclick={() => notify("Showing all time")} />
{/snippet}

<DemoSection
  title="Zero-gap mobile control"
  description="Square item corners, no padding, and no gaps turn separate buttons into one clipped control slab. The outer radius still follows the active theme."
  code={`<AdaptiveActionGrid
  items={[
    { id: "today", content: todayAction },
    { id: "week", content: weekAction },
    { id: "month", content: monthAction },
    { id: "all", content: allTimeAction },
  ]}
  ariaLabel="Date range"
  radius="md"
  itemRadius="none"
  rowGap={0}
  columnGap={0}
  padding={0}
/>`}
>
  <div class="mobile-pane">
    <AdaptiveActionGrid
      class="joined-action-grid"
      items={[
        { id: "today", content: todayAction },
        { id: "week", content: weekAction },
        { id: "month", content: monthAction },
        { id: "all", content: allTimeAction },
      ]}
      ariaLabel="Date range"
      compactLabel="Date range"
      collapseBelow={0}
      minTrackWidth={120}
      radius="md"
      itemRadius="none"
      rowGap={0}
      columnGap={0}
      padding={0}
    />
  </div>
</DemoSection>

<style>
  .demo-controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    align-items: end;
    width: 100%;
    gap: var(--space-5) var(--space-6);
  }

  .parameter-control {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    gap: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .parameter-control > span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .parameter-control output {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .parameter-control--wide {
    grid-column: span 2;
  }

  .parameter-control input[type="range"] {
    width: 100%;
    min-width: 96px;
    margin: 0;
  }

  .parameter-control :global(.kit-select-dropdown) {
    min-width: 0;
  }

  .mode-readout {
    align-self: center;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .sizing-pane {
    max-width: 100%;
  }

  .sizing-pane :global(.kit-adaptive-action-grid) {
    width: 100%;
  }

  .mobile-pane {
    width: min(100%, 260px);
  }

  .mobile-pane :global(.kit-adaptive-action-grid) {
    width: 100%;
  }

  .validation-form {
    display: grid;
    width: min(100%, 280px);
    justify-items: stretch;
    gap: var(--space-4);
  }

  .icon-pane {
    width: min(100%, 198px);
  }
</style>
