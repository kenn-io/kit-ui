<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { tick } from "svelte";
  import { autoReposition, dismissable } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import Calendar from "./Calendar.svelte";
  import DatePhraseInput from "./DatePhraseInput.svelte";
  import { parseDatePhrase } from "./date-phrase.js";
  import { formatDayLabel, todayStr, type CalendarNavLabels } from "./date-range.js";

  interface Props extends CalendarNavLabels {
    /** The chosen date (YYYY-MM-DD), or null when none is chosen yet. */
    value: string | null;
    /** Called with the picked date; the popover closes after a pick. */
    onchange: (date: string) => void;
    /** Trigger text while no date is chosen. */
    placeholder?: string;
    /** Accessible name for the trigger; the chosen date is appended. */
    ariaLabel?: string;
    /** Dates after this are disabled (YYYY-MM-DD). */
    maxDate?: string | null;
    disabled?: boolean;
    /** Popover edge alignment. Defaults to left. */
    align?: "left" | "right";
    /** Stretch the trigger to fill its container. */
    block?: boolean;
    dialogLabel?: string;
    /** BCP 47 tag for the trigger label and calendar. Omitted = browser
     * locale. (`| undefined` keeps exactOptionalPropertyTypes consumers
     * happy.) */
    locale?: string | undefined;
    /** Show the text field for typing a date ("tomorrow", "Sep 10",
     * "last Friday") above the calendar. */
    textEntry?: boolean;
    /** Placeholder of the text field. */
    textEntryPlaceholder?: string;
    /** Accessible name of the text field. */
    textEntryLabel?: string;
    /** The text field's clear button label. */
    textEntryClearLabel?: string;
    /** The line under the text field while nothing is typed. */
    textEntryHint?: string;
    /** Shown when Enter is pressed on text that isn't a date. */
    noMatchLabel?: string;
  }

  let {
    value,
    onchange,
    placeholder = "Choose a date",
    ariaLabel = "Date",
    maxDate = null,
    disabled = false,
    align = "left",
    block = false,
    dialogLabel = "Select date",
    locale = undefined,
    textEntry = true,
    textEntryPlaceholder = "Type a date",
    textEntryLabel = "Type a date",
    textEntryClearLabel = "Clear",
    textEntryHint = "Type or select a date.",
    noMatchLabel = "No date matches that. Try “tomorrow” or “Sep 10”.",
    ...calendarLabels
  }: Props = $props();

  let open = $state(false);
  let containerEl: HTMLDivElement | undefined = $state();
  let triggerEl: HTMLButtonElement | undefined = $state();
  let panelEl = $state<HTMLDivElement>();
  let panelStyle = $state("");
  // The month the calendar shows; reset to the chosen date on every open so
  // the selection is always in view.
  let month = $state<string>(todayStr());

  const label = $derived(value ? formatDayLabel(value, locale) : placeholder);

  // Typed entry. `phrase` is the text; `typed` is the date it parses to
  // right now, and `preview` is what the calendar shows as the pending
  // pick. The preview follows the text after a short pause and holds while
  // a phrase is incomplete, so the grid doesn't flicker on every keystroke.
  // Nothing commits until Enter.
  let phrase = $state("");
  let preview = $state<string | null>(null);
  let noMatch = $state(false);
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  const typed = $derived.by(() => {
    const result = parseDatePhrase(phrase, { locale, maxDate });
    return result.kind === "date" ? result.date : null;
  });

  const summary = $derived.by(() => {
    if (noMatch) return noMatchLabel;
    if (typed) return formatDayLabel(typed, locale);
    return textEntryHint;
  });

  function resetPhrase(): void {
    clearTimeout(previewTimer);
    phrase = "";
    preview = null;
    noMatch = false;
  }

  function handlePhraseInput(): void {
    noMatch = false;
    clearTimeout(previewTimer);
    if (phrase.trim() === "") {
      // Emptied: back to the chosen date's month.
      if (preview) month = value ?? todayStr();
      preview = null;
      return;
    }
    const next = typed;
    if (!next) return;
    previewTimer = setTimeout(() => {
      preview = next;
      month = next;
    }, 100);
  }

  function submitPhrase(): void {
    if (typed) {
      pick(typed);
    } else if (phrase.trim() !== "") {
      noMatch = true;
    }
  }

  function positionPanel(): void {
    if (!containerEl || !panelEl) return;
    const trigger = containerEl.getBoundingClientRect();
    const width = Math.min(300, Math.max(0, window.innerWidth - 16));
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
    if (disabled) return;
    open = !open;
    resetPhrase();
    if (open) {
      month = value ?? todayStr();
      await tick();
      positionPanel();
    }
  }

  function pick(date: string): void {
    resetPhrase();
    open = false;
    onchange(date);
    triggerEl?.focus();
  }

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
      // Drilling into the month or year grid changes the panel's height.
      autoReposition(() => [panelEl, triggerEl, containerEl], positionPanel),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  });
