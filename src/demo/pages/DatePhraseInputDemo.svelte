<script lang="ts">
  import Calendar from "../../lib/components/Calendar.svelte";
  import DatePhraseInput from "../../lib/components/DatePhraseInput.svelte";
  import { datePhraseRange, parseDatePhrase } from "../../lib/components/date-phrase.js";
  import { daysInRange, formatDateRangeLabel, todayStr } from "../../lib/components/date-range.js";
  import DemoSection from "../DemoSection.svelte";

  let text = $state("");
  let month = $state(todayStr());
  let committed = $state<string>("none");

  const range = $derived(datePhraseRange(parseDatePhrase(text, { locale: "en-US" })));
  const summary = $derived(
    range
      ? `${formatDateRangeLabel(range.from, range.to, "en-US")} · ${daysInRange(range.from, range.to)} days`
      : "",
  );
</script>

<DemoSection
  title="With a bare Calendar"
  description="DatePicker and DateRangePicker already include this field. Apps that wrap Calendar in their own popover can put DatePhraseInput above it and drive the grid from parseDatePhrase(). Ghost text finishes the word being typed; Tab or → takes it."
  code={`<DatePhraseInput
  bind:value={text}
  summary={summary}
  hint="Type or select dates."
  oninput={() => range && (month = range.from)}
  onsubmit={() => range && apply(range)}
/>
<Calendar bind:month selected={range} />`}
>
  <div class="host" data-testid="date-phrase-host">
    <DatePhraseInput
      bind:value={text}
      {summary}
      hint="Type or select dates."
      locale="en-US"
      oninput={() => {
        if (range) month = range.from;
      }}
      onsubmit={() => {
        if (range) committed = `${range.from} → ${range.to}`;
      }}
    />
    <Calendar bind:month selected={range} locale="en-US" />
    <code class="readout">committed: {committed}</code>
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
