<script lang="ts">
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import ListIcon from "@lucide/svelte/icons/list";
  import Table2Icon from "@lucide/svelte/icons/table-2";
  import { SegmentedControl } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let filter = $state("all");
  let range = $state("7d");
  let mode = $state("normal");
  let status = $state("passing");
  let view = $state("list");

  const viewIcons: Record<string, typeof ListIcon> = {
    list: ListIcon,
    grid: LayoutGridIcon,
    table: Table2Icon,
  };
  const viewOptions = [
    { value: "list", label: "List" },
    { value: "grid", label: "Grid" },
    { value: "table", label: "Table" },
  ];
</script>

<DemoSection
  title="Value selector"
  description="Radio-group semantics with roving focus (arrow keys move selection). This replaces the segmented-control/seg-btn pattern repeated inline across middleman."
  code={`<SegmentedControl
  options={[
    { value: "all", label: "All" },
    { value: "prs", label: "PRs" },
    { value: "issues", label: "Issues" },
  ]}
  value={filter}
  onchange={(v) => (filter = v)}
  ariaLabel="Item filter"
/>`}
>
  <SegmentedControl
    options={[
      { value: "all", label: "All" },
      { value: "prs", label: "PRs" },
      { value: "issues", label: "Issues" },
    ]}
    value={filter}
    onchange={(v) => (filter = v)}
    ariaLabel="Item filter"
  />
  <span>value: <code>{filter}</code></span>
</DemoSection>

<DemoSection
  title="Borderless (flat strip) variant"
  description="The agentsview transcript-strip style: flush segments sharing hairline borders, the active one tinted with the accent. Each segment owns its border, so the accent-tinted border of the selection applies to its stretch of the control's edge — the outer border is never one uniform grey line fighting the tinted pill (same fixup as the Modal tone header)."
  code={`<SegmentedControl
  variant="borderless"
  options={[
    { value: "normal", label: "Normal" },
    { value: "focused", label: "Focused" },
    { value: "raw", label: "Raw" },
  ]}
  value={mode}
  onchange={(v) => (mode = v)}
  ariaLabel="Transcript mode"
/>`}
>
  <SegmentedControl
    variant="borderless"
    options={[
      { value: "normal", label: "Normal" },
      { value: "focused", label: "Focused" },
      { value: "raw", label: "Raw" },
    ]}
    value={mode}
    onchange={(v) => (mode = v)}
    ariaLabel="Transcript mode"
  />
  <span>value: <code>{mode}</code></span>
</DemoSection>

<DemoSection
  title="Per-segment tones (borderless)"
  description="option.tone gives a segment its own semantic accent: tinted ink and border even while inactive, the full tone band when active. Shared-edge precedence: the active segment's border wins its edges; between inactive neighbors the leftmost segment's right border owns the shared edge. Untoned segments keep the default accent when active."
  code={`<SegmentedControl
  variant="borderless"
  options={[
    { value: "all", label: "All" },
    { value: "passing", label: "Passing", tone: "success" },
    { value: "flaky", label: "Flaky", tone: "warning" },
    { value: "failing", label: "Failing", tone: "danger" },
  ]}
  value={status}
  onchange={(v) => (status = v)}
  ariaLabel="Status filter"
/>`}
>
  <SegmentedControl
    variant="borderless"
    options={[
      { value: "all", label: "All" },
      { value: "passing", label: "Passing", tone: "success" },
      { value: "flaky", label: "Flaky", tone: "warning" },
      { value: "failing", label: "Failing", tone: "danger" },
    ]}
    value={status}
    onchange={(v) => (status = v)}
    ariaLabel="Status filter"
  />
  <span>value: <code>{status}</code></span>
</DemoSection>

<DemoSection
  title="Snippet segments (icons)"
  description="The segment snippet renders custom content — icons, counts, icon+text — in place of the label text; it receives the option and whether it is active. option.label stays the accessible name (applied as the button's aria-label), so icon-only segments still read properly to assistive tech. Works in both variants."
  code={`<SegmentedControl options={viewOptions} value={view} onchange={…} ariaLabel="View">
  {#snippet segment(option)}
    {@const Icon = viewIcons[option.value]}
    <Icon size="12" strokeWidth="2" aria-hidden="true" />
    {option.label}
  {/snippet}
</SegmentedControl>`}
>
  <div class="snippet-row">
    <SegmentedControl
      variant="borderless"
      options={viewOptions}
      value={view}
      onchange={(v) => (view = v)}
      ariaLabel="View"
    >
      {#snippet segment(option)}
        {@const Icon = viewIcons[option.value]}
        <Icon size="12" strokeWidth="2" aria-hidden="true" />
        {option.label}
      {/snippet}
    </SegmentedControl>
    <SegmentedControl
      options={viewOptions.map((o) => ({ ...o, title: o.label }))}
      value={view}
      onchange={(v) => (view = v)}
      ariaLabel="View (icon-only)"
    >
      {#snippet segment(option)}
        {@const Icon = viewIcons[option.value]}
        <Icon size="13" strokeWidth="2" aria-hidden="true" />
      {/snippet}
    </SegmentedControl>
    <span>value: <code>{view}</code></span>
  </div>
</DemoSection>

<DemoSection
  title="Block width and disabled options"
  description="block stretches the group to its container, segments sharing space equally (middleman's compact/mobile treatment)."
  code={`<SegmentedControl block options={ranges} value={range} onchange={...} />`}
>
  <div style="width: 100%">
    <SegmentedControl
      block
      options={[
        { value: "24h", label: "24h" },
        { value: "7d", label: "7 days" },
        { value: "30d", label: "30 days" },
        { value: "all", label: "All time", disabled: true },
      ]}
      value={range}
      onchange={(v) => (range = v)}
      ariaLabel="Time range"
    />
  </div>
</DemoSection>

<style>
  .snippet-row {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }
</style>
