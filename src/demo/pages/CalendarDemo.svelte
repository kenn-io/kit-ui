<script lang="ts">
  import {
    Calendar,
    monthGridDates,
    periodBounds,
    SegmentedControl,
    todayStr,
    type DateRange,
  } from "../../lib/index.js";
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

  let localeChoice = $state("browser");
  let localeMonth = $state(todayStr());
  const demoLocale = $derived(localeChoice === "browser" ? undefined : localeChoice);

  // Made-up daily counts up to today across the visible month and its
  // neighbors, the same every load. Weekends are quieter.
  let activityMonth = $state(todayStr());
  let activityDay = $state<string | null>(null);
  const activity = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const date of monthGridDates(activityMonth)) {
      if (date > todayStr()) break;
      const day = Number.parseInt(date.slice(8), 10);
      const weekday = new Date(`${date}T12:00:00`).getDay();
      const count = ((day * 7 + 3) % 11) - (weekday === 0 || weekday === 6 ? 6 : 1);
      if (count > 0) counts[date] = count;
    }
    return counts;
  });

  let scaleMonth = $state(todayStr());
  // An app's own fixed thresholds instead of quarters of the busiest day.
  function messageScale(count: number): number {
    if (count <= 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  }

  // Month strip: a fixed month so the example is the same every load.
  let stripMonth = $state("2026-03-01");
  let stripDay = $state<string | null>("2026-03-28");
  let stripFilter = $state("off");
  // Day 20 has no count, so the 10th–20th filter also marks a day without one.
  const stripActivity = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const date of monthGridDates(stripMonth)) {
      const count = (Number.parseInt(date.slice(8), 10) * 7 + 3) % 13;
      if (count > 0) counts[date] = count;
    }
    return counts;
  });
  // Stand-ins for an app's filters, independent of the counts.
  const stripMatches = $derived(
    stripFilter === "third"
      ? (date: string) => Number.parseInt(date.slice(8), 10) % 3 === 0
      : stripFilter === "mid"
        ? (date: string) => date.slice(8) >= "10" && date.slice(8) <= "20"
        : undefined,
  );
  let sundayMonth = $state("2026-02-01");
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
  description="The classic two-click range: the first pick starts the range, the second completes it (picking an earlier day swaps the ends), and a third pick starts a new one. The component stays controlled — the consumer owns this state machine and feeds the result back through selected. Days ending in 0 carry a matches dot, in surface ink on a solid range end."
  code={`<Calendar bind:month selected={dayRange} onpick={pickRangeDay} matches={(d) => d.endsWith("0")} />

function pickRangeDay(d: string) {
  if (!rangeFrom || rangeTo) { rangeFrom = d; rangeTo = null; }
  else if (d < rangeFrom) { rangeTo = rangeFrom; rangeFrom = d; }
  else { rangeTo = d; }
}`}
>
  <div class="calendar-demo">
    <Calendar
      bind:month={rangeMonth}
      selected={dayRange}
      onpick={pickRangeDay}
      matches={(d) => d.endsWith("0")}
    />
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

<DemoSection
  title="App locale"
  description="Month, weekday, and day-cell labels follow the browser locale by default; pass locale (a BCP 47 tag) when the app's language setting can diverge from it. The grid stays Monday-first regardless."
  code={`<Calendar bind:month locale="zh-CN" />`}
>
  <div class="calendar-demo">
    <Calendar bind:month={localeMonth} locale={demoLocale} />
    <div class="locale-controls">
      <SegmentedControl
        options={[
          { value: "browser", label: "Browser" },
          { value: "zh-CN", label: "zh-CN" },
          { value: "fr", label: "fr" },
          { value: "de", label: "de" },
        ]}
        value={localeChoice}
        onchange={(v) => (localeChoice = v)}
        ariaLabel="Calendar locale"
      />
      <span class="readout">locale: <code>{demoLocale ?? "(browser)"}</code></span>
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Activity"
  description="Pass activity, a count per day, to shade days in four steps of one accent. By default the steps are quarters of the busiest day in view; activityScale sets an app's own thresholds, and --kit-calendar-activity-color picks the accent. Each day's accessible label adds its count, worded by activityLabel. Selection, today, and maxDate work as before."
  code={`<Calendar
  bind:month
  {activity}
  selected={day ? { from: day, to: day } : null}
  onpick={(d) => (day = d)}
/>

<div style="--kit-calendar-activity-color: var(--accent-amber)">
  <Calendar
    bind:month
    {activity}
    activityScale={(count) => (count <= 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4)}
    activityLabel={(count) => (count === 1 ? "1 message" : \`\${count} messages\`)}
  />
</div>`}
>
  <div class="calendar-demo">
    <div data-testid="calendar-activity">
      <Calendar
        bind:month={activityMonth}
        {activity}
        selected={activityDay ? { from: activityDay, to: activityDay } : null}
        onpick={(d) => (activityDay = d)}
        maxDate={todayStr()}
      />
    </div>
    <div data-testid="calendar-activity-scale" class="amber">
      <Calendar
        bind:month={scaleMonth}
        activity={Object.fromEntries(
          monthGridDates(scaleMonth).map((date, i) => [date, (i * 5) % 13]),
        )}
        activityScale={messageScale}
        activityLabel={(count) => (count === 1 ? "1 message" : `${count} messages`)}
      />
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Month strip"
  description="The strip layout shows the visible month as one row of weekday/number cells that scrolls inside itself when narrow. Weekend letters are quieter, the selected day keeps its shade under an outline, and matches marks days with a dot — independent of activity, selection, and maxDate — adding matchLabel to their accessible label. The second strip is Sunday-first, in French, with a blue accent and maxDate."
  code={`<Calendar
  layout="strip"
  bind:month
  {activity}
  activityScale={(count) => (count <= 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4)}
  matches={(date) => matchingDays.has(date)}
  selected={day ? { from: day, to: day } : null}
  onpick={(d) => (day = d)}
/>`}
>
  <div class="strip-demo">
    <div data-testid="calendar-strip">
      <Calendar
        layout="strip"
        bind:month={stripMonth}
        activity={stripActivity}
        activityScale={messageScale}
        activityLabel={(count) => (count === 1 ? "1 message" : `${count} messages`)}
        matches={stripMatches}
        selected={stripDay ? { from: stripDay, to: stripDay } : null}
        onpick={(d) => (stripDay = d)}
      />
    </div>
    <div class="calendar-demo">
      <SegmentedControl
        options={[
          { value: "off", label: "No filter" },
          { value: "third", label: "Every 3rd day" },
          { value: "mid", label: "10th–20th" },
        ]}
        value={stripFilter}
        onchange={(v) => (stripFilter = v)}
        ariaLabel="Strip filter"
      />
      <span class="readout">picked: <code>{stripDay ?? "none"}</code></span>
    </div>
    <div data-testid="calendar-strip-sunday" class="blue">
      <Calendar
        layout="strip"
        bind:month={sundayMonth}
        weekStart="sunday"
        locale="fr"
        activity={Object.fromEntries(
          monthGridDates(sundayMonth).map((date, i) => [date, (i * 5) % 13]),
        )}
        maxDate="2026-02-20"
        matches={(date) => date.endsWith("4")}
        matchLabel="correspond aux filtres"
      />
    </div>
  </div>
</DemoSection>

<style>
  .strip-demo {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: 100%;
    min-width: 0;
  }

  .blue {
    --kit-calendar-activity-color: var(--accent-blue);
  }

  .amber {
    --kit-calendar-activity-color: var(--accent-amber);
  }

  .locale-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }

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
