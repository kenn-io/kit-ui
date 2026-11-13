<script lang="ts">
  import Calendar from "../../lib/components/Calendar.svelte";
  import DatePhraseInput from "../../lib/components/DatePhraseInput.svelte";
  import { datePhraseRange, parseDatePhrase } from "../../lib/components/date-phrase.js";
  import {
    daysInRange,
    formatDateRangeLabel,
    formatDayLabel,
    todayStr,
  } from "../../lib/components/date-range.js";
  import { focusOnOpen } from "../../lib/components/DatePhraseInput.svelte";
  import DemoSection from "../DemoSection.svelte";

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

  // One date with your own Calendar: the composition an app writes when it
  // wraps the bare Calendar (docs/components/date-phrase-input.md).
  let day = $state<string | null>(null);
  let dayText = $state("");
  let dayMonth = $state(todayStr());
  const parsed = $derived(parseDatePhrase(dayText, { locale: "en-US" }));
  const typedDay = $derived(parsed.kind === "date" ? parsed.date : null);
  const shownDay = $derived(typedDay ?? day);
  // Stands in for the app's popover: the field mounts when it opens.
  let dayOpen = $state(false);
  function pickDay(date: string): void {
    day = date;
    dayText = "";
    dayOpen = false;
  }
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
  description="The single-date composition an app writes around a bare Calendar: parse, accept only kind “date”, drive month and selected, commit on Enter."
  code={`const parsed = $derived(parseDatePhrase(text));
const typed = $derived(parsed.kind === "date" ? parsed.date : null);

<DatePhraseInput
  bind:value={text}
  summary={typed ? formatDayLabel(typed) : ""}
  hint="Type or pick a date."
  autofocus={focusOnOpen()}
  oninput={() => typed && (month = typed)}
  onsubmit={() => typed && pick(typed)}
/>
<Calendar bind:month selected={(typed ?? value) && { from: typed ?? value, to: typed ?? value }} onpick={pick} />`}
>
  <div class="host" data-testid="own-calendar-host">
    <button type="button" class="open" onclick={() => (dayOpen = !dayOpen)}>
      {day ? formatDayLabel(day, "en-US") : "Pick a date"}
    </button>
    {#if dayOpen}
      <DatePhraseInput
        bind:value={dayText}
        summary={typedDay ? formatDayLabel(typedDay, "en-US") : ""}
        hint="Type or pick a date."
        placeholder="Type a date"
        locale="en-US"
        autofocus={focusOnOpen()}
        oninput={() => {
          if (typedDay) dayMonth = typedDay;
        }}
        onsubmit={() => {
          if (typedDay) pickDay(typedDay);
        }}
      />
      <Calendar
        bind:month={dayMonth}
        selected={shownDay ? { from: shownDay, to: shownDay } : null}
        locale="en-US"
        onpick={pickDay}
      />
    {/if}
    <code class="readout" data-testid="own-calendar-value">picked: {day ?? "none"}</code>
  </div>
</DemoSection>

<style>
  .host {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    width: 280px;
  }

  .open {
    align-self: flex-start;
    font: inherit;
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
</style>
