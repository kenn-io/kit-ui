<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { tick } from "svelte";
  import { autoReposition, dismissable } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import Calendar from "./Calendar.svelte";
  import DatePhraseInput, { focusOnOpen } from "./DatePhraseInput.svelte";
  import { datePhraseRange, parseDatePhrase } from "./date-phrase.js";
  import SegmentedControl, { type SegmentedControlOption } from "./SegmentedControl.svelte";
  import {
    DEFAULT_RANGE_PRESETS,
    daysInRange,
    formatDateRangeLabel,
    formatDayLabel,
    formatMonthLabel,
    formatShortDate,
    formatWeekOfLabel,
    periodBounds,
    resolveRange,
    todayStr,
    type CalendarNavLabels,
    type WeekStart,
    type CalendarUnit,
    type DateRange,
    type RangeMode,
    type RangePreset,
    type RangeSelection,
  } from "./date-range.js";

  interface Props extends CalendarNavLabels {
    /** First weekday for calendar layout and week selection. */
    weekStart?: WeekStart | undefined;
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
    /** BCP 47 tag for calendar-mode trigger labels and the embedded calendar.
     * Complete custom ranges deliberately stay as canonical YYYY-MM-DD so
     * cross-year bounds are unambiguous in every locale. Omitted = browser
     * locale. (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    locale?: string | undefined;
    /** Show the text field for typing dates ("last 30 days", "Sep 10 to
     * Oct 20", "since March") above the tabs. */
    textEntry?: boolean;
    /** Placeholder of the text field. */
    textEntryPlaceholder?: string;
    /** Accessible name of the text field. */
    textEntryLabel?: string;
    /** The text field's clear button label. */
    textEntryClearLabel?: string;
    /** The line under the text field while nothing is typed. */
    textEntryHint?: string;
    /** Shown when Enter is pressed on text that isn't a date or range. */
    noMatchLabel?: string;
    /** Day count after a typed range's dates in the summary line. */
    dayCountLabel?: (count: number) => string;
    /** Let typed text pick a set of separate days ("last 3 Fridays",
     * "weekends since October"). A set commits as a `custom` selection
     * whose `dates` lists the days and `label` names them; `from`/`to` are
     * its first and last day. Off by default. */
    dateSets?: boolean;
    /** Set names in the summary and trigger. One weekday is named from the
     * locale ("Fridays"). */
    weekendsLabel?: string;
    weekdaysLabel?: string;
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
    weekStart = "monday",
    textEntry = true,
    textEntryPlaceholder = "What dates are you looking for?",
    textEntryLabel = "Type dates",
    textEntryClearLabel = "Clear",
    textEntryHint = "Type or select dates.",
    noMatchLabel = "No dates match that. Try “last 30 days” or “Sep 10 to Oct 20”.",
    dayCountLabel = (count: number) => (count === 1 ? "1 day" : `${count} days`),
    dateSets = false,
    weekendsLabel = "Weekends",
    weekdaysLabel = "Weekdays",
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
  // The committed set's days, when the selection is one.
  let customDates = $state<string[] | null>(null);
  // Two-click range pick on the Custom tab: true after the first click,
  // meaning the next pick completes the range.
  let customPending = $state(false);
  let customMonth = $state<string>(todayStr());
  // Value snapshot of the committed selection the pending draft was started
  // against — by value, not object identity, so a parent mutating in place
  // or recreating an equivalent object compares correctly. Only read inside
  // seed()/pick handlers, so a plain (non-reactive) variable.
  let pendingFor: string | null = null;

  // Typed entry. `phrase` is the text and `typed` the range it parses to
  // right now (a single date is a one-day range). `typedPreview` is what the
  // Custom tab shows as its draft: it follows the text after a short pause
  // and holds while a phrase is incomplete, so the grid doesn't flicker on
  // every keystroke. Nothing commits until Enter.
  let phrase = $state("");
  // A typed range, or with `dateSets` a set: its days plus first and last.
  // A rolling window that matches an offered preset carries it.
  type TypedPick = DateRange & { dates?: string[]; label?: string; preset?: RangePreset };
  let typedPreview = $state<TypedPick | null>(null);
  let noMatch = $state(false);
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  const typed = $derived.by((): TypedPick | null => {
    const result = parseDatePhrase(phrase, {
      locale,
      weekStart,
      maxDate,
      earliestDate,
      sets: dateSets,
      weekendsLabel,
      weekdaysLabel,
    });
    const span = datePhraseRange(result);
    if (!span) return null;
    if (result.kind === "dates") return { ...span, dates: result.dates, label: result.label };
    // "last 30 days" with a 30-day preset on offer commits that preset, so
    // the app gets the rolling window its pill gives, not a frozen range.
    const preset =
      result.kind !== "none" && result.rollingDays
        ? presets.find((p) => p.days > 0 && p.days === result.rollingDays)
        : undefined;
    return preset ? { ...span, preset } : span;
  });

  // "Fridays · Oct 30 – Nov 13, 2026 · 3 days" for a set; without the
  // label for a range.
  function describe(pick: TypedPick): string {
    const days = dayCountLabel(pick.dates?.length ?? daysInRange(pick.from, pick.to));
    const span = formatDateRangeLabel(pick.from, pick.to, locale);
    const name = pick.preset?.longLabel ?? pick.label;
    return name ? `${name} · ${span} · ${days}` : `${span} · ${days}`;
  }

  // Describes what the calendar shows: the current parse, or the preview
  // held while the text is incomplete, so the line and the grid agree.
  const phraseSummary = $derived.by(() => {
    if (noMatch) return noMatchLabel;
    const shown = typed ?? typedPreview;
    return shown ? describe(shown) : "";
  });

  function resetPhrase(): void {
    clearTimeout(previewTimer);
    phrase = "";
    typedPreview = null;
    noMatch = false;
  }

  function handlePhraseInput(): void {
    noMatch = false;
    clearTimeout(previewTimer);
    if (phrase.trim() === "") {
      // Emptied: back to the draft, and to the month that shows it.
      if (typedPreview) customMonth = customTo || customFrom || todayStr();
      typedPreview = null;
      return;
    }
    const next = typed;
    if (!next) return;
    previewTimer = setTimeout(() => {
      typedPreview = next;
      // A preset match previews as its pill; anything else on the calendar.
      tab = next.preset ? "relative" : "custom";
      customMonth = next.from;
    }, 100);
  }

  function submitPhrase(): void {
    if (typed?.preset) {
      // Exactly what clicking the pill does.
      const { days } = typed.preset;
      tab = "relative";
      applyRelative(days);
    } else if (typed) {
      const { from, to, dates, label } = typed;
      // Clear the text too, so a second Enter doesn't emit again.
      resetPhrase();
      tab = "custom";
      customMonth = from;
      commitCustom(from, to, dates, label);
    } else if (phrase.trim() !== "") {
      noMatch = true;
    }
  }

  function selectionKey(sel: RangeSelection): string {
    if (sel.mode === "relative") return `relative:${sel.days}`;
    if (sel.mode === "calendar") return `calendar:${sel.unit}:${sel.anchor}`;
    return `custom:${sel.from}:${sel.to}:${sel.dates?.join(",") ?? ""}`;
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
      formatShortDate(periodBounds("week", anchor, weekStart).from, locale),
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
    if (selection.dates?.length) {
      const days = dayCountLabel(selection.dates.length);
      return selection.label ? `${selection.label} · ${days}` : days;
    }
    if (!selection.from || !selection.to) return customRangeLabel;
    if (selection.from === selection.to) return selection.from;
    return `${selection.from} - ${selection.to}`;
  });

  // The period the calendar highlights: the day/week/month around the
  // current anchor.
  const calSelected = $derived(periodBounds(calUnit, calAnchor, weekStart));

  // While an end pick is pending only the start day highlights. A typed
  // phrase's preview shows in place of the draft until it commits or
  // the user clicks a day.
  const calCustomSelected = $derived.by((): DateRange | null => {
    if (typedPreview) return typedPreview.dates ? null : typedPreview;
    if (customDates) return null;
    return customFrom ? { from: customFrom, to: customTo || customFrom } : null;
  });
  // A set's separate days, typed or committed.
  const calCustomDates = $derived(typedPreview ? (typedPreview.dates ?? null) : customDates);

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
    const resolved = resolveRange(selection, earliestDate, weekStart);
    customFrom = selection.mode === "custom" ? selection.from : resolved.from;
    customTo = selection.mode === "custom" ? selection.to : resolved.to;
    customDates = selection.mode === "custom" && selection.dates?.length ? selection.dates : null;
    // A controlled selection with only `from` is a range mid-pick: stay
    // armed so the next click completes it instead of restarting. Re-key
    // the draft to THIS selection either way — a full reseed that leaves
    // an older key behind would let a later reopen under the old selection
    // adopt this draft as its own.
    customPending = customFrom !== "" && customTo === "";
    pendingFor = customPending ? selectionKey(selection) : null;
    calMonth = calAnchor;
    // A set with no usable bounds still opens on its first day's month.
    customMonth = customTo || customFrom || customDates?.[0] || todayStr();
  }

  let panelEl = $state<HTMLDivElement>();
  let panelStyle = $state("");
  let compactPanel = $state(false);

  // Fixed positioning (shared popover contract) so the panel escapes
  // overflow-hidden ancestors; align maps left/right onto the trigger's
  // start/end edge and block mode pins the panel to the trigger width.
  function positionPanel(): void {
    if (!containerEl || !panelEl) return;
    const trigger = containerEl.getBoundingClientRect();
    const desiredWidth = block ? Math.max(240, trigger.width) : 360;
    const width = Math.min(desiredWidth, Math.max(0, window.innerWidth - 16));
    compactPanel = width < 360;
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
    resetPhrase();
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
    const resolved = resolveRange(sel, earliestDate, weekStart);
    customFrom = resolved.from;
    customTo = resolved.to;
    customDates = null;
    customPending = false;
    pendingFor = null;
    customMonth = resolved.to;
  }

  function applyRelative(days: number): void {
    resetPhrase();
    const sel: RangeSelection = { mode: "relative", days };
    calAnchor = resolveRange(sel, earliestDate, weekStart).to;
    syncCustomFields(sel);
    onSelect(sel);
  }

  function applyCalendar(unit: CalendarUnit, anchor: string): void {
    resetPhrase();
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
    // A click takes over from typed text: the two-click pick starts fresh
    // from the clicked day, even if a click was pending before the typing.
    // A shown set gives way the same way.
    if (typedPreview !== null || phrase.trim() !== "" || customDates) {
      customPending = false;
      pendingFor = null;
      customDates = null;
    }
    resetPhrase();
    const currentSelectionKey = selectionKey(selection);
    if (!customPending || currentSelectionKey !== pendingFor) {
      customFrom = date;
      customTo = "";
      customPending = true;
      pendingFor = currentSelectionKey;
      return;
    }
    if (date < customFrom) commitCustom(date, customFrom);
    else commitCustom(customFrom, date);
  }

  // Both ways a custom range commits, the completing second click and Enter
  // on a typed phrase, end here: ordered bounds, draft cleared, one emit.
  function commitCustom(from: string, to: string, dates?: string[], label?: string): void {
    customPending = false;
    pendingFor = null;
    customFrom = from;
    customTo = to;
    customDates = dates ?? null;
    onSelect(dates ? { mode: "custom", from, to, dates, label } : { mode: "custom", from, to });
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
        dismiss: () => {
          open = false;
          resetPhrase();
        },
        escapeFocus: () => triggerEl,
      }),
      // Tab switches / calendar paging change the panel's height — track it
      // so a picker opened near the viewport bottom doesn't keep a stale top.
      autoReposition(() => [panelEl, triggerEl, containerEl], positionPanel),
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
        class="kit-date-range-picker__pill kit-control-states"
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
    class="kit-date-range-picker__trigger kit-control-states"
    class:open
    type="button"
    title={label}
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
      {#if textEntry}
        <DatePhraseInput
          bind:value={phrase}
          class="kit-date-range-picker__phrase"
          placeholder={textEntryPlaceholder}
          ariaLabel={textEntryLabel}
          clearLabel={textEntryClearLabel}
          summary={phraseSummary}
          hint={textEntryHint}
          invalid={noMatch}
          {locale}
          sets={dateSets}
          autofocus={focusOnOpen()}
          oninput={handlePhraseInput}
          onsubmit={submitPhrase}
        />
      {/if}
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
            // While a typed preset match previews, its pill is the one lit.
            active: typedPreview?.preset
              ? typedPreview.preset.days === preset.days
              : isRelativeActive(preset.days),
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
            {weekStart}
            onpick={(date) => applyCalendar(calUnit, date)}
          />
        </div>
      {:else}
        <!-- Readout: the range is picked on the calendar below (two clicks)
             or typed in the field above; the highlighted endpoint is the one
             the next click sets. -->
        <div
          class="kit-date-range-picker__endpoints"
          class:compact={compactPanel}
          aria-live="polite"
        >
          <span class="kit-date-range-picker__endpoint" class:active={!customPending}>
            <span class="kit-date-range-picker__endpoint-label">{fromLabel}</span>
            <span class="kit-date-range-picker__endpoint-value">
              {typedPreview?.from ?? (customFrom || "…")}
            </span>
          </span>
          <span class="kit-date-range-picker__endpoint" class:active={customPending}>
            <span class="kit-date-range-picker__endpoint-label">{toLabel}</span>
            <span class="kit-date-range-picker__endpoint-value">
              {typedPreview?.to ?? (customTo || "…")}
            </span>
          </span>
        </div>
        <div class="kit-date-range-picker__calendar">
          <Calendar
            bind:month={customMonth}
            selected={calCustomSelected}
            selectedDates={calCustomDates}
            {maxDate}
            {...calendarLabels}
            {locale}
            {weekStart}
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
    min-width: 0;
    justify-content: space-between;
  }

  .kit-date-range-picker__trigger {
    height: 28px;
    /* Hold a stable width so the label changing (e.g. "Jun 19" vs
       "Mar 26 - Apr 25") never resizes the button and shifts neighbors. */
    width: 168px;
    min-width: 168px;
    padding: 0 var(--space-4);
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color var(--transition-fast) var(--transition-ease, ease),
      background var(--transition-fast) var(--transition-ease, ease);
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
    min-width: 0;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }

  .kit-date-range-picker__trigger-chevron {
    display: inline-flex;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: transform var(--transition-fast) var(--transition-ease, ease);
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

  .kit-date-range-picker__panel :global(.kit-date-range-picker__phrase) {
    margin-bottom: var(--space-4);
  }

  /* The mode switch is a stock SegmentedControl; only the panel spacing
   * lives here. */
  .kit-date-range-picker__tabs {
    margin-bottom: var(--space-4);
  }

  /* Two tiers of one choice. The mode tabs are the primary control; the
   * chosen mode's options hang under them as a lower tier. The tier starts
   * flush against the track's bottom edge with a straight, square top, and
   * is inset so the track overhangs it on both sides. Its top row is one
   * contact line across its full width, drawn over a quiet hairline ring so
   * the top corners stay square (a border join would leave a blended corner
   * pixel). Its fill, height, and type sit a step below the track; radii,
   * flat options, and the shared selected pill match SegmentedControl. */
  .kit-date-range-picker__tabs:has(+ .kit-date-range-picker__pills) {
    margin-bottom: 0;
  }

  .kit-date-range-picker__pills {
    --kit-date-range-picker-presets-radius: var(--kit-control-radius, var(--radius-sm));
    --kit-date-range-picker-presets-fill: color-mix(
      in srgb,
      var(--bg-inset) 68%,
      var(--bg-popover, var(--bg-surface))
    );
    --kit-date-range-picker-presets-edge: color-mix(
      in srgb,
      var(--border-default) 50%,
      var(--border-muted)
    );
    --kit-date-range-picker-presets-contact: color-mix(
      in srgb,
      var(--border-default) 75%,
      var(--border-muted)
    );
    display: flex;
    gap: 1px;
    margin: 0 calc(var(--space-6) + 4px);
    /* One pixel more above and below than the track, for the contact line
     * and so tier fill shows around the chosen preset. */
    padding: 3px;
    border-radius: 0 0 var(--kit-date-range-picker-presets-radius)
      var(--kit-date-range-picker-presets-radius);
    background: var(--kit-date-range-picker-presets-fill);
    /* The first shadow paints on top: the contact line covers the ring's
     * top row, corners included. */
    box-shadow:
      inset 0 1px 0 var(--kit-date-range-picker-presets-contact),
      inset 0 0 0 1px var(--kit-date-range-picker-presets-edge);
  }

  /* Dark: the tier sits a step above the near-black track with a quiet
   * outline, and a near-black contact line shows the track resting on it. */
  :global(:root.dark) .kit-date-range-picker__pills {
    --kit-date-range-picker-presets-fill: color-mix(
      in srgb,
      var(--bg-inset) 35%,
      var(--bg-popover, var(--bg-surface))
    );
    --kit-date-range-picker-presets-edge: color-mix(
      in srgb,
      var(--text-primary) 17%,
      var(--bg-surface)
    );
    --kit-date-range-picker-presets-contact: color-mix(in srgb, #000 55%, transparent);
  }

  .kit-date-range-picker__pill {
    flex: 1;
    /* A floor, not a fixed height: the label is rem, so the touch scale or
     * a larger browser font can outgrow 17px, and the option and its tier
     * grow with it. No block padding, so the label alone decides when. */
    min-height: 17px;
    padding-block: 0;
    border: 0;
    border-radius: max(0px, calc(var(--kit-date-range-picker-presets-radius) - 1px));
    background: transparent;
    /* The same ink as the unselected mode tabs. */
    color: var(--text-muted);
    font-family: inherit;
    /* A step below the mode labels, so the shared selected pill on a
     * preset still reads as the lesser choice. */
    font-size: calc(var(--kit-control-font-size, var(--font-size-xs)) - 1px);
    font-weight: 400;
    cursor: pointer;
    transition:
      background var(--transition-fast) var(--transition-ease, ease),
      color var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-date-range-picker__pill:hover:not(.active) {
    color: var(--text-primary);
  }

  .kit-date-range-picker__pill.active {
    background: var(--selected-strong-bg);
    color: var(--text-primary);
    font-weight: var(--selected-strong-weight);
    box-shadow: var(--shadow-raised, var(--selected-strong-edge));
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

  .kit-date-range-picker__endpoints.compact {
    flex-direction: column;
  }

  .kit-date-range-picker__endpoints.compact .kit-date-range-picker__endpoint {
    flex: none;
    width: 100%;
  }

  /* The accent border marks the endpoint the next calendar click sets. */
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
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-md);
    transition: border-color var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-date-range-picker__endpoint.active {
    border-color: var(--accent-blue);
  }

  .kit-date-range-picker__endpoint-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-muted);
  }

  .kit-date-range-picker__endpoint-value {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
