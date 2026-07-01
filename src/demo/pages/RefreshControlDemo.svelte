<script lang="ts">
  import { RefreshControl } from "../../lib/index.js";
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
  <RefreshControl
    {lastUpdatedAt}
    {busy}
    onRefresh={refresh}
    label="Refresh usage data"
  />
</DemoSection>
