<script lang="ts">
  import { Button, RefreshControl } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let lastUpdatedAt = $state<number | null>(Date.now());
  let busy = $state(false);

  function refresh() {
    busy = true;
    setTimeout(() => {
      lastUpdatedAt = Date.now();
      busy = false;
    }, 800);
  }

  // Fixed-width section: the box reserves the widest sample so cycling
  // through variants never moves the marker rendered after the control.
  const AGE_SAMPLES = [
    "Not updated",
    "Updated just now",
    "Updated 59m ago",
    "Updated 23h ago",
    "Updated 999d ago",
  ];
  const AGE_VARIANTS = {
    "not updated": null,
    "just now": 0,
    "3m ago": 3 * 60_000,
    "long status": -1,
  } as const;
  type AgeVariant = keyof typeof AGE_VARIANTS;

  let ageVariant = $state<AgeVariant>("just now");
  const fixedNow = Date.now();
  const fixedAt = $derived.by(() => {
    const offset = AGE_VARIANTS[ageVariant];
    return offset === null || offset < 0 ? null : fixedNow - offset;
  });
  function fixedFormatAge(at: number | null, now: number): string {
    if (ageVariant === "long status") return "Processing activity, 12,480 rows scanned so far";
    if (at === null) return "Not updated";
    const minutes = Math.floor((now - at) / 60_000);
    return minutes < 1 ? "Updated just now" : `Updated ${minutes}m ago`;
  }

  // Tooltip section: a per-step breakdown of the last fetch on hover/focus.
  const STEPS = [
    { name: "Summary", duration: "120 ms" },
    { name: "Activity", duration: "85 ms" },
    { name: "Heatmap", duration: "1 s" },
    { name: "Top sessions", duration: "2 s" },
  ];
</script>

<DemoSection
  title="Refresh with age label"
  description="Click refreshes immediately and resets the auto-refresh interval (default 5 minutes). The age label ticks forward once a minute without refetching."
  code={`<RefreshControl
  {lastUpdatedAt}
  {busy}
  onRefresh={refresh}
  label="Refresh usage data"
/>`}
>
  <RefreshControl {lastUpdatedAt} {busy} onRefresh={refresh} label="Refresh usage data" />
</DemoSection>

<DemoSection
  title="Fixed-width age label"
  description="ageWidthSamples reserves the widest string the label can show, so swapping variants never shifts the element after the control. Text longer than every sample clips with an ellipsis instead of growing the box."
  code={`<RefreshControl
  {lastUpdatedAt}
  onRefresh={refresh}
  ageWidthSamples={["Not updated", "Updated just now", "Updated 999d ago"]}
/>`}
>
  <div class="refresh-demo">
    <div class="refresh-demo__row" data-testid="fixed-width-row">
      <RefreshControl
        lastUpdatedAt={fixedAt}
        onRefresh={() => {}}
        label="Refresh fixed-width demo"
        formatAge={fixedFormatAge}
        ageWidthSamples={AGE_SAMPLES}
      />
      <span class="refresh-demo__marker" data-testid="fixed-width-marker">next control</span>
    </div>
    <div class="refresh-demo__controls" role="group" aria-label="Age variant">
      {#each Object.keys(AGE_VARIANTS) as variant (variant)}
        <Button
          size="sm"
          surface={ageVariant === variant ? "solid" : "outline"}
          onclick={() => (ageVariant = variant as AgeVariant)}
        >
          Age: {variant}
        </Button>
      {/each}
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Age label tooltip"
  description="ageTooltip renders rich content on hover or focus of the age label, replacing its default timestamp title. Here: how long each step of the last fetch took."
  code={`<RefreshControl {lastUpdatedAt} onRefresh={refresh}>
  {#snippet ageTooltip()}
    <dl class="steps">
      {#each steps as step}
        <dt>{step.name}</dt>
        <dd>{step.duration}</dd>
      {/each}
    </dl>
  {/snippet}
</RefreshControl>`}
>
  <div class="refresh-demo__row" data-testid="tooltip-row">
    <RefreshControl lastUpdatedAt={fixedNow} onRefresh={() => {}} label="Refresh with breakdown">
      {#snippet ageTooltip()}
        <dl class="refresh-demo__steps">
          {#each STEPS as step (step.name)}
            <dt>{step.name}</dt>
            <dd>{step.duration}</dd>
          {/each}
        </dl>
      {/snippet}
    </RefreshControl>
  </div>
</DemoSection>

<style>
  .refresh-demo__steps {
    display: grid;
    grid-template-columns: auto max-content;
    column-gap: var(--space-4);
    row-gap: var(--space-1);
    margin: 0;
    font-size: var(--font-size-xs);
  }

  .refresh-demo__steps dt {
    color: var(--text-secondary);
  }

  .refresh-demo__steps dd {
    margin: 0;
    text-align: end;
    font-variant-numeric: tabular-nums;
  }

  .refresh-demo {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .refresh-demo__row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .refresh-demo__marker {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    padding: 2px var(--space-2);
    border: 1px dashed var(--border-muted);
    border-radius: 4px;
  }

  .refresh-demo__controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