</script>

<div class="kit-date-picker" class:kit-date-picker--block={block} bind:this={containerEl}>
  <button
    class="kit-date-picker__trigger kit-control-states"
    class:open
    class:kit-date-picker__trigger--empty={!value}
    type="button"
    title={label}
    aria-label={value ? `${ariaLabel}: ${label}` : ariaLabel}
    bind:this={triggerEl}
    onclick={toggleOpen}
    {disabled}
    aria-haspopup="dialog"
    aria-expanded={open}
  >
    <span class="kit-date-picker__trigger-icon" aria-hidden="true">
      <CalendarIcon size="13" strokeWidth="2" />
    </span>
    <span class="kit-date-picker__trigger-label">{label}</span>
    <span class="kit-date-picker__trigger-chevron" class:open aria-hidden="true">
      <ChevronDownIcon size="11" strokeWidth="2.2" />
    </span>
  </button>

  {#if open}
    <div
      class="kit-date-picker__panel kit-popover-card"
      style={panelStyle}
      bind:this={panelEl}
      role="dialog"
      aria-label={dialogLabel}
    >
      {#if textEntry}
        <DatePhraseInput
          bind:value={phrase}
          class="kit-date-picker__phrase"
          placeholder={textEntryPlaceholder}
          ariaLabel={textEntryLabel}
          clearLabel={textEntryClearLabel}
          {summary}
          invalid={noMatch}
          {locale}
          autofocus
          oninput={handlePhraseInput}
          onsubmit={submitPhrase}
        />
      {/if}
      <Calendar
        bind:month
        selected={preview
          ? { from: preview, to: preview }
          : value
            ? { from: value, to: value }
            : null}
        {maxDate}
        {...calendarLabels}
        {locale}
        onpick={pick}
      />
    </div>
  {/if}
</div>

<style>
  .kit-date-picker {
    position: relative;
    display: inline-flex;
  }

  .kit-date-picker--block {
    display: flex;
    width: 100%;
  }

  .kit-date-picker--block .kit-date-picker__trigger {
    width: 100%;
    min-width: 0;
    justify-content: space-between;
  }

  .kit-date-picker__trigger {
    height: 28px;
    /* Stable width so the label changing never shifts neighbors. */
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

  .kit-date-picker__trigger:hover:not(:disabled) {
    background: var(--bg-surface-hover);
  }

  .kit-date-picker__trigger:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .kit-date-picker__trigger.open {
    border-color: var(--accent-blue);
  }

  .kit-date-picker__trigger--empty .kit-date-picker__trigger-label {
    color: var(--text-muted);
  }

  .kit-date-picker__trigger-icon,
  .kit-date-picker__trigger-chevron {
    display: inline-flex;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .kit-date-picker__trigger-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }

  .kit-date-picker__trigger-chevron {
    transition: transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-date-picker__trigger-chevron.open {
    transform: rotate(180deg);
  }

  .kit-date-picker__panel {
    position: fixed;
    box-sizing: border-box;
    z-index: var(--z-popover);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }

  .kit-date-picker__panel :global(.kit-date-picker__phrase) {
    align-self: stretch;
  }
</style>
