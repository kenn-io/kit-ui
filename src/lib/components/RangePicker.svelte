<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import {
    DEFAULT_RANGE_PRESETS,
    formatDayLabel,
    formatMonthLabel,
    formatShortDate,
    periodBounds,
    resolveRange,
    stepAnchor,
    todayStr,
    type CalendarUnit,
    type RangeMode,
    type RangePreset,
    type RangeSelection,
  } from "./range-picker.js";

  interface Props {
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
    /** Prefix for the week step label, e.g. "Week of Jun 29". */
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
    previousPeriodLabel?: string;
    nextPeriodLabel?: string;
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
    previousPeriodLabel = "Previous period",
    nextPeriodLabel = "Next period",
  }: Props = $props();

  let open = $state(false);
  let containerEl: HTMLDivElement | undefined = $state();

  // Working state for the panel, seeded from `selection` by seed() each time
  // it opens so switching tabs never loses the current range. Edits emit
  // immediately, so these stay consistent with the committed selection while
  // open. `tab` starts on a constant; seed() sets the real tab before the
  // panel ever renders.
  let tab = $state<RangeMode>("relative");
  let calUnit = $state<CalendarUnit>("week");
  let calAnchor = $state<string>(todayStr());
  let customFrom = $state<string>("");
  let customTo = $state<string>("");

  const tabs = $derived<{ mode: RangeMode; label: string }[]>([
    { mode: "relative", label: relativeTabLabel },
    { mode: "calendar", label: calendarTabLabel },
    { mode: "custom", label: customTabLabel },
  ]);

  const calendarUnits = $derived<{ unit: CalendarUnit; label: string }[]>([
    { unit: "day", label: dayLabel },
    { unit: "week", label: weekLabel },
    { unit: "month", label: monthLabel },
  ]);

  function calendarLabelFor(unit: CalendarUnit, anchor: string): string {
    if (unit === "day") return formatDayLabel(anchor);
    if (unit === "month") return formatMonthLabel(anchor);
    return `${weekOfLabel} ${formatShortDate(periodBounds("week", anchor).from)}`;
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
    if (selection.from === selection.to) return formatShortDate(selection.from);
    return `${formatShortDate(selection.from)} - ${formatShortDate(selection.to)}`;
  });

  const stepLabel = $derived(calendarLabelFor(calUnit, calAnchor));
  // Disable Next when the entire next period lies beyond maxDate (a period
  // that merely contains maxDate is still reachable). Only consumers that
  // pass maxDate are guarded.
  const nextDisabled = $derived.by(() => {
    if (maxDate == null) return false;
    const next = stepAnchor(calUnit, calAnchor, 1);
    return periodBounds(calUnit, next).from > maxDate;
  });

  function seed(): void {
    tab = selection.mode;
    if (selection.mode === "calendar") {
      calUnit = selection.unit;
      calAnchor = selection.anchor;
    } else {
      calUnit = "week";
      calAnchor =
        selection.mode === "custom" && selection.to ? selection.to : todayStr();
    }
    const resolved = resolveRange(selection, earliestDate);
    customFrom = selection.mode === "custom" ? selection.from : resolved.from;
    customTo = selection.mode === "custom" ? selection.to : resolved.to;
  }

  function toggleOpen(): void {
    open = !open;
    if (open) seed();
  }

  function isRelativeActive(days: number): boolean {
    return selection.mode === "relative" && selection.days === days;
  }

  // Keep the Custom tab's inputs in step with the latest committed selection
  // so switching tabs after picking a preset edits that range, not a stale
  // seed.
  function syncCustomFields(sel: RangeSelection): void {
    const resolved = resolveRange(sel, earliestDate);
    customFrom = resolved.from;
    customTo = resolved.to;
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
    const sel: RangeSelection = { mode: "calendar", unit, anchor };
    syncCustomFields(sel);
    onSelect(sel);
  }

  function step(dir: -1 | 1): void {
    if (dir === 1 && nextDisabled) return;
    let next = stepAnchor(calUnit, calAnchor, dir);
    // Clamp so the anchor itself never lands past maxDate even when the
    // next period straddles it.
    if (dir === 1 && maxDate != null && next > maxDate) next = maxDate;
    applyCalendar(calUnit, next);
  }

  function commitCustom(): void {
    if (!customFrom || !customTo) return;
    // Normalize a reversed range so consumers always get ordered bounds;
    // reflect it in the inputs.
    if (customFrom > customTo) {
      const earlier = customTo;
      customTo = customFrom;
      customFrom = earlier;
    }
    onSelect({ mode: "custom", from: customFrom, to: customTo });
  }

  $effect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent): void {
      if (containerEl && !containerEl.contains(e.target as Node)) {
        open = false;
      }
    }

    function handleKeydown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        open = false;
      }
    }

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<div
  class="kit-range-picker"
  class:kit-range-picker--busy={busy}
  class:kit-range-picker--block={block}
  bind:this={containerEl}
  aria-busy={busy}
