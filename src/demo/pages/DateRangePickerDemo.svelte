<script lang="ts">
  import Button from "../../lib/components/Button.svelte";
  import DateRangePicker from "../../lib/components/DateRangePicker.svelte";
  import {
    daysAgo,
    resolveRange,
    todayStr,
    type RangeSelection,
  } from "../../lib/components/date-range.js";
  import DemoSection from "../DemoSection.svelte";

  const earliestDate = daysAgo(500);

  let selection = $state.raw<RangeSelection>({ mode: "relative", days: 30 });
  const resolved = $derived(resolveRange(selection, earliestDate));

  // External-change hooks: the picker drops a mid-pick draft when the app
  // swaps the committed selection while the popover is closed, and reopens
  // armed to complete a controlled incomplete custom selection. Browser
  // specs drive both paths through these buttons.
  const monthStart = todayStr().slice(0, 8) + "01";

  let pinnedSelection = $state.raw<RangeSelection>({
    mode: "calendar",
    unit: "week",
    anchor: todayStr(),
  });

  let sundaySelection = $state.raw<RangeSelection>({
    mode: "calendar",
    unit: "week",
    anchor: "2026-06-15",
  });
  const sundayRange = $derived(resolveRange(sundaySelection, undefined, "sunday"));

  let typedSelection = $state.raw<RangeSelection>({ mode: "relative", days: 7 });
  const typedRange = $derived(resolveRange(typedSelection));
  let plainSelection = $state.raw<RangeSelection>({ mode: "relative", days: 30 });
  let frSelection = $state.raw<RangeSelection>({ mode: "relative", days: 30 });
  const frPresets = [
    { label: "2 sem.", longLabel: "Deux dernières semaines", days: 14 },
    { label: "30 j", longLabel: "30 derniers jours", days: 30 },
  ];
  let noPresetSelection = $state.raw<RangeSelection>({
    mode: "custom",
    from: "2026-06-01",
    to: "2026-06-07",
  });
  let setSelection = $state.raw<RangeSelection>({ mode: "relative", days: 7 });
  // A set committed earlier, as an app would restore it from storage.
  const savedSet: RangeSelection = {
    mode: "custom",
    from: "2026-06-05",
    to: "2026-06-12",
    dates: ["2026-06-05", "2026-06-12"],
    label: "Fridays",
  };
  // A stored set whose app kept only the days.
  const unboundedSet: RangeSelection = {
    mode: "custom",
    from: "",
    to: "",
    dates: ["2026-03-06", "2026-03-13"],
    label: "Fridays",
  };

  let blockSelection = $state.raw<RangeSelection>({
    mode: "custom",
    from: "2025-07-11",
    to: "2026-07-10",
  });
</script>

<DemoSection
  title="Relative / Calendar / Custom"
  description="One trigger, three tabs: rolling presets, steppable day/week/month periods, and a custom from/to span picked with two clicks on the embedded calendar. This instance uses zh-CN to demonstrate localized calendar chrome with locale-independent ISO custom bounds."
  code={`<DateRangePicker
  {selection}
  onSelect={(sel) => (selection = sel)}
  earliestDate="2025-02-16"
  locale="zh-CN"
/>`}
>
  <DateRangePicker
    {selection}
    onSelect={(sel) => (selection = sel)}
    {earliestDate}
    locale="zh-CN"
  />
  <span class="readout">
    <code>{JSON.stringify(selection)}</code>
    <code>resolved: {resolved.from} → {resolved.to}</code>
  </span>
  <div class="external-row">
    <Button
      size="sm"
      surface="soft"
      label="External: mid-pick custom"
      onclick={() => (selection = { mode: "custom", from: monthStart, to: "" })}
    />
    <Button
      size="sm"
      surface="soft"
      label="External: last 30 days"
      onclick={() => (selection = { mode: "relative", days: 30 })}
    />
    <Button
      size="sm"
      surface="soft"
      label="External: last 7 days"
      onclick={() => (selection = { mode: "relative", days: 7 })}
    />
    <Button
      size="sm"
      surface="soft"
      label="External: this calendar month"
      onclick={() => (selection = { mode: "calendar", unit: "month", anchor: monthStart })}
    />
    <Button
      size="sm"
      surface="soft"
      label="External: cross-year custom"
      onclick={() => (selection = { mode: "custom", from: "2025-07-11", to: "2026-07-10" })}
    />
  </div>
</DemoSection>

<DemoSection
  title="Right-aligned with a max date"
  description="align='right' hangs the panel off the trigger's right edge (for toolbar corners); maxDate disables stepping the calendar past today."
  code={`<DateRangePicker {selection} onSelect={...} align="right" maxDate={todayStr()} />`}
>
  <div class="right-rail">
    <DateRangePicker
      selection={pinnedSelection}
      onSelect={(sel) => (pinnedSelection = sel)}
      {earliestDate}
      align="right"
      maxDate={todayStr()}
    />
  </div>
