<script lang="ts">
  import type { Snippet } from "svelte";
  import TextInput, { type TextInputSize } from "./TextInput.svelte";
  import {
    allowsDecimals,
    allowsNegative,
    clampNumber,
    decimalSeparator,
    formatNumber,
    isNumberDraft,
    isNumberText,
    isSafeNumber,
    normalizeNumberDraft,
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
     * `min`). Its decimal places, and those of `min` and `max`, decide
     * whether a decimal separator can be typed: the default 1 takes integers
     * only. */
    step?: number;
    /** BCP 47 language tag whose decimal separator the field shows and
     * accepts, such as "de-DE" for "0,5". "." is accepted in every
     * locale and rewritten to the locale's separator. Defaults to the
     * browser's locale. */
    locale?: string;
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
    /** Validation message when a required field holds text that is not a
     * number yet, such as a lone "-". An empty required field uses the
     * browser's own message. */
    requiredMessage?: string;
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
    locale = undefined,
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
    requiredMessage = "Enter a number.",
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

  const separator = $derived(decimalSeparator(locale));

  // iOS numeric and decimal keypads have no minus key, so a field that
  // takes negatives falls back to the full keyboard.
  const inputmode = $derived(
    allowsNegative(bounds) ? "text" : allowsDecimals(bounds) ? "decimal" : "numeric",
  );

  // What the user typed, kept while it still means the current value so
  // in-progress text like "1." or "-" survives. Any change to value resets
  // it, so a value set from outside shows in its canonical form even when
  // it parses the same as the draft; handleText writes the draft after
  // setting the value, and only while the value is still what it parsed.
  let draft = $derived.by((): string | null => {
    void value;
    return null;
  });
  const text = $derived(draft ?? formatNumber(value, separator));

  // A required field must not submit a draft like "-": the browser sees
  // non-empty text and its own required check passes.
  $effect(() => {
    inputEl?.setCustomValidity(required && value === null && text !== "" ? requiredMessage : "");
  });

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
    if (readonly || disabled) return;
    if (value !== null) setValue(clampNumber(value, bounds));
    settle(committed);
  }

  /** Drop in-progress text and report a change from `previous`. */
  function settle(previous: number | null): void {
    draft = null;
    if (value === previous) return;
    committed = value;
    onchange?.(value);
  }

  function handleBeforeInput(event: InputEvent): void {
    if (!event.inputType.startsWith("insert")) return;
    // Composition text can't be cancelled; handleText reverts it instead.
    if (event.inputType === "insertCompositionText" || !event.cancelable) return;
    const input = event.currentTarget as HTMLInputElement;
    const raw = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
    // Pasted or dropped numbers often carry surrounding whitespace.
    const pasted = event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop";
    const inserted = pasted ? raw.trim() : raw;
    // A paste of only whitespace would just delete the selection.
    if (pasted && inserted === "" && raw !== "") {
      event.preventDefault();
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + inserted + input.value.slice(end);
    if (!isNumberDraft(next, bounds, separator)) {
      event.preventDefault();
    } else if (inserted !== raw) {
      // The native insert would keep the whitespace, so insert the trimmed
      // text instead and report it as the same kind of edit.
      event.preventDefault();
      input.setRangeText(inserted, start, end, "end");
      input.dispatchEvent(new InputEvent("input", { inputType: event.inputType, bubbles: true }));
    }
  }

  /** Put `next` in the DOM after it received `raw`, keeping the caret where
   * the edit left it. */
  function replaceText(next: string, raw: string): void {
    if (!inputEl) return;
    const caret = Math.max(0, (inputEl.selectionStart ?? 0) - (raw.length - next.length));
    inputEl.value = next;
    inputEl.setSelectionRange(caret, caret);
  }

  // TextInput writes every edit here. Text that is not an allowed draft,
  // from an edit beforeinput could not cancel (IME composition) or a
  // deletion that leaves too large a number, is reverted. An allowed edit
  // is normalized (surrounding whitespace dropped, "." written as the
  // locale's separator). TextInput reads its text back through `text`, so
  // a rejected edit never reaches its state. A value supplied from outside
  // beyond the safe-integer limit may still be shortened, so Backspace can
  // bring it back into range.
  function handleText(raw: string): void {
    const cleaned = normalizeNumberDraft(raw, separator);
    const shortensUnsafe =
      value !== null &&
      !isSafeNumber(value) &&
      cleaned.length < text.length &&
      isNumberText(cleaned, bounds, separator);
    if (!shortensUnsafe && !isNumberDraft(cleaned, bounds, separator)) {
      replaceText(text, raw);
      return;
    }
    const parsed = parseNumberDraft(cleaned, separator);
    setValue(parsed);
    // An oninput handler may already have replaced the value, such as an
    // app capping it; then the field shows the app's value instead.
    if (value === parsed) draft = cleaned;
    if (text !== raw) replaceText(text, raw);
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
    const before = value;
    setValue(stepNumber(value, event.key === "ArrowUp" ? 1 : -1, bounds));
    settle(before);
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
  bind:value={() => text, handleText}
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
  onkeydown={handleKeydown}
  onfocus={handleFocus}
  onblur={handleBlur}
  class={["kit-number-input", className].filter(Boolean).join(" ")}
/>
