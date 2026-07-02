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
    /** Nav labels while zoomed out to the month / year grids. */
    previousYearLabel?: string;
    nextYearLabel?: string;
    previousYearsLabel?: string;
    nextYearsLabel?: string;
    /** Appended to the header button's accessible name to hint at the drill-down. */
    chooseMonthLabel?: string;
    chooseYearLabel?: string;
    class?: string;
  }

  let {
    month = $bindable(todayStr()),
    selected = null,
    onpick = undefined,
    maxDate = null,
    previousMonthLabel = "Previous month",
    nextMonthLabel = "Next month",
    previousYearLabel = "Previous year",
    nextYearLabel = "Next year",
    previousYearsLabel = "Previous years",
    nextYearsLabel = "Next years",
    chooseMonthLabel = "Choose month",
    chooseYearLabel = "Choose year",
    class: className = "",
  }: Props = $props();

  // Drill-down view (standard date-component pattern): clicking the
  // header label zooms out days → months → years; picking an entry
  // drills back down. Browsing the zoomed grids is view-only: paging
  // and picking a year move only `zoomYear`, and the bound `month` (and
  // any selection) is committed exclusively by picking a month — so a
  // consumer with `bind:month` never observes mid-browse churn, and
  // returning to the day grid keeps the range highlight.
  let view = $state<"days" | "months" | "years">("days");
  let zoomYear = $state(0);

  const weekdays = weekdayLabels();
  const today = todayStr();

  const cells = $derived(monthGridDates(month));
  const monthPrefix = $derived(month.slice(0, 7));
  const nextMonthDisabled = $derived.by(() => {
    if (maxDate == null) return false;
    return periodBounds("month", stepAnchor("month", month, 1)).from > maxDate;
  });

  const year = $derived(Number.parseInt(month.slice(0, 4), 10));
  // Years page in fixed 12-slot blocks so paging is stable regardless of
  // which year inside the block is anchored.
  const yearBlockStart = $derived(zoomYear - (zoomYear % 12));
  const yearCells = $derived(
    Array.from({ length: 12 }, (_, i) => yearBlockStart + i),
  );
  const maxMonthPrefix = $derived(maxDate?.slice(0, 7) ?? null);
  const maxYear = $derived(
    maxDate == null ? null : Number.parseInt(maxDate.slice(0, 4), 10),
  );

  const monthNames: string[] = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString(undefined, { month: "short" }),
  );
  const monthFullNames: string[] = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString(undefined, { month: "long" }),
  );

  function monthAnchor(y: number, monthIndex: number): string {
    return `${y}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  }

  function monthCellDisabled(monthIndex: number): boolean {
    return (
      maxMonthPrefix != null &&
      monthAnchor(zoomYear, monthIndex).slice(0, 7) > maxMonthPrefix
    );
  }

  function pickMonth(monthIndex: number): void {
    month = monthAnchor(zoomYear, monthIndex);
    view = "days";
  }

  function pickYear(y: number): void {
    zoomYear = y;
    view = "months";
  }

  function headerZoomOut(): void {
    if (view === "days") {
      zoomYear = year;
      view = "months";
    } else if (view === "months") {
      view = "years";
    }
  }

  function navStep(delta: 1 | -1): void {
    if (view === "days") {
      month = stepAnchor("month", month, delta);
    } else if (view === "months") {
      zoomYear += delta;
    } else {
      zoomYear += delta * 12;
    }
  }

  const prevNavLabel = $derived(
    view === "days"
      ? previousMonthLabel
      : view === "months"
        ? previousYearLabel
        : previousYearsLabel,
  );
  const nextNavLabel = $derived(
    view === "days" ? nextMonthLabel : view === "months" ? nextYearLabel : nextYearsLabel,
  );
  const nextNavDisabled = $derived.by(() => {
    if (view === "days") return nextMonthDisabled;
    if (maxYear == null) return false;
    if (view === "months") return zoomYear + 1 > maxYear;
    return yearBlockStart + 12 > maxYear;
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
      onclick={() => navStep(-1)}
      aria-label={prevNavLabel}
    >
      <ChevronLeftIcon size="14" strokeWidth="2" aria-hidden="true" />
    </button>
    {#if view === "years"}
      <!-- Nothing to zoom out to — a plain label, not a button. -->
      <span class="kit-calendar__month" aria-live="polite">
        {yearBlockStart}–{yearBlockStart + 11}
      </span>
    {:else}
      <button
        class="kit-calendar__month kit-calendar__month--button"
        type="button"
        aria-live="polite"
        aria-label="{view === 'days'
          ? formatMonthLabel(month)
          : zoomYear}. {view === 'days' ? chooseMonthLabel : chooseYearLabel}"
        onclick={headerZoomOut}
      >
        {view === "days" ? formatMonthLabel(month) : zoomYear}
      </button>
    {/if}
    <button
      class="kit-calendar__nav"
      type="button"
      disabled={nextNavDisabled}
      onclick={() => navStep(1)}
      aria-label={nextNavLabel}
    >
      <ChevronRightIcon size="14" strokeWidth="2" aria-hidden="true" />
    </button>
  </div>

  {#if view === "days"}
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
  {:else if view === "months"}
    <div class="kit-calendar__unit-grid">
      {#each monthNames as name, i (name)}
        <button
          class="kit-calendar__unit"
          class:current={monthAnchor(zoomYear, i).slice(0, 7) === monthPrefix}
          type="button"
          disabled={monthCellDisabled(i)}
          aria-label="{monthFullNames[i]} {zoomYear}"
          onclick={() => pickMonth(i)}
        >
          {name}
        </button>
      {/each}
    </div>
  {:else}
    <div class="kit-calendar__unit-grid">
      {#each yearCells as y (y)}
        <button
          class="kit-calendar__unit"
          class:current={y === year}
          type="button"
          disabled={maxYear != null && y > maxYear}
          onclick={() => pickYear(y)}
        >
          {y}
        </button>
      {/each}
    </div>
  {/if}
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

  .kit-calendar__month--button {
    padding: 2px var(--space-2);
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    font-family: inherit;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .kit-calendar__month--button:hover {
    background: var(--bg-surface-hover);
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

  /* Month / year drill-down grids: 3 columns spanning the same width as
   * the 7-column day grid (7×30px columns + 6×1px gaps = 216px) so the
   * calendar doesn't jump horizontally when zooming. */
  .kit-calendar__unit-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    width: 216px;
  }

  .kit-calendar__unit {
    box-sizing: border-box;
    height: 32px;
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

  .kit-calendar__unit:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  /* The currently-anchored month/year gets the same inset ring as today
   * in the day grid — a position marker, not a selection. */
  .kit-calendar__unit.current {
    box-shadow: inset 0 0 0 1px var(--border-default);
    color: var(--text-primary);
  }

  .kit-calendar__unit:disabled {
    opacity: 0.35;
    cursor: default;
  }
  /* Normalized keyboard focus (gyp8): one ring token, :focus-visible only. */
  .kit-calendar__nav:focus-visible,
  .kit-calendar__month--button:focus-visible,
  .kit-calendar__day:focus-visible,
  .kit-calendar__unit:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }
</style>
