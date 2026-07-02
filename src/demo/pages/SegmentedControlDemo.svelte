<script lang="ts">
  import { SegmentedControl } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let filter = $state("all");
  let range = $state("7d");
  let mode = $state("normal");
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
