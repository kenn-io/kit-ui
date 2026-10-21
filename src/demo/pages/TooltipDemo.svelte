<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Button from "../../lib/components/Button.svelte";
  import Chip from "../../lib/components/Chip.svelte";
  import DiffStats from "../../lib/components/DiffStats.svelte";
  import IconButton from "../../lib/components/IconButton.svelte";
  import Tooltip from "../../lib/components/Tooltip.svelte";
  import DemoSection from "../DemoSection.svelte";

  const breakdown = [
    { label: "Plans/docs", additions: 210, deletions: 12 },
    { label: "Code", additions: 1480, deletions: 322 },
    { label: "Tests", additions: 640, deletions: 88 },
    { label: "Generated", additions: 12100, deletions: 9400 },
  ];
</script>

<DemoSection
  title="Text tooltip"
  description="Hover or focus the trigger; opens after a short delay, closes on leave/blur/Escape. The bubble centers on its trigger, flips above when there's no room below, shifts to stay on screen, and its arrow keeps pointing at the trigger."
  code={`<Tooltip text="Rebases and fast-forwards the branch">
  <Button size="sm" label="Update branch" />
</Tooltip>`}
>
  <Tooltip text="Rebases and fast-forwards the branch">
    <Button size="sm" label="Update branch" />
  </Tooltip>
  <span data-testid="icon-tooltip">
    <Tooltip text="Reset to default">
      <IconButton ariaLabel="Reset" title="" size="sm">
        <RotateCcw size={14} aria-hidden="true" />
      </IconButton>
    </Tooltip>
  </span>
  <Tooltip text="Uses tabindex so plain text is keyboard-reachable" focusable>
    <span style="text-decoration: underline dotted; color: var(--text-secondary)"
      >focusable text</span
    >
  </Tooltip>
</DemoSection>

<DemoSection
  title="Rich content — the PR diff-stats case"
  description="The content snippet takes arbitrary markup. This recreates Forge's diff-summary popover: a stats chip whose tooltip breaks the counts down by file kind."
  code={`<Tooltip>
  {#snippet content()}
    <div class="rows">
      {#each breakdown as row}
        <div class="row">
          <span>{row.label}</span>
          <DiffStats additions={row.additions} deletions={row.deletions} />
        </div>
      {/each}
    </div>
  {/snippet}
  <Chip tone="muted" uppercase={false}>
    <DiffStats additions={14430} deletions={9822} />
  </Chip>
</Tooltip>`}
>
  <Tooltip>
    {#snippet content()}
      <div class="rows">
        {#each breakdown as row (row.label)}
          <div class="row">
            <span>{row.label}</span>
            <DiffStats additions={row.additions} deletions={row.deletions} />
          </div>
        {/each}
      </div>
    {/snippet}
    <Chip tone="muted" uppercase={false}>
      <DiffStats additions={14430} deletions={9822} />
    </Chip>
  </Tooltip>
  <span>← hover the chip</span>
</DemoSection>

<DemoSection
  title="Alignment and delays"
  code={`<Tooltip text="…" align="end" openDelayMs={0} closeDelayMs={0}>…</Tooltip>`}
>
  <Tooltip text="Aligned to the trigger's right edge, no delay" align="end" openDelayMs={0}>
    <Button size="sm" label="align=end, instant" />
  </Tooltip>
</DemoSection>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 190px;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-6);
    align-items: center;
    color: var(--text-secondary);
  }
</style>