>
  <button
    class="kit-range-picker__trigger"
    class:open
    type="button"
    onclick={toggleOpen}
    aria-haspopup="dialog"
    aria-expanded={open}
  >
    <span class="kit-range-picker__trigger-icon" aria-hidden="true">
      <CalendarIcon size="13" strokeWidth="2" />
    </span>
    <span class="kit-range-picker__trigger-label">{label}</span>
    <span class="kit-range-picker__trigger-chevron" class:open aria-hidden="true">
      <ChevronDownIcon size="11" strokeWidth="2.2" />
    </span>
  </button>

  {#if open}
    <div
      class="kit-range-picker__panel"
      class:kit-range-picker__panel--right={align === "right"}
      role="dialog"
      aria-label={dialogLabel}
    >
      <div class="kit-range-picker__tabs" role="tablist">
        {#each tabs as t (t.mode)}
          <button
            class="kit-range-picker__tab"
            class:active={tab === t.mode}
            type="button"
            role="tab"
            aria-selected={tab === t.mode}
            onclick={() => (tab = t.mode)}
          >
            {t.label}
          </button>
        {/each}
      </div>

      {#if tab === "relative"}
        <div class="kit-range-picker__pills" role="group" aria-label={relativeGroupLabel}>
          {#each presets as preset (preset.days)}
            <button
              class="kit-range-picker__pill"
              class:active={isRelativeActive(preset.days)}
              type="button"
              onclick={() => applyRelative(preset.days)}
            >
              {preset.label}
            </button>
          {/each}
        </div>
      {:else if tab === "calendar"}
        <div class="kit-range-picker__pills" role="group" aria-label={calendarGroupLabel}>
          {#each calendarUnits as u (u.unit)}
            <button
              class="kit-range-picker__pill"
              class:active={calUnit === u.unit}
              type="button"
              onclick={() => applyCalendar(u.unit, calAnchor)}
            >
              {u.label}
            </button>
          {/each}
        </div>
        <div class="kit-range-picker__stepper">
          <button
            class="kit-range-picker__arrow"
            type="button"
            onclick={() => step(-1)}
            aria-label={previousPeriodLabel}
          >
            <ChevronLeftIcon size="15" strokeWidth="2" aria-hidden="true" />
          </button>
          <span class="kit-range-picker__step-label">{stepLabel}</span>
          <button
            class="kit-range-picker__arrow"
            type="button"
            onclick={() => step(1)}
            disabled={nextDisabled}
            aria-label={nextPeriodLabel}
          >
            <ChevronRightIcon size="15" strokeWidth="2" aria-hidden="true" />
          </button>
        </div>
      {:else}
        <div class="kit-range-picker__fields">
          <label class="kit-range-picker__field">
            <span>{fromLabel}</span>
            <input
              type="date"
              class="kit-range-picker__date-input"
              bind:value={customFrom}
              onchange={commitCustom}
            />
          </label>
          <label class="kit-range-picker__field">
            <span>{toLabel}</span>
            <input
              type="date"
              class="kit-range-picker__date-input"
              bind:value={customTo}
              onchange={commitCustom}
            />
          </label>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .kit-range-picker {
    position: relative;
    display: inline-flex;
  }

  .kit-range-picker--block {
    display: flex;
    width: 100%;
  }

  .kit-range-picker--block .kit-range-picker__trigger {
    width: 100%;
    justify-content: space-between;
  }

  .kit-range-picker--block .kit-range-picker__panel {
    width: 100%;
    min-width: 240px;
  }

  .kit-range-picker__trigger {
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
    transition: border-color 0.12s, background 0.12s;
  }

  .kit-range-picker__trigger:hover {
    background: var(--bg-surface-hover);
  }

  .kit-range-picker__trigger.open {
    border-color: var(--accent-blue);
  }

  .kit-range-picker--busy .kit-range-picker__trigger {
    opacity: 0.7;
  }

  .kit-range-picker__trigger-icon {
    display: inline-flex;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .kit-range-picker__trigger-label {
    flex: 1;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }

  .kit-range-picker__trigger-chevron {
    display: inline-flex;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: transform 0.15s;
  }

  .kit-range-picker__trigger-chevron.open {
    transform: rotate(180deg);
  }

  .kit-range-picker__panel {
    position: absolute;
    top: calc(100% + var(--space-3));
    left: 0;
    z-index: 100;
    width: 264px;
    background: var(--bg-surface);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: var(--space-4);
  }

  .kit-range-picker__panel--right {
    left: auto;
    right: 0;
  }

  .kit-range-picker__tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-4);
  }

  .kit-range-picker__tab {
    flex: 1;
    height: 26px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .kit-range-picker__tab:hover {
    color: var(--text-secondary);
  }

  .kit-range-picker__tab.active {
    background: var(--bg-surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .kit-range-picker__pills {
    display: flex;
    gap: var(--space-2);
  }

  .kit-range-picker__pill {
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
    transition: background 0.1s, color 0.1s;
  }

  .kit-range-picker__pill:hover {
    background: var(--bg-surface-hover);
  }

  .kit-range-picker__pill.active {
    background: var(--accent-blue);
    color: var(--accent-blue-foreground, #fff);
  }

  .kit-range-picker__stepper {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .kit-range-picker__arrow {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    background: var(--bg-inset);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.1s, color 0.1s, opacity 0.1s;
  }

  .kit-range-picker__arrow:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-range-picker__arrow:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .kit-range-picker__step-label {
    flex: 1;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .kit-range-picker__fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .kit-range-picker__field {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .kit-range-picker__field > span {
    width: 36px;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--text-muted);
  }

  .kit-range-picker__date-input {
    flex: 1;
    height: 30px;
    padding: 0 var(--space-4);
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    transition: border-color 0.12s;
  }

  .kit-range-picker__date-input:focus {
    outline: none;
    border-color: var(--accent-blue);
  }
</style>
