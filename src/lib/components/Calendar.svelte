<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import {
    formatDayLabel,
    formatMonthLabel,
    monthGridDates,
    periodBounds,
    stepAnchor,
    todayStr,
    weekdayLabels,
    type DateRange,
  } from "./range-picker.js";

  interface Props {
    /** Any date inside the visible month (YYYY-MM-DD, bindable). */
    month?: string;
    /** Inclusive range to highlight (e.g. the current selection). */
    selected?: DateRange | null;
    /** Called with the clicked date (YYYY-MM-DD). */
    onpick?: (date: string) => void;
    /** Dates after this are disabled; paging into fully-later months too. */
    maxDate?: string | null;
    previousMonthLabel?: string;
    nextMonthLabel?: string;
    class?: string;
  }

  let {
    month = $bindable(todayStr()),
    selected = null,
    onpick = undefined,
    maxDate = null,
    previousMonthLabel = "Previous month",
    nextMonthLabel = "Next month",
    class: className = "",
  }: Props = $props();

  const weekdays = weekdayLabels();
  const today = todayStr();

  const cells = $derived(monthGridDates(month));
  const monthPrefix = $derived(month.slice(0, 7));
  const nextMonthDisabled = $derived.by(() => {
    if (maxDate == null) return false;
    return periodBounds("month", stepAnchor("month", month, 1)).from > maxDate;
  });

  function inRange(date: string): boolean {
    return selected != null && date >= selected.from && date <= selected.to;
  }
</script>

<div class={["kit-calendar", className]}>
  <div class="kit-calendar__header">
    <button
      class="kit-calendar__nav"
      type="button"
      onclick={() => (month = stepAnchor("month", month, -1))}
      aria-label={previousMonthLabel}
    >
      <ChevronLeftIcon size="14" strokeWidth="2" aria-hidden="true" />
    </button>
    <span class="kit-calendar__month" aria-live="polite">
      {formatMonthLabel(month)}
    </span>
    <button
      class="kit-calendar__nav"
      type="button"
      disabled={nextMonthDisabled}
      onclick={() => (month = stepAnchor("month", month, 1))}
      aria-label={nextMonthLabel}
    >
      <ChevronRightIcon size="14" strokeWidth="2" aria-hidden="true" />
    </button>
  </div>

  <div class="kit-calendar__weekdays" aria-hidden="true">
    {#each weekdays as day (day)}
      <span class="kit-calendar__weekday">{day}</span>
    {/each}
  </div>

  <div class="kit-calendar__grid">
    {#each cells as date (date)}
      {@const selectedDay = inRange(date)}
      <button
        class="kit-calendar__day"
        class:outside={!date.startsWith(monthPrefix)}
        class:today={date === today}
        class:selected={selectedDay}
        class:range-start={selectedDay && date === selected?.from}
        class:range-end={selectedDay && date === selected?.to}
        type="button"
        disabled={maxDate != null && date > maxDate}
        aria-label={formatDayLabel(date)}
        aria-pressed={selectedDay}
        onclick={() => onpick?.(date)}
      >
        {Number.parseInt(date.slice(8), 10)}
      </button>
    {/each}
  </div>
</div>

<style>
  .kit-calendar {
    display: inline-flex;
    flex-direction: column;
    gap: var(--space-2);
    user-select: none;
  }

  .kit-calendar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .kit-calendar__month {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
    flex: 1;
  }

  .kit-calendar__nav {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .kit-calendar__nav:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-calendar__nav:disabled {
    opacity: var(--opacity-disabled);
    cursor: default;
  }

  .kit-calendar__weekdays,
  .kit-calendar__grid {
    display: grid;
    grid-template-columns: repeat(7, 30px);
    gap: 1px;
  }

  .kit-calendar__weekday {
    font-size: var(--font-size-2xs);
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
  }

  .kit-calendar__day {
    box-sizing: border-box;
    width: 30px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .kit-calendar__day:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-calendar__day.outside {
    color: var(--text-muted);
    opacity: 0.55;
  }

  .kit-calendar__day.today {
    box-shadow: inset 0 0 0 1px var(--border-default);
  }

  .kit-calendar__day.selected {
    background: color-mix(in srgb, var(--accent-blue) 14%, transparent);
    color: var(--accent-blue);
    border-radius: 0;
    opacity: 1;
  }

  .kit-calendar__day.range-start {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  .kit-calendar__day.range-end {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .kit-calendar__day.range-start.range-end {
    border-radius: var(--radius-sm);
    background: var(--accent-blue);
    color: var(--bg-surface);
  }

  .kit-calendar__day:disabled {
    opacity: 0.35;
    cursor: default;
  }
  /* Normalized keyboard focus (gyp8): one ring token, :focus-visible only. */
  .kit-calendar__nav:focus-visible,
  .kit-calendar__day:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }
</style>
