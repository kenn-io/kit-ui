<script lang="ts">
  import RangePicker from "../../lib/components/RangePicker.svelte";
  import {
    daysAgo,
    resolveRange,
    todayStr,
    type RangeSelection,
  } from "../../lib/components/range-picker.js";
  import DemoSection from "../DemoSection.svelte";

  const earliestDate = daysAgo(500);

  let selection = $state.raw<RangeSelection>({ mode: "relative", days: 30 });
  const resolved = $derived(resolveRange(selection, earliestDate));

  let pinnedSelection = $state.raw<RangeSelection>({
    mode: "calendar",
    unit: "week",
    anchor: todayStr(),
  });

  let blockSelection = $state.raw<RangeSelection>({ mode: "relative", days: 7 });
</script>

<DemoSection
  title="Relative / Calendar / Custom"
  description="One trigger, three tabs: rolling presets, steppable day/week/month periods, and an explicit from/to span. The demo readout shows the selection object plus the concrete bounds resolveRange() derives from it."
  code={`<RangePicker
  {selection}
  onSelect={(sel) => (selection = sel)}
  earliestDate="2025-02-16"
/>`}
>
  <RangePicker
    {selection}
    onSelect={(sel) => (selection = sel)}
    {earliestDate}
  />
  <span class="readout">
    <code>{JSON.stringify(selection)}</code>
    <code>resolved: {resolved.from} → {resolved.to}</code>
  </span>
</DemoSection>

<DemoSection
  title="Right-aligned with a max date"
  description="align='right' hangs the panel off the trigger's right edge (for toolbar corners); maxDate disables stepping the calendar past today."
  code={`<RangePicker {selection} onSelect={...} align="right" maxDate={todayStr()} />`}
>
  <div class="right-rail">
    <RangePicker
      selection={pinnedSelection}
      onSelect={(sel) => (pinnedSelection = sel)}
      {earliestDate}
      align="right"
      maxDate={todayStr()}
    />
  </div>
</DemoSection>

<DemoSection
  title="Block trigger"
  description="block stretches the trigger and panel to the container width, for vertical sidebars."
  code={`<RangePicker {selection} onSelect={...} block />`}
>
  <div class="sidebar-slot">
    <RangePicker
      selection={blockSelection}
      onSelect={(sel) => (blockSelection = sel)}
      {earliestDate}
      block
    />
  </div>
</DemoSection>

<style>
  .readout {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .right-rail {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }

  .sidebar-slot {
    width: 240px;
    padding: var(--space-4);
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-md);
  }
</style>
