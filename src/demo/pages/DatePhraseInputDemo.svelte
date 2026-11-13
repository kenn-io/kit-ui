<script lang="ts">
  import Calendar from "../../lib/components/Calendar.svelte";
  import DatePhraseInput from "../../lib/components/DatePhraseInput.svelte";
  import { datePhraseRange, parseDatePhrase } from "../../lib/components/date-phrase.js";
  import { daysInRange, formatDateRangeLabel, todayStr } from "../../lib/components/date-range.js";
  import DemoSection from "../DemoSection.svelte";
  import OwnCalendarDateField from "./OwnCalendarDateField.svelte";

  let text = $state("");
  let month = $state(todayStr());
  let committed = $state<string>("none");

  const result = $derived(parseDatePhrase(text, { locale: "en-US", sets: true }));
  const range = $derived(datePhraseRange(result));
  // A set shows as separate days; anything else as a range.
  const days = $derived(result.kind === "dates" ? result.dates : null);
  const summary = $derived(
    range
      ? `${result.kind === "dates" ? `${result.label} · ` : ""}${formatDateRangeLabel(range.from, range.to, "en-US")} · ${days?.length ?? daysInRange(range.from, range.to)} days`
      : "",
  );
</script>

<DemoSection
  title="With a bare Calendar"
  description="DatePicker and DateRangePicker already include this field. Apps that wrap Calendar in their own popover can put DatePhraseInput above it and drive the grid from parseDatePhrase(). Ghost text finishes the word being typed; Tab or → takes it. This one reads sets too (“last 3 Fridays”), shown with Calendar's selectedDates."
  code={`<DatePhraseInput
  bind:value={text}
  summary={summary}
  hint="Type or select dates."
  sets
  oninput={() => range && (month = range.from)}
  onsubmit={() => range && apply(range)}
/>
<Calendar bind:month selected={days ? null : range} selectedDates={days} />`}
>
  <div class="host" data-testid="date-phrase-host">
    <DatePhraseInput
      bind:value={text}
      {summary}
      hint="Type or select dates."
      locale="en-US"
      sets
      oninput={() => {
        if (range) month = range.from;
      }}
      onsubmit={() => {
        if (range) committed = `${range.from} → ${range.to}`;
      }}
    />
    <Calendar bind:month selected={days ? null : range} selectedDates={days} locale="en-US" />
    <code class="readout">committed: {committed}</code>
  </div>
</DemoSection>

<DemoSection
  title="One date with your own Calendar"
  description="The single-date composition an app writes around a bare Calendar: parse, accept only kind “date”, drive month and selected, commit on Enter. Its source is the example in the DatePhraseInput docs."
>
  <div class="host" data-testid="own-calendar-host">
    <OwnCalendarDateField />
  </div>
</DemoSection>

<style>
  .host {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    width: 280px;
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
</style>
