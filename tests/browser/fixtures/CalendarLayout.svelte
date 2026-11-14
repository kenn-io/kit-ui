<script lang="ts">
  import Calendar from "../../../src/lib/components/Calendar.svelte";

  let layout = $state<"grid" | "strip">("grid");
  let month = $state("2026-03-01");
</script>

<button onclick={() => (layout = "grid")}>Grid</button>
<button onclick={() => (layout = "strip")}>Strip</button>
<Calendar
  bind:month
  {layout}
  activity={{ "2026-03-01": 0, "2026-03-02": -1 }}
  activityScale={(count) => (count === 0 ? 1 : 0)}
  activityLabel={(count) => `${count} messages`}
/>
