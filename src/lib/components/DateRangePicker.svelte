<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { tick } from "svelte";
  import { autoReposition, dismissable } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import Calendar from "./Calendar.svelte";
  import SegmentedControl, { type SegmentedControlOption } from "./SegmentedControl.svelte";
  import {
    DEFAULT_RANGE_PRESETS,
    formatDayLabel,
    formatMonthLabel,
    formatShortDate,
    formatWeekOfLabel,
    periodBounds,
    resolveRange,
    todayStr,
    type CalendarNavLabels,
    type CalendarUnit,
    type DateRange,
    type RangeMode,
    type RangePreset,
    type RangeSelection,
  } from "./date-range.js";

  interface Props extends CalendarNavLabels {
    selection: RangeSelection;
    onSelect: (selection: RangeSelection) => void;
    /** Dim the trigger while the consumer reloads data. */
    busy?: boolean;
    /** Earliest known data date (YYYY-MM-DD); anchors the "All" preset. */
    earliestDate?: string | null;
    /** Popover edge alignment. Defaults to left. */
    align?: "left" | "right";
    /** Disable Next stepping past this date (YYYY-MM-DD). */
    maxDate?: string | null;
    /** Stretch the trigger to fill its container (for vertical sidebars). */
    block?: boolean;
    /** Relative presets shown as pills; override to relabel or reduce. */
    presets?: RangePreset[];
    relativeTabLabel?: string;
    calendarTabLabel?: string;
    customTabLabel?: string;
    dayLabel?: string;
    weekLabel?: string;
    monthLabel?: string;
    /** Week trigger label. A "{date}" placeholder is substituted with the
     * week-start date ("{date}所在周"); without one the label is a prefix
     * ("Week of" → "Week of Jun 29"). */
    weekOfLabel?: string;
    /** Trigger label template for non-preset relative windows. */
    lastDaysLabel?: string;
    /** Trigger label for an incomplete custom range. */
    customRangeLabel?: string;
    fromLabel?: string;
    toLabel?: string;
    dialogLabel?: string;
    relativeGroupLabel?: string;
    calendarGroupLabel?: string;
    /** BCP 47 tag for the date labels on the trigger and calendar, for apps
     * whose language setting can diverge from the browser locale. Omitted =
     * browser locale. (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    locale?: string | undefined;
  }

  let {
    selection,
    onSelect,
    busy = false,
    earliestDate = null,
    align = "left",
    maxDate = null,
    block = false,
    presets = DEFAULT_RANGE_PRESETS,
    relativeTabLabel = "Relative",
    calendarTabLabel = "Calendar",
    customTabLabel = "Custom",
    dayLabel = "Day",
    weekLabel = "Week",
    monthLabel = "Month",
    weekOfLabel = "Week of",
    lastDaysLabel = "Last {days} days",
    customRangeLabel = "Custom range",
    fromLabel = "From",
    toLabel = "To",
    dialogLabel = "Select date range",
    relativeGroupLabel = "Relative window",
    calendarGroupLabel = "Calendar period",
    locale = undefined,
    // Calendar's nav/drill-down labels, forwarded verbatim so Calendar's
    // own English defaults stay the single source.
    ...calendarLabels
  }: Props = $props();

  let open = $state(false);
  let containerEl: HTMLDivElement | undefined = $state();
  let triggerEl: HTMLButtonElement | undefined = $state();

  // Working state for the panel, seeded from `selection` by seed() each time
  // it opens so switching tabs never loses the current range. Edits emit
  // immediately, so these stay consistent with the committed selection while
  // open. `tab` starts on a constant; seed() sets the real tab before the
  // panel ever renders.
  let tab = $state<RangeMode>("relative");
  let calUnit = $state<CalendarUnit>("week");
  let calAnchor = $state<string>(todayStr());
  let calMonth = $state<string>(todayStr());
  let customFrom = $state<string>("");
  let customTo = $state<string>("");
  // Two-click range pick on the Custom tab: true after the first click,
  // meaning the next pick completes the range.
  let customPending = $state(false);
  let customMonth = $state<string>(todayStr());
  // Value snapshot of the committed selection the pending draft was started
  // against — by value, not object identity, so a parent mutating in place
  // or recreating an equivalent object compares correctly. Only read inside
  // seed()/pick handlers, so a plain (non-reactive) variable.
  let pendingFor: string | null = null;

  function selectionKey(sel: RangeSelection): string {
    if (sel.mode === "relative") return `relative:${sel.days}`;
    if (sel.mode === "calendar") return `calendar:${sel.unit}:${sel.anchor}`;
    return `custom:${sel.from}:${sel.to}`;
  }

  const tabs = $derived<SegmentedControlOption[]>([
    { value: "relative", label: relativeTabLabel },
    { value: "calendar", label: calendarTabLabel },
    { value: "custom", label: customTabLabel },
  ]);

  const calendarUnits = $derived<{ unit: CalendarUnit; label: string }[]>([
    { unit: "day", label: dayLabel },
    { unit: "week", label: weekLabel },
    { unit: "month", label: monthLabel },
  ]);

  function calendarLabelFor(unit: CalendarUnit, anchor: string): string {
    if (unit === "day") return formatDayLabel(anchor, locale);
    if (unit === "month") return formatMonthLabel(anchor, locale);
    return formatWeekOfLabel(
      weekOfLabel,
      formatShortDate(periodBounds("week", anchor).from, locale),
    );
  }

  /** Short label for the trigger button reflecting the current selection. */
  const label = $derived.by(() => {
    if (selection.mode === "relative") {
      const preset = presets.find((p) => p.days === selection.days);
      if (preset) return preset.longLabel;
      return lastDaysLabel.replace("{days}", String(selection.days));
    }
    if (selection.mode === "calendar") {
      return calendarLabelFor(selection.unit, selection.anchor);
    }
    if (!selection.from || !selection.to) return customRangeLabel;
    if (selection.from === selection.to) return formatShortDate(selection.from, locale);
    return `${formatShortDate(selection.from, locale)} - ${formatShortDate(selection.to, locale)}`;
  });

  // The period the calendar highlights: the day/week/month around the
  // current anchor.
  const calSelected = $derived(periodBounds(calUnit, calAnchor));

  // While an end pick is pending only the start day highlights.
  const calCustomSelected = $derived<DateRange | null>(
    customFrom ? { from: customFrom, to: customTo || customFrom } : null,
  );

  function seed(): void {
    // A mid-pick draft survives dismiss/reopen — an Escape between the two
    // clicks shouldn't discard the chosen start — but only while the
    // committed selection is the one the draft was started against; a
    // selection swapped in from outside makes the draft stale.
    if (customPending && selectionKey(selection) === pendingFor) {
      tab = "custom";
      return;
    }
    tab = selection.mode;
    reseedFromSelection();
  }

  // Everything seed() resets except the active tab: calendar unit/anchor/
  // month plus the custom draft fields. Also the drift path, where the tab
  // is deliberately left alone — an open panel shouldn't switch tabs under
  // the user just because the parent swapped the selection.
  function reseedFromSelection(): void {
    if (selection.mode === "calendar") {
      calUnit = selection.unit;
      calAnchor = selection.anchor;
    } else {
      calUnit = "week";
      calAnchor = selection.mode === "custom" && selection.to ? selection.to : todayStr();
    }
    const resolved = resolveRange(selection, earliestDate);
    customFrom = selection.mode === "custom" ? selection.from : resolved.from;
    customTo = selection.mode === "custom" ? selection.to : resolved.to;
    // A controlled selection with only `from` is a range mid-pick: stay
    // armed so the next click completes it instead of restarting. Re-key
    // the draft to THIS selection either way — a full reseed that leaves
    // an older key behind would let a later reopen under the old selection
    // adopt this draft as its own.
    customPending = customFrom !== "" && customTo === "";
    pendingFor = customPending ? selectionKey(selection) : null;
    calMonth = calAnchor;
    customMonth = customTo || customFrom || todayStr();
  }

  let panelEl = $state<HTMLDivElement>();
  let panelStyle = $state("");

  // Fixed positioning (shared popover contract) so the panel escapes
  // overflow-hidden ancestors; align maps left/right onto the trigger's
  // start/end edge and block mode pins the panel to the trigger width.
  function positionPanel(): void {
    if (!containerEl || !panelEl) return;
    const trigger = containerEl.getBoundingClientRect();
    const width = block ? Math.max(240, trigger.width) : 264;
    panelStyle = `${floatingPopoverStyle({
      trigger,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: width,
      popoverHeight: panelEl.offsetHeight,
      align: align === "right" ? "end" : "start",
      triggerGap: 6,
    })}; width: ${Math.round(width)}px`;
  }

  async function toggleOpen(): Promise<void> {
    open = !open;
    if (open) {
      seed();
      await tick();
      positionPanel();
    }
  }

  function isRelativeActive(days: number): boolean {
    return selection.mode === "relative" && selection.days === days;
  }

  // Keep the Custom tab's range in step with the latest committed selection
  // so switching tabs after picking a preset edits that range, not a stale
  // seed.
  function syncCustomFields(sel: RangeSelection): void {
    const resolved = resolveRange(sel, earliestDate);
    customFrom = resolved.from;
    customTo = resolved.to;
    customPending = false;
    pendingFor = null;
    customMonth = resolved.to;
  }

  function applyRelative(days: number): void {
    const sel: RangeSelection = { mode: "relative", days };
    calAnchor = resolveRange(sel, earliestDate).to;
    syncCustomFields(sel);
    onSelect(sel);
  }

  function applyCalendar(unit: CalendarUnit, anchor: string): void {
    calUnit = unit;
    calAnchor = anchor;
    calMonth = anchor;
    const sel: RangeSelection = { mode: "calendar", unit, anchor };
    syncCustomFields(sel);
    onSelect(sel);
  }

  // The classic two-click range: the first pick starts a range, the second
  // completes it (an earlier second click swaps the ends so consumers always
  // get ordered bounds), and only a complete range commits.
  function pickCustomDay(date: string): void {
    const currentSelectionKey = selectionKey(selection);
    if (!customPending || currentSelectionKey !== pendingFor) {
      customFrom = date;
      customTo = "";
      customPending = true;
      pendingFor = currentSelectionKey;
      return;
    }
    customPending = false;
    pendingFor = null;
    if (date < customFrom) {
      customTo = customFrom;
      customFrom = date;
    } else {
      customTo = date;
    }
    onSelect({ mode: "custom", from: customFrom, to: customTo });
  }

  // Invalidate while closed too: a selection A -> B -> A round trip before
  // reopening still means the draft that started under the first A is stale.
  // Reseed the calendar state along with the custom fields — an open panel
  // whose calendar tab still shows the pre-drift unit/anchor would commit
  // the wrong period on the next pill click.
  $effect(() => {
    if (!customPending || selectionKey(selection) === pendingFor) return;
    reseedFromSelection();
  });

  $effect(() => {
    if (!open) return;
    const cleanups = [
      dismissable({
        owners: () => [containerEl],
        dismiss: () => (open = false),
        escapeFocus: () => triggerEl,
      }),
      // Tab switches / calendar paging change the panel's height — track it
      // so a picker opened near the viewport bottom doesn't keep a stale top.
      autoReposition(() => panelEl, positionPanel),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  });
</script>

{#snippet pillGroup(
  groupLabel: string,
  items: { key: string | number; label: string; active: boolean; pick: () => void }[],
)}
  <div class="kit-date-range-picker__pills" role="group" aria-label={groupLabel}>
    {#each items as item (item.key)}
      <button
        class="kit-date-range-picker__pill"
        class:active={item.active}
        type="button"
        onclick={item.pick}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/snippet}

<div
  class="kit-date-range-picker"
  class:kit-date-range-picker--busy={busy}
  class:kit-date-range-picker--block={block}
  bind:this={containerEl}
  aria-busy={busy}
>
  <button
    class="kit-date-range-picker__trigger"
    class:open
    type="button"
    bind:this={triggerEl}
    onclick={toggleOpen}
    aria-haspopup="dialog"
    aria-expanded={open}
  >
    <span class="kit-date-range-picker__trigger-icon" aria-hidden="true">
      <CalendarIcon size="13" strokeWidth="2" />
    </span>
    <span class="kit-date-range-picker__trigger-label">{label}</span>
    <span class="kit-date-range-picker__trigger-chevron" class:open aria-hidden="true">
      <ChevronDownIcon size="11" strokeWidth="2.2" />
    </span>
  </button>

  {#if open}
    <div
      class="kit-date-range-picker__panel kit-popover-card"
      style={panelStyle}
      bind:this={panelEl}
      role="dialog"
      aria-label={dialogLabel}
    >
      <div class="kit-date-range-picker__tabs">
        <SegmentedControl
          block
          options={tabs}
          value={tab}
          onchange={(v) => (tab = v as RangeMode)}
        />
      </div>

      {#if tab === "relative"}
        {@render pillGroup(
          relativeGroupLabel,
          presets.map((preset) => ({
            key: preset.days,
            label: preset.label,
            active: isRelativeActive(preset.days),
            pick: () => applyRelative(preset.days),
          })),
        )}
      {:else if tab === "calendar"}
        {@render pillGroup(
          calendarGroupLabel,
          calendarUnits.map((u) => ({
            key: u.unit,
            label: u.label,
            active: calUnit === u.unit,
            pick: () => applyCalendar(u.unit, calAnchor),
          })),
        )}
        <div class="kit-date-range-picker__calendar">
          <Calendar
            bind:month={calMonth}
            selected={calSelected}
            {maxDate}
            {...calendarLabels}
            {locale}
            onpick={(date) => applyCalendar(calUnit, date)}
          />
        </div>
      {:else}
        <!-- Readout, not inputs: the range is picked on the calendar below
             (two clicks); the highlighted endpoint is the one the next
             click sets. -->
        <div class="kit-date-range-picker__endpoints" aria-live="polite">
          <span class="kit-date-range-picker__endpoint" class:active={!customPending}>
            <span class="kit-date-range-picker__endpoint-label">{fromLabel}</span>
            <span class="kit-date-range-picker__endpoint-value">
              {customFrom ? formatShortDate(customFrom, locale) : "…"}
            </span>
          </span>
          <span class="kit-date-range-picker__endpoint" class:active={customPending}>
            <span class="kit-date-range-picker__endpoint-label">{toLabel}</span>
            <span class="kit-date-range-picker__endpoint-value">
              {customTo ? formatShortDate(customTo, locale) : "…"}
            </span>
          </span>
        </div>
        <div class="kit-date-range-picker__calendar">
          <Calendar
            bind:month={customMonth}
            selected={calCustomSelected}
            {maxDate}
            {...calendarLabels}
            {locale}
            onpick={pickCustomDay}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .kit-date-range-picker {
    position: relative;
    display: inline-flex;
  }

  .kit-date-range-picker--block {
    display: flex;
    width: 100%;
  }

  .kit-date-range-picker--block .kit-date-range-picker__trigger {
    width: 100%;
    justify-content: space-between;
  }

  .kit-date-range-picker__trigger {
    height: 28px;
    /* Hold a stable width so the label changing (e.g. "Jun 19" vs
       "Mar 26 - Apr 25") never resizes the button and shifts neighbors. */
    min-width: 168px;
    padding: 0 var(--space-4);
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color var(--transition-fast),
      background var(--transition-fast);
  }

  .kit-date-range-picker__trigger:hover {
    background: var(--bg-surface-hover);
  }

  .kit-date-range-picker__trigger.open {
    border-color: var(--accent-blue);
  }

  .kit-date-range-picker--busy .kit-date-range-picker__trigger {
    opacity: 0.7;
  }

  .kit-date-range-picker__trigger-icon {
    display: inline-flex;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .kit-date-range-picker__trigger-label {
    flex: 1;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }

  .kit-date-range-picker__trigger-chevron {
    display: inline-flex;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: transform var(--transition-fast);
  }

  .kit-date-range-picker__trigger-chevron.open {
    transform: rotate(180deg);
  }

  .kit-date-range-picker__panel {
    position: fixed;
    box-sizing: border-box;
    z-index: var(--z-popover);
    padding: var(--space-4);
  }

  /* The mode switch is a stock SegmentedControl; only the panel spacing
   * lives here. */
  .kit-date-range-picker__tabs {
    margin-bottom: var(--space-4);
  }

  .kit-date-range-picker__pills {
    display: flex;
    gap: var(--space-2);
  }

  .kit-date-range-picker__pill {
    flex: 1;
    height: 30px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--bg-inset);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .kit-date-range-picker__pill:hover {
    background: var(--bg-surface-hover);
  }

  .kit-date-range-picker__pill.active {
    background: var(--accent-blue);
    color: var(--accent-blue-foreground, #fff);
  }

  .kit-date-range-picker__calendar {
    display: flex;
    justify-content: center;
    margin-top: var(--space-4);
  }

  .kit-date-range-picker__endpoints {
    display: flex;
    gap: var(--space-2);
  }

  /* Sized like the pill rows above so the tabs read as one family; the
   * accent border marks the endpoint the next calendar click sets. */
  .kit-date-range-picker__endpoint {
    flex: 1;
    box-sizing: border-box;
    height: 30px;
    padding: 0 var(--space-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    background: var(--bg-inset);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    transition: border-color var(--transition-fast);
  }

  .kit-date-range-picker__endpoint.active {
    border-color: var(--accent-blue);
  }

  .kit-date-range-picker__endpoint-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--text-muted);
  }

  .kit-date-range-picker__endpoint-value {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
