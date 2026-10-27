<script lang="ts">
  import type { Snippet } from "svelte";
  import TextInput, { type TextInputSize } from "./TextInput.svelte";
  import {
    allowsNegative,
    clampNumber,
    draftAfterInsert,
    formatNumber,
    isNumberDraft,
    numberPrecision,
    parseNumberDraft,
    stepNumber,
    type NumberBounds,
  } from "./number-input.js";

  interface Props {
    /** Current number, or null when the field is empty (bindable). */
    value?: number | null;
    min?: number;
    max?: number;
    /** Arrow-key increment, and the grid the arrows snap to (anchored at
     * `min`). Its decimal places, and `min`'s, decide whether a decimal
     * point can be typed: the default 1 takes integers only. */
    step?: number;
    placeholder?: string;
    size?: TextInputSize;
    /** Red border + aria-invalid, e.g. failed validation. */
    invalid?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    /** Stretch to the container width. */
    block?: boolean;
    id?: string;
    name?: string;
    /** Accessible name when there is no associated `<label for>`. */
    ariaLabel?: string;
    ariaDescribedby?: string;
    /** Focus the input when it mounts. */
    autofocus?: boolean;
    /** Called when typing or an arrow key changes the number. */
    oninput?: (value: number | null) => void;
    /** Called when a change is committed: an arrow step, or leaving the
     * field (blur or Enter) with a different number than on entry. */
    onchange?: (value: number | null) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onblur?: () => void;
    /** Leading adornment inside the border. */
    prefix?: Snippet;
    /** Trailing adornment inside the border, e.g. a unit such as "sec". */
    suffix?: Snippet;
    /** The underlying input element (bindable) — for focus management. */
    inputEl?: HTMLInputElement | undefined;
    class?: string;
  }

  let {
    value = $bindable(null),
    min = undefined,
    max = undefined,
    step = 1,
    placeholder = undefined,
    size = "md",
    invalid = false,
    disabled = false,
    readonly = false,
    required = false,
    block = false,
    id = undefined,
    name = undefined,
    ariaLabel = undefined,
    ariaDescribedby = undefined,
    autofocus = false,
    oninput = undefined,
    onchange = undefined,
    onkeydown = undefined,
    onblur = undefined,
    prefix = undefined,
    suffix = undefined,
    inputEl = $bindable(undefined),
    class: className = "",
  }: Props = $props();

  const bounds: NumberBounds = $derived.by(() => {
    if (!(step > 0)) throw new Error(`NumberInput: step must be a positive number, got ${step}`);
    return { min, max, step };
  });

  // iOS numeric and decimal keypads have no minus key, so a field that
  // takes negatives falls back to the full keyboard.
  const inputmode = $derived(
    allowsNegative(bounds) ? "text" : numberPrecision(bounds) > 0 ? "decimal" : "numeric",
  );

  // What the user typed, kept while it still means the current value so
  // in-progress text like "1." or "-" survives. A new value from outside
  // replaces it with the canonical form.
  let draft = $state<string | null>(null);
  const text = $derived(
    draft !== null && parseNumberDraft(draft) === value ? draft : formatNumber(value),
  );

  // The value when the field was entered or last committed, so onchange
  // fires only for real changes.
  let committed: number | null = null;

  function handleFocus(): void {
    committed = value;
  }

  function setValue(next: number | null): void {
    if (next === value) return;
    value = next;
    oninput?.(next);
  }

  function commit(): void {
    if (value !== null) setValue(clampNumber(value, bounds));
    draft = null;
    if (value !== committed) {
      committed = value;
      onchange?.(value);
    }
  }

  function handleBeforeInput(event: InputEvent): void {
    if (!event.inputType.startsWith("insert")) return;
    // Composition text can't be cancelled; handleInput reverts it instead.
    if (event.inputType === "insertCompositionText" || !event.cancelable) return;
    const input = event.currentTarget as HTMLInputElement;
    const inserted = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
    const next = draftAfterInsert(
      input.value,
      input.selectionStart ?? input.value.length,
      input.selectionEnd ?? input.value.length,
      inserted,
    );
    if (!isNumberDraft(next, bounds)) event.preventDefault();
  }

  function handleInput(raw: string): void {
    if (!isNumberDraft(raw, bounds)) {
      // An edit beforeinput could not cancel (IME composition): put the
      // last allowed text back with the caret where the edit started.
      if (inputEl) {
        const caret = Math.max(0, (inputEl.selectionStart ?? 0) - (raw.length - text.length));
        inputEl.value = text;
        inputEl.setSelectionRange(caret, caret);
      }
      return;
    }
    draft = raw;
    setValue(parseNumberDraft(raw));
  }

  function handleKeydown(event: KeyboardEvent): void {
    onkeydown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter") {
      commit();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (disabled || readonly) return;
    event.preventDefault();
    setValue(stepNumber(value, event.key === "ArrowUp" ? 1 : -1, bounds));
    draft = null;
    committed = value;
    onchange?.(value);
  }

  function handleBlur(): void {
    commit();
    onblur?.();
  }
</script>

<!-- A text input with spinbutton semantics, not type="number": it has no
     spinner chrome in any engine, and the typed text stays readable so the
     filter can reject characters before they land. -->
<TextInput
  bind:inputEl
  value={text}
  type="text"
  role="spinbutton"
  ariaValuenow={value ?? undefined}
  ariaValuemin={min}
  ariaValuemax={max}
  {inputmode}
  autocomplete="off"
  {placeholder}
  {size}
  {invalid}
  {disabled}
  {readonly}
  {required}
  {block}
  {id}
  {name}
  {ariaLabel}
  {ariaDescribedby}
  {autofocus}
  {prefix}
  {suffix}
  onbeforeinput={handleBeforeInput}
  oninput={handleInput}
  onkeydown={handleKeydown}
  onfocus={handleFocus}
  onblur={handleBlur}
  class={["kit-number-input", className].filter(Boolean).join(" ")}
/>
