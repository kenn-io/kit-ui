<script lang="ts">
  import { Calendar, periodBounds, todayStr, type DateRange } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let picked = $state(todayStr());
  let pickedMonth = $state(todayStr());
  let drillMonth = $state(todayStr());

  let weekAnchor = $state(todayStr());
  let weekMonth = $state(todayStr());
  const week = $derived<DateRange>(periodBounds("week", weekAnchor));

  // Two-click day range: first pick starts a range, second completes it
  // (an earlier second click swaps the ends), a third starts over.
  let rangeFrom = $state<string | null>(null);
  let rangeTo = $state<string | null>(null);
  let rangeMonth = $state(todayStr());
  const dayRange = $derived<DateRange | null>(
    rangeFrom ? { from: rangeFrom, to: rangeTo ?? rangeFrom } : null,
  );

  function pickRangeDay(d: string) {
    if (!rangeFrom || rangeTo) {
      rangeFrom = d;
      rangeTo = null;
    } else if (d < rangeFrom) {
      rangeTo = rangeFrom;
      rangeFrom = d;
    } else {
      rangeTo = d;
    }
  }
</script>

<DemoSection
  title="Single date"
  description="A month grid with locale month/weekday labels; the picked day renders as a solid pill and maxDate disables the future."
  code={`<Calendar
  bind:month
  selected={{ from: picked, to: picked }}
  onpick={(d) => (picked = d)}
  maxDate={todayStr()}
/>`}
>
  <div class="calendar-demo">
    <Calendar
      bind:month={pickedMonth}
      selected={{ from: picked, to: picked }}
      onpick={(d) => (picked = d)}
      maxDate={todayStr()}
    />
    <span class="readout">picked: <code>{picked}</code></span>
  </div>
</DemoSection>

<DemoSection
  title="Month / year drill-down"
  description="Clicking the header label zooms out to a month grid, clicking again to a 12-year grid; picking an entry drills back down (year → months → days). The arrows page by month, year, or 12 years to match the view, and maxDate disables future months/years in the zoomed grids too."
  code={`<Calendar bind:month maxDate={todayStr()} />`}
>
  <div class="calendar-demo">
    <Calendar bind:month={drillMonth} maxDate={todayStr()} />
    <span class="readout">month: <code>{drillMonth.slice(0, 7)}</code></span>
  </div>
</DemoSection>

<DemoSection
  title="Range highlight"
  description="selected takes any inclusive range — here the ISO week containing the clicked day, the same wiring DateRangePicker's Calendar tab uses."
  code={`<Calendar bind:month selected={periodBounds("week", anchor)} onpick={(d) => (anchor = d)} />`}
>
  <div class="calendar-demo">
    <Calendar bind:month={weekMonth} selected={week} onpick={(d) => (weekAnchor = d)} />
    <span class="readout">week: <code>{week.from} → {week.to}</code></span>
  </div>
</DemoSection>

<DemoSection
  title="Day → day range"
  description="The classic two-click range: the first pick starts the range, the second completes it (picking an earlier day swaps the ends), and a third pick starts a new one. The component stays controlled — the consumer owns this state machine and feeds the result back through selected."
  code={`<Calendar bind:month selected={dayRange} onpick={pickRangeDay} />

function pickRangeDay(d: string) {
  if (!rangeFrom || rangeTo) { rangeFrom = d; rangeTo = null; }
  else if (d < rangeFrom) { rangeTo = rangeFrom; rangeFrom = d; }
  else { rangeTo = d; }
}`}
>
  <div class="calendar-demo">
    <Calendar bind:month={rangeMonth} selected={dayRange} onpick={pickRangeDay} />
    <span class="readout">
      {#if rangeFrom && rangeTo}
        range: <code>{rangeFrom} → {rangeTo}</code>
      {:else if rangeFrom}
        start: <code>{rangeFrom}</code> — pick an end date
      {:else}
        pick a start date
      {/if}
    </span>
  </div>
</DemoSection>

<style>
  .calendar-demo {
    display: flex;
    align-items: flex-start;
    gap: var(--space-7);
    flex-wrap: wrap;
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
