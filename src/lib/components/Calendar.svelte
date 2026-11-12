<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import {
    activityStep,
    formatDayLabel,
    formatMonthLabel,
    monthGridDates,
    monthLabels,
    periodBounds,
    stepAnchor,
    todayStr,
    weekdayLabels,
    type CalendarNavLabels,
    type WeekStart,
    type DateRange,
  } from "./date-range.js";

  interface Props extends CalendarNavLabels {
    /** First weekday for calendar layout and week selection. */
    weekStart?: WeekStart | undefined;
    /** Any date inside the visible month (YYYY-MM-DD, bindable). */
    month?: string;
    /** Inclusive range to highlight (e.g. the current selection). */
    selected?: DateRange | null;
    /** Called with the clicked date (YYYY-MM-DD). */
    onpick?: (date: string) => void;
    /** Dates after this are disabled; paging into fully-later months too. */
    maxDate?: string | null;
    /** BCP 47 tag for month/weekday/day names, for apps whose language
     * setting can diverge from the browser locale. Omitted = browser locale.
     * (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    locale?: string | undefined;
    /** Activity per day, keyed by `YYYY-MM-DD`: a count such as messages or
     * documents. Days with a count are shaded in four steps and their
     * accessible label includes it. */
    activity?: Readonly<Record<string, number>> | null;
    /** Shade step (0–4) for a day's count, for apps with their own scale.
     * Defaults to quarters of the busiest day in view. */
    activityScale?: ((count: number, date: string) => number) | undefined;
    /** Text for a day's count in its accessible label, after the date. */
    activityLabel?: (count: number) => string;
    /** "grid" is the six-week month grid; "strip" is the visible month as
     * one horizontal row of weekday/number cells. */
    layout?: "grid" | "strip" | undefined;
    /** Days to mark with a dot, such as days matching the app's filters.
     * Independent of activity, selection and pickability. */
    matches?: ((date: string) => boolean) | undefined;
    /** Text appended to a marked day's accessible label. */
    matchLabel?: string | undefined;
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
    locale = undefined,
    weekStart = "monday",
    activity = null,
    activityScale = undefined,
    activityLabel = (count: number) => (count === 1 ? "1 item" : `${count} items`),
    layout = "grid",
    matches = undefined,
    matchLabel = "matches filters",
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

  const strip = $derived(layout === "strip");
  // The strip has a static month label, so it always shows days.
  const dayView = $derived(strip || view === "days");
  const weekdays = $derived(weekdayLabels(locale, weekStart));
  const narrowWeekdays = $derived(strip ? weekdayLabels(locale, weekStart, "narrow") : []);
  const today = todayStr();

  const cells = $derived(monthGridDates(month, weekStart));
  const monthPrefix = $derived(month.slice(0, 7));
  // The rendered days, each with its index in the six-week grid (its
  // weekday column). The strip keeps only the visible month's own days.
  const days = $derived(
    cells
      .map((date, index) => ({ date, index }))
      .filter(({ date }) => !strip || date.startsWith(monthPrefix)),
  );
  const nextMonthDisabled = $derived.by(() => {
    if (maxDate == null) return false;
    return periodBounds("month", stepAnchor("month", month, 1)).from > maxDate;
  });

  const year = $derived(Number.parseInt(month.slice(0, 4), 10));
  // Years page in fixed 12-slot blocks so paging is stable regardless of
  // which year inside the block is anchored.
  const yearBlockStart = $derived(zoomYear - (zoomYear % 12));
  const yearCells = $derived(Array.from({ length: 12 }, (_, i) => yearBlockStart + i));
  const maxMonthPrefix = $derived(maxDate?.slice(0, 7) ?? null);
  const maxYear = $derived(maxDate == null ? null : Number.parseInt(maxDate.slice(0, 4), 10));

  function monthKey(y: number, monthIndex: number): string {
    return `${y}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  // The month and year grids are the same 12-slot picker over different
  // units; each cell carries what the shared markup needs.
  interface UnitCell {
    label: string;
    value: number;
    current: boolean;
    disabled: boolean;
    aria: string | undefined;
  }

  const unitCells = $derived.by((): UnitCell[] => {
    if (view === "months") {
      return monthLabels("short", locale).map((label, i) => ({
        label,
        value: i,
        current: monthKey(zoomYear, i) === monthPrefix,
        disabled: maxMonthPrefix != null && monthKey(zoomYear, i) > maxMonthPrefix,
        // Full "January 2026" via the locale's own month/year order ("2026年
        // 1月") rather than concatenating name + year English-style.
        aria: formatMonthLabel(`${monthKey(zoomYear, i)}-01`, locale),
      }));
    }
    return yearCells.map((y) => ({
      label: String(y),
      value: y,
      current: y === year,
      disabled: maxYear != null && y > maxYear,
      aria: undefined,
    }));
  });

  function pickUnit(value: number): void {
    if (view === "months") {
      month = `${monthKey(zoomYear, value)}-01`;
      view = "days";
    } else {
      zoomYear = value;
      view = "months";
    }
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
    if (dayView) {
      month = stepAnchor("month", month, delta);
      // A strip that pages returns to the grid's days, not a stale zoom.
      view = "days";
    } else if (view === "months") {
      zoomYear += delta;
    } else {
      zoomYear += delta * 12;
    }
  }

  // Per-view header/nav facts in one place instead of parallel ternaries.
  const nav = $derived.by(() => {
    if (dayView) {
      return {
        prevLabel: previousMonthLabel,
        nextLabel: nextMonthLabel,
        nextDisabled: nextMonthDisabled,
        headerLabel: formatMonthLabel(month, locale),
        headerHint: strip ? null : chooseMonthLabel,
      };
    }
    if (view === "months") {
      return {
        prevLabel: previousYearLabel,
        nextLabel: nextYearLabel,
        nextDisabled: maxYear != null && zoomYear + 1 > maxYear,
        headerLabel: String(zoomYear),
        headerHint: chooseYearLabel,
      };
    }
    return {
      prevLabel: previousYearsLabel,
      nextLabel: nextYearsLabel,
      nextDisabled: maxYear != null && yearBlockStart + 12 > maxYear,
      headerLabel: `${yearBlockStart}–${yearBlockStart + 11}`,
      headerHint: null,
    };
  });

  // The busiest day among the rendered cells, so the default steps use the
  // whole range of shades in every month.
  const activityMax = $derived.by(() => {
    if (activity == null) return 0;
    let max = 0;
    for (const { date } of days) max = Math.max(max, countOf(date) ?? 0);
    return max;
  });

  // A non-finite count (NaN from a failed conversion, Infinity) is no data,
  // so it can't blank the other days' shades or reach a label.
  function countOf(date: string): number | undefined {
    const count = activity?.[date];
    return count !== undefined && Number.isFinite(count) ? count : undefined;
  }

  function activityStepOf(date: string, count: number): number {
    if (activityScale == null) return activityStep(count, activityMax);
    const step = Math.round(activityScale(count, date));
    return Number.isFinite(step) ? Math.min(4, Math.max(0, step)) : 0;
  }

  function dayLabel(
    date: string,
    index: number,
    count: number | undefined,
    matched: boolean,
  ): string {
    let label = formatDayLabel(date, locale);
    // The strip shows the weekday, so its label names it too.
    if (strip) label = `${weekdays[index % 7]}, ${label}`;
    if (count != null) label += `, ${activityLabel(count)}`;
    return matched ? `${label}, ${matchLabel}` : label;
  }

  // Saturday and Sunday, from the day's weekday column.
  function isWeekend(index: number): boolean {
    const column = index % 7;
    return weekStart === "sunday" ? column === 0 || column === 6 : column >= 5;
  }

  // The strip scrolls inside itself, so a selected day late in the month
  // can start out of view. After the month, selection or layout changes,
  // scroll the track (never the page or focus) to show the first selected day.
  let track = $state<HTMLElement | null>(null);
  $effect(() => {
    void [monthPrefix, selected?.from, selected?.to];
    if (track == null) return;
    const cell = track.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (cell == null) {
      // Nothing selected in this month: start it at day 1.
      track.scrollLeft = 0;
      return;
    }
    const box = track.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    if (rect.left < box.left) track.scrollLeft -= box.left - rect.left;
    else if (rect.right > box.right) track.scrollLeft += rect.right - box.right;
  });

  function inRange(date: string): boolean {
    return selected != null && date >= selected.from && date <= selected.to;
  }
</script>

<div class={["kit-calendar", className]} class:kit-calendar--strip={strip}>
  <div class="kit-calendar__header">
    <button
      class="kit-calendar__nav kit-control-states"
      type="button"
      onclick={() => navStep(-1)}
      aria-label={nav.prevLabel}
    >
      <ChevronLeftIcon size="14" strokeWidth="2" aria-hidden="true" />
    </button>
    {#if nav.headerHint == null}
      <!-- Nothing to zoom out to — a plain label, not a button. -->
      <span class="kit-calendar__month" aria-live="polite">
        {nav.headerLabel}
      </span>
    {:else}
      <button
        class="kit-calendar__month kit-calendar__month--button kit-control-states"
        type="button"
        aria-live="polite"
        aria-label="{nav.headerLabel}. {nav.headerHint}"
        onclick={headerZoomOut}
      >
        {nav.headerLabel}
      </button>
    {/if}
    <button
      class="kit-calendar__nav kit-control-states"
      type="button"
      disabled={nav.nextDisabled}
      onclick={() => navStep(1)}
      aria-label={nav.nextLabel}
    >
      <ChevronRightIcon size="14" strokeWidth="2" aria-hidden="true" />
    </button>
  </div>

  {#snippet dayCells()}
    {#each days as { date, index } (date)}
      {@const selectedDay = inRange(date)}
      {@const band = selectedDay && !strip}
      {@const count = countOf(date)}
      {@const step = count == null ? 0 : activityStepOf(date, count)}
      {@const matched = matches?.(date) === true}
      {@const dayNumber = Number.parseInt(date.slice(8), 10)}
      <button
        class="kit-calendar__day kit-control-states"
        class:outside={!date.startsWith(monthPrefix)}
        class:today={date === today}
        class:selected={band}
        class:range-start={band && date === selected?.from}
        class:range-end={band && date === selected?.to}
        class:fill-above={band && index >= 7 && inRange(cells[index - 7]!)}
        class:strip
        class:outlined={selectedDay && strip}
        class:weekend={strip && isWeekend(index)}
        type="button"
        data-activity={step > 0 ? step : undefined}
        disabled={maxDate != null && date > maxDate}
        aria-label={dayLabel(date, index, count, matched)}
        aria-pressed={selectedDay}
        onclick={() => onpick?.(date)}
      >
        {#if strip}
          <span class="kit-calendar__day-weekday">{narrowWeekdays[index % 7]}</span>
          <span class="kit-calendar__day-number">{dayNumber}</span>
        {:else}
          {dayNumber}
        {/if}
        {#if matched}
          <span class="kit-calendar__match" aria-hidden="true"></span>
        {/if}
      </button>
    {/each}
  {/snippet}

  {#if strip}
    <div class="kit-calendar__strip" bind:this={track}>
      {@render dayCells()}
    </div>
  {:else if view === "days"}
    <div class="kit-calendar__weekdays" aria-hidden="true">
      {#each weekdays as day (day)}
        <span class="kit-calendar__weekday">{day}</span>
      {/each}
    </div>

    <div class="kit-calendar__grid">
      {@render dayCells()}
    </div>
  {:else}
    <div class="kit-calendar__unit-grid">
      {#each unitCells as cell (cell.label)}
        <button
          class="kit-calendar__unit kit-control-states"
          class:current={cell.current}
          type="button"
          disabled={cell.disabled}
          aria-label={cell.aria}
          onclick={() => pickUnit(cell.value)}
        >
          {cell.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .kit-calendar {
    /* Range-interior tint, shared by the cell background and the seam
     * fill between adjacent selected cells. */
    --kit-calendar-range-bg: color-mix(in srgb, var(--accent-blue) 14%, transparent);
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
    font-weight: var(--font-weight-semibold, 600);
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
    transition: background var(--transition-fast) var(--transition-ease, ease);
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
      background var(--transition-fast) var(--transition-ease, ease),
      color var(--transition-fast) var(--transition-ease, ease);
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
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-muted);
    text-align: center;
    text-transform: var(--label-transform, uppercase);
    letter-spacing: var(--letter-spacing-label, 0.02em);
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
  }

  /* Day cells and the drill-down month/year cells are the same button
   * recipe at different sizes. */
  .kit-calendar__day,
  .kit-calendar__unit {
    box-sizing: border-box;
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
      background var(--transition-fast) var(--transition-ease, ease),
      color var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-calendar__day {
    width: 30px;
    height: 26px;
  }

  .kit-calendar__day:not(.strip):hover:not(:disabled),
  .kit-calendar__unit:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  /* Hovering a selected day deepens the band instead of swapping it for
   * the grey hover surface — the selection must stay legible under the
   * pointer (it sits there right after a pick). Range ends keep their
   * solid pill. */
  .kit-calendar__day.selected:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-blue) 24%, transparent);
    color: var(--accent-blue);
  }

  .kit-calendar__day.range-start:hover:not(:disabled),
  .kit-calendar__day.range-end:hover:not(:disabled) {
    background: var(--accent-blue);
    color: var(--bg-surface);
  }

  /* Activity shading: four tints of one accent, mixed toward transparent so
   * the calendar reads the same on a page or inside a popover. Selection
   * and hover rules come later and take over the background. Set
   * --kit-calendar-activity-color to shade in another accent. */
  .kit-calendar__day[data-activity] {
    --kit-calendar-activity: var(--kit-calendar-activity-color, var(--accent-green));
  }

  .kit-calendar__day[data-activity="1"] {
    background: color-mix(in srgb, var(--kit-calendar-activity) 12%, transparent);
  }

  .kit-calendar__day[data-activity="2"] {
    background: color-mix(in srgb, var(--kit-calendar-activity) 22%, transparent);
  }

  .kit-calendar__day[data-activity="3"] {
    background: color-mix(in srgb, var(--kit-calendar-activity) 33%, transparent);
    color: var(--text-primary);
  }

  .kit-calendar__day[data-activity="4"] {
    background: color-mix(in srgb, var(--kit-calendar-activity) 44%, transparent);
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
    position: relative;
    background: var(--kit-calendar-range-bg);
    color: var(--accent-blue);
    border-radius: 0;
    opacity: 1;
  }

  /* The range must read as one contiguous region — no grid seams inside
   * it. ::before fills the 1px column gap to the left of every selected
   * cell with a selected neighbor there (range-start owns the band's
   * left edge; first-column cells have the grid edge to their left).
   * ::after fills the 1px row gap above cells whose same-column neighbor
   * in the row above is selected (the .fill-above class — the component
   * computes it, since CSS can't see the cell above); it reaches 1px
   * left to also cover the four-cell corner pinhole, except in the first
   * column where that would poke past the grid edge. */
  .kit-calendar__day.selected:not(.range-start):not(:nth-child(7n + 1))::before {
    content: "";
    position: absolute;
    left: -1px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--kit-calendar-range-bg);
  }

  .kit-calendar__day.fill-above::after {
    content: "";
    position: absolute;
    left: -1px;
    right: 0;
    top: -1px;
    height: 1px;
    background: var(--kit-calendar-range-bg);
  }

  .kit-calendar__day.fill-above:nth-child(7n + 1)::after {
    left: 0;
  }

  /* Range ends are solid pills so start/end read at a glance; the
   * squared inner edge flows into the tinted band. */
  .kit-calendar__day.range-start,
  .kit-calendar__day.range-end {
    background: var(--accent-blue);
    color: var(--bg-surface);
  }

  .kit-calendar__day.range-start {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  .kit-calendar__day.range-end {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .kit-calendar__day.range-start.range-end {
    border-radius: var(--radius-sm);
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
    height: 32px;
  }

  /* The currently-anchored month/year gets the same inset ring as today
   * in the day grid — a position marker, not a selection. */
  .kit-calendar__unit.current {
    box-shadow: inset 0 0 0 1px var(--border-default);
    color: var(--text-primary);
  }

  /* Filter-match dot: decorative (the label says it), below the number,
   * and separate from the range seam pseudo-elements. Only marked days are
   * positioned, so other days keep their paint order under focus rings. */
  .kit-calendar__day:has(> .kit-calendar__match) {
    position: relative;
  }

  .kit-calendar__match {
    position: absolute;
    bottom: 2px;
    left: 50%;
    width: 4px;
    height: 4px;
    margin-left: -2px;
    border-radius: 50%;
    background: var(--accent-blue);
    pointer-events: none;
  }

  .kit-calendar__day.range-start .kit-calendar__match,
  .kit-calendar__day.range-end .kit-calendar__match {
    background: var(--bg-surface);
  }

  /* Strip layout: the month label and arrows, then the month's days in one
   * row that wraps below the header when narrow and scrolls inside itself. */
  .kit-calendar--strip {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-width: 0;
  }

  .kit-calendar--strip .kit-calendar__header {
    flex: none;
    white-space: nowrap;
  }

  /* Wide enough for long month names, so paging doesn't move the arrows. */
  .kit-calendar--strip .kit-calendar__month {
    min-width: 8.5em;
  }

  .kit-calendar__strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(20px, 1fr);
    gap: var(--space-1);
    flex: 1 1 280px;
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }

  .kit-calendar__day.strip {
    flex-direction: column;
    gap: var(--space-1);
    width: auto;
    height: auto;
    padding: var(--space-2) 0 var(--space-4);
  }

  .kit-calendar__day-weekday {
    font-size: var(--font-size-2xs);
    line-height: 1;
  }

  .kit-calendar__day.weekend .kit-calendar__day-weekday {
    color: var(--text-muted);
  }

  .kit-calendar__day-number {
    line-height: 1.2;
  }

  /* Hover and today are 1px rings, so the activity fill stays visible. */
  .kit-calendar__day.strip:hover:not(:disabled) {
    box-shadow: inset 0 0 0 1px var(--border-default);
    color: var(--text-primary);
  }

  /* Selected strip days keep their activity fill under a 2px outline. */
  .kit-calendar__day.outlined,
  .kit-calendar__day.outlined:hover:not(:disabled) {
    box-shadow: inset 0 0 0 2px var(--accent-blue);
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold, 600);
  }

  /* Last so it outranks the equal-specificity .outside/.selected rules. */
  .kit-calendar__day:disabled,
  .kit-calendar__unit:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
