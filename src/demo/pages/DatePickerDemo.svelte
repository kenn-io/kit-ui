<script lang="ts">
  import DatePicker from "../../lib/components/DatePicker.svelte";
  import { daysAgo, todayStr } from "../../lib/components/date-range.js";
  import DemoSection from "../DemoSection.svelte";

  let start = $state<string | null>(daysAgo(30));
  let empty = $state<string | null>(null);
  let bounded = $state<string | null>(null);
  let typed = $state<string | null>(null);
  let plain = $state<string | null>(null);
</script>

<DemoSection
  title="One date"
  description="A single-date trigger and popover around Calendar. The popover opens on the chosen date's month and closes when a day is picked; Escape and outside clicks dismiss it."
  code={`<DatePicker
  value={start}
  onchange={(date) => (start = date)}
  ariaLabel="Start date"
/>`}
>
  <DatePicker value={start} onchange={(date) => (start = date)} ariaLabel="Start date" />
  <code class="readout" data-testid="date-picker-value">{start}</code>
</DemoSection>

<DemoSection
  title="No date yet"
  description="Shows the placeholder until a date is picked."
  code={`<DatePicker value={null} onchange={(date) => (value = date)} placeholder="Pick a day" />`}
>
  <DatePicker value={empty} onchange={(date) => (empty = date)} placeholder="Pick a day" />
</DemoSection>

<DemoSection
  title="No future dates"
  description="maxDate disables later days; block stretches the trigger to its container."
  code={`<DatePicker value={value} onchange={(date) => (value = date)} maxDate={todayStr()} block />`}
>
  <div class="block-host">
    <DatePicker
      value={bounded}
      onchange={(date) => (bounded = date)}
      maxDate={todayStr()}
      ariaLabel="Last day"
      block
    />
  </div>
</DemoSection>

<DemoSection
  title="Type a date"
  description="The popover opens with a text field: type “tomorrow”, “Sep 10”, “next Friday” or “3 days ago”. Ghost text finishes the word (Tab or → takes it), the calendar previews the date, and Enter picks it. A range or text that isn't a date shows a hint and changes nothing."
  code={`<DatePicker value={value} onchange={(date) => (value = date)} locale="en-US" />`}
>
  <DatePicker
    value={typed}
    onchange={(date) => (typed = date)}
    ariaLabel="Typed date"
    placeholder="Pick or type a day"
    locale="en-US"
  />
  <code class="readout" data-testid="typed-date-value">{typed ?? "null"}</code>
</DemoSection>

<DemoSection
  title="Without text entry"
  description="textEntry={false} leaves out the text field."
  code={`<DatePicker value={value} onchange={(date) => (value = date)} textEntry={false} />`}
>
  <DatePicker
    value={plain}
    onchange={(date) => (plain = date)}
    ariaLabel="Calendar only"
    textEntry={false}
  />
</DemoSection>

<style>
  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .block-host {
    width: 260px;
  }
</style>
