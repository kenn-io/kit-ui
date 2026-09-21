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

  // Fixed-width section: the boxes reserve the widest sample so cycling
  // through variants never moves the marker rendered after the control.
  const AGE_SAMPLES = [
    "Not updated",
    "Updated just now",
    "Updated 59m ago",
    "Updated 23h ago",
    "Updated 999d ago",
  ];
  const DETAIL_SAMPLES = ["999 ms", "59.9 s", "99m 59s"];
  const AGE_VARIANTS = {
    "not updated": null,
    "just now": 0,
    "3m ago": 3 * 60_000,
    "long status": -1,
  } as const;
  type AgeVariant = keyof typeof AGE_VARIANTS;
  const DETAIL_VARIANTS = ["8 ms", "59.9 s", "12m 05s", "empty"] as const;
  type DetailVariant = (typeof DETAIL_VARIANTS)[number];

  let ageVariant = $state<AgeVariant>("just now");
  let detailVariant = $state<DetailVariant>("8 ms");
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
  const fixedDetail = $derived(detailVariant === "empty" ? undefined : detailVariant);
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
  title="Fixed-width boxes with a detail readout"
  description="ageWidthSamples and detailWidthSamples reserve the widest string each box can show, so swapping variants never shifts the detail box or the element after the control. Text longer than every sample clips with an ellipsis instead of growing the box."
  code={`<RefreshControl
  {lastUpdatedAt}
  onRefresh={refresh}
  detail="42 ms"
  ageWidthSamples={["Not updated", "Updated just now", "Updated 999d ago"]}
  detailWidthSamples={["999 ms", "59.9 s", "99m 59s"]}
/>`}
>
  <div class="refresh-demo">
    <div class="refresh-demo__row" data-testid="fixed-width-row">
      <RefreshControl
        lastUpdatedAt={fixedAt}
        onRefresh={() => {}}
        label="Refresh fixed-width demo"
        formatAge={fixedFormatAge}
        detail={fixedDetail}
        ageWidthSamples={AGE_SAMPLES}
        detailWidthSamples={DETAIL_SAMPLES}
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
    <div class="refresh-demo__controls" role="group" aria-label="Detail variant">
      {#each DETAIL_VARIANTS as variant (variant)}
        <Button
          size="sm"
          surface={detailVariant === variant ? "solid" : "outline"}
          onclick={() => (detailVariant = variant)}
        >
          Detail: {variant}
        </Button>
      {/each}
    </div>
  </div>
</DemoSection>

<style>
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
