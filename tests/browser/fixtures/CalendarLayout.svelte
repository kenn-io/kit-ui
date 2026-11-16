<script lang="ts">
  import Calendar from "../../../src/lib/components/Calendar.svelte";

  let layout = $state<"grid" | "strip">("grid");
  let month = $state("2026-03-01");
  let selected = $state<{ from: string; to: string } | null>(null);
  let maxDate = $state<string | null>(null);
  let calendar: ReturnType<typeof Calendar>;
</script>

<button onclick={() => (layout = "grid")}>Grid</button>
<button onclick={() => (layout = "strip")}>Strip</button>
<button onclick={() => (selected = { from: "2026-03-20", to: "2026-03-20" })}
  >Select March 20</button
>
<button onclick={() => (selected = null)}>Clear selection</button>
<button onclick={() => (maxDate = "2026-03-10")}>Limit to March 10</button>
<button onclick={() => (maxDate = null)}>Clear limit</button>
<button onclick={() => calendar.focus()}>Focus calendar</button>
<Calendar
  bind:this={calendar}
  bind:month
  {layout}
  {selected}
  {maxDate}
  activity={{ "2026-03-01": 0 }}
  activityScale={(count) => (count === 0 ? 1 : 0)}
  activityLabel={(count) => `${count} messages`}
/>
