<script module lang="ts">
  import { MEDIA } from "../breakpoints.js";

  /** Whether a picker should focus the field when its popover opens: not on
   * touch-first devices, where focus raises the on-screen keyboard over the
   * calendar. */
  export function focusOnOpen(): boolean {
    return !(typeof window !== "undefined" && window.matchMedia?.(MEDIA.touch).matches);
  }
</script>

<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import XIcon from "@lucide/svelte/icons/x";
  import { tick } from "svelte";
  import { completeDatePhrase, DATE_PHRASE_MAX_LENGTH } from "./date-phrase.js";
  import TextInput from "./TextInput.svelte";

  interface Props {
    /** The typed text (bindable). */
    value?: string;
    placeholder?: string;
    /** Accessible name of the text field. */
    ariaLabel?: string;
    clearLabel?: string;
    /** What the text resolves to, or a no-match message. Shown under the
     * field and announced politely to screen readers when it changes. */
    summary?: string;
    /** Shown under the field while `summary` is empty; never announced. */
    hint?: string;
    /** The summary is a no-match message: styles it and marks the field
     * aria-invalid. */
    invalid?: boolean;
    /** BCP 47 tag for month and weekday names offered as completions.
     * Omitted = browser locale. */
    locale?: string | undefined;
    /** Also complete set words ("Fridays", "weekends", "every"), for
     * owners that parse sets. */
    sets?: boolean;
    /** Focus the field when it mounts. */
    autofocus?: boolean;
    /** Called on every edit, including an accepted completion and clear. */
    oninput?: (value: string) => void;
    /** Called on Enter. */
    onsubmit?: () => void;
    /** Called after the clear button empties the field. */
    onclear?: () => void;
    /** The underlying input element (bindable). */
    inputEl?: HTMLInputElement | undefined;
    class?: string;
  }

  let {
    value = $bindable(""),
    placeholder = "What dates are you looking for?",
    ariaLabel = "Type dates",
    clearLabel = "Clear",
    summary = "",
    hint = "",
    invalid = false,
    locale = undefined,
    sets = false,
    autofocus = false,
    oninput = undefined,
    onsubmit = undefined,
    onclear = undefined,
    inputEl = $bindable(undefined),
    class: className = "",
  }: Props = $props();

  const summaryId = $props.id();

  // Ghost text shows only where it reads as the end of the typed word: the
  // field is focused, the caret sits at the end, and the text isn't
  // scrolled (then the overlay would no longer line up with it).
  let focused = $state(false);
  let caretAtEnd = $state(true);
  let overflowing = $state(false);
  let ghostLeft = $state(0);

  const completion = $derived(completeDatePhrase(value, { locale, sets }));
  const ghost = $derived(focused && caretAtEnd && !overflowing ? completion : "");

  function measure(): void {
    if (!inputEl) return;
    const end = inputEl.value.length;
    caretAtEnd = inputEl.selectionStart === end && inputEl.selectionEnd === end;
    overflowing = inputEl.scrollWidth > inputEl.clientWidth;
    ghostLeft = inputEl.offsetLeft;
  }

  // Follow layout changes (popover width, font scale) while mounted.
  function observeLayout(node: HTMLElement): () => void {
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }

  function handleInput(next: string): void {
    measure();
    oninput?.(next);
  }

  async function accept(): Promise<void> {
    value = value + completion;
    oninput?.(value);
    await tick();
    inputEl?.setSelectionRange(value.length, value.length);
    measure();
  }

  function handleKeydown(event: KeyboardEvent): void {
    // Keys that confirm an IME composition (Japanese, Chinese, Korean) belong
    // to the input method, not to us.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onsubmit?.();
      return;
    }
    // Tab or → at the end takes the suggestion; with none, Tab moves focus
    // as usual.
    const takes =
      (event.key === "Tab" && !event.shiftKey) || (event.key === "ArrowRight" && !event.shiftKey);
    if (takes && ghost !== "" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      void accept();
    }
  }

  function clear(): void {
    value = "";
    oninput?.("");
    onclear?.();
    inputEl?.focus();
  }
</script>

<div class={["kit-date-phrase-input", className]} {@attach observeLayout}>
  <div class="kit-date-phrase-input__field">
    <TextInput
      bind:value
      bind:inputEl
      block
      {placeholder}
      {ariaLabel}
      {autofocus}
      {invalid}
      maxlength={DATE_PHRASE_MAX_LENGTH}
      autocomplete="off"
      ariaAutocomplete="inline"
      ariaDescribedby={summaryId}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={() => {
        focused = true;
        measure();
      }}
      onblur={() => (focused = false)}
    >
      {#snippet prefix()}
        <CalendarIcon size="13" strokeWidth="2" aria-hidden="true" />
      {/snippet}
      {#snippet suffix()}
        {#if value !== ""}
          <button
            class="kit-date-phrase-input__clear kit-control-states"
            type="button"
            title={clearLabel}
            aria-label={clearLabel}
            onclick={clear}
          >
            <XIcon size="12" strokeWidth="2" aria-hidden="true" />
          </button>
        {/if}
      {/snippet}
    </TextInput>
    <!-- The typed text again, invisible, so the suggestion starts exactly
         where the real text ends. Same font as the field. -->
    {#if ghost !== ""}
      <span class="kit-date-phrase-input__ghost" style:left="{ghostLeft}px" aria-hidden="true"
        ><span class="kit-date-phrase-input__ghost-typed">{value}</span><span
          class="kit-date-phrase-input__ghost-rest">{ghost}</span
        ></span
      >
    {/if}
  </div>
  <p
    id={summaryId}
    class="kit-date-phrase-input__summary"
    class:kit-date-phrase-input__summary--invalid={invalid}
  >
    {summary || hint}
  </p>
  <!-- Announces a new result or a no-match message, not the hint on every
       keystroke. -->
  <span class="kit-sr-only" aria-live="polite">{summary}</span>
</div>

<!-- Selection changes without an edit (clicks, arrow keys) move the caret
     away from the end; re-measure so the ghost hides. -->
<svelte:document
  onselectionchange={() => {
    if (focused) measure();
  }}
/>

<style>
  .kit-date-phrase-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .kit-date-phrase-input__field {
    position: relative;
    font-size: var(--font-size-sm);
  }

  .kit-date-phrase-input__ghost {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
    white-space: pre;
    font-family: inherit;
    font-size: var(--font-size-sm);
    line-height: normal;
  }

  .kit-date-phrase-input__ghost-typed {
    visibility: hidden;
  }

  .kit-date-phrase-input__ghost-rest {
    color: var(--text-muted);
    opacity: 0.75;
  }

  .kit-date-phrase-input__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
  }

  .kit-date-phrase-input__clear:hover {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  .kit-date-phrase-input__summary {
    margin: 0;
    min-height: 1lh;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .kit-date-phrase-input__summary--invalid {
    color: var(--accent-red);
  }
</style>