</DemoSection>

<DemoSection
  title="Block trigger"
  description="block stretches the trigger and panel to the container width, for vertical sidebars."
  code={`<DateRangePicker {selection} onSelect={...} block />`}
>
  <div class="sidebar-slot">
    <DateRangePicker
      selection={blockSelection}
      onSelect={(sel) => (blockSelection = sel)}
      {earliestDate}
      block
    />
  </div>
</DemoSection>

<DemoSection
  title="Sunday-start weeks"
  code={'<DateRangePicker weekStart="sunday" {selection} onSelect={onSelect} />'}
>
  <div data-testid="sunday-picker">
    <DateRangePicker
      selection={sundaySelection}
      weekStart="sunday"
      onSelect={(value) => (sundaySelection = value)}
    />
    <output>{sundayRange.from} → {sundayRange.to}</output>
  </div>
</DemoSection>

<DemoSection
  title="Type the dates"
  description="Every picker has a text field at the top of its popover: type “last 30 days”, “Sep 10 to Oct 20”, “since March” or “this month”. Ghost text finishes the word (Tab or → takes it), the Custom tab previews the range with a summary and day count, and Enter commits it as a custom range. Text that isn't a date or range shows a hint and changes nothing."
  code={`<DateRangePicker {selection} onSelect={(sel) => (selection = sel)} locale="en-US" />`}
>
  <div data-testid="typed-range-picker" class="typed-demo">
    <DateRangePicker
      selection={typedSelection}
      onSelect={(sel) => (typedSelection = sel)}
      locale="en-US"
    />
    <output data-testid="typed-range-selection">{JSON.stringify(typedSelection)}</output>
    <output data-testid="typed-range-bounds">{typedRange.from} → {typedRange.to}</output>
  </div>
</DemoSection>

<DemoSection
  title="Typed windows and presets"
  description="A typed rolling window (“last 2 weeks”, “past 30 days”) whose length matches an offered preset commits that preset, exactly as clicking its pill does, so the app keeps a rolling window. Other lengths, or a picker with presets={[]}, commit a custom range."
  code={`<DateRangePicker {selection} onSelect={...} presets={[{ label: "2 sem.", longLabel: "Deux dernières semaines", days: 14 }, ...]} />
<DateRangePicker {selection} onSelect={...} presets={[]} />`}
>
  <div data-testid="fr-presets-picker" class="typed-demo">
    <DateRangePicker
      selection={frSelection}
      onSelect={(sel) => (frSelection = sel)}
      presets={frPresets}
      locale="en-US"
    />
    <output data-testid="fr-presets-selection">{JSON.stringify(frSelection)}</output>
  </div>
  <div data-testid="no-presets-picker" class="typed-demo">
    <DateRangePicker
      selection={noPresetSelection}
      onSelect={(sel) => (noPresetSelection = sel)}
      presets={[]}
      locale="en-US"
    />
    <output data-testid="no-presets-selection">{JSON.stringify(noPresetSelection)}</output>
  </div>
</DemoSection>

<DemoSection
  title="Sets of separate days"
  description="dateSets lets typed text pick separate days: “last 3 Fridays”, “weekends since October”, “weekdays this month”, “Mondays in March”. The calendar marks each day on its own, the summary names the set, and Enter commits a custom selection whose dates lists the days. Pass that selection back in and the picker shows the set again."
  code={`<DateRangePicker {selection} onSelect={(sel) => (selection = sel)} dateSets />
// sel.mode === "custom" && sel.dates → ["2026-10-30", "2026-11-06", ...], sel.label → "Fridays"`}
>
  <div data-testid="set-range-picker" class="typed-demo">
    <DateRangePicker
      selection={setSelection}
      onSelect={(sel) => (setSelection = sel)}
      locale="en-US"
      dateSets
    />
    <output data-testid="set-range-selection">{JSON.stringify(setSelection)}</output>
    <Button
      size="sm"
      surface="soft"
      label="External: saved Fridays"
      onclick={() => (setSelection = savedSet)}
    />
    <Button
      size="sm"
      surface="soft"
      label="External: Fridays without bounds"
      onclick={() => (setSelection = unboundedSet)}
    />
  </div>
</DemoSection>

<DemoSection
  title="Without text entry"
  description="textEntry={false} leaves out the text field, for popovers with no room for it."
  code={`<DateRangePicker {selection} onSelect={...} textEntry={false} />`}
>
  <div data-testid="no-text-entry-picker">
    <DateRangePicker
      selection={plainSelection}
      onSelect={(sel) => (plainSelection = sel)}
      textEntry={false}
    />
  </div>
</DemoSection>

<style>
  .typed-demo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    font-size: var(--font-size-sm);
  }

  .readout {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .external-row {
    display: flex;
    gap: var(--space-3);
  }

  .right-rail {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }

  .sidebar-slot {
    width: 240px;
    padding: var(--space-4);
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-md);
  }
</style>
