<script module lang="ts">
  export type ColorInputSize = "sm" | "md";

  /** A quick pick shown as a swatch button beside the field. */
  export interface ColorInputSwatch {
    /** Hex color, with or without `#`, 3 or 6 digits. */
    value: string;
    /** Accessible name and tooltip, for example "Okabe-Ito blue". */
    label: string;
  }
</script>

<script lang="ts">
  import { parseHexColor } from "../utils/color-contrast.js";
  import TextInput from "./TextInput.svelte";

  interface Props {
    /** Current color as `#rrggbb` (bindable). */
    value?: string;
    /** Called with the normalized `#rrggbb` color for every pick: while
     * the native picker is open, on a swatch click, and when a valid hex
     * typed into the field is committed with Enter or blur. */
    onchange?: (value: string) => void;
    /** Quick picks shown as swatch buttons after the field. */
    swatches?: readonly ColorInputSwatch[];
    /** Accessible name for the whole control. */
    ariaLabel?: string;
    /** Accessible name for the native picker. */
    pickerLabel?: string;
    /** Accessible name for the hex text field. Defaults to "Hex color",
     * unless `id` is set, so an external `<label for>` names the field. */
    hexLabel?: string;
    /** Marks the control invalid, for example when the app finds the color
     * has too little contrast. The hex field also marks itself invalid
     * after a commit of text that is not a hex color. */
    invalid?: boolean;
    /** Points at the app's explanation, such as a contrast warning. */
    ariaDescribedby?: string;
    /** sm = 24px, md = 28px tall, matching TextInput. */
    size?: ColorInputSize;
    disabled?: boolean;
    /** id of the hex text field, for an external `<label for>`. */
    id?: string;
    class?: string;
  }

  let {
    value = $bindable("#000000"),
    onchange = undefined,
    swatches = [],
    ariaLabel = undefined,
    pickerLabel = "Open color picker",
    hexLabel = undefined,
    invalid = false,
    ariaDescribedby = undefined,
    size = "md",
    disabled = false,
    id = undefined,
    class: className = "",
  }: Props = $props();

  const normalized = $derived(parseHexColor(value) ?? "#000000");
  // The field shows the committed color until the user types; a new value
  // from the parent (a reset, a swatch) replaces any draft.
  let draft = $derived(normalized);
  // A new value from the parent also clears a rejected draft.
  let draftRejected = $derived.by(() => {
    void normalized;
    return false;
  });

  function commit(next: string): void {
    const parsed = parseHexColor(next);
    if (parsed === null) {
      draftRejected = true;
      return;
    }
    draftRejected = false;
    draft = parsed;
    if (parsed === normalized) return;
    value = parsed;
    onchange?.(parsed);
  }
</script>

<div
  class={["kit-color-input", `kit-color-input--${size}`, className]}
  class:kit-color-input--disabled={disabled}
  role="group"
  aria-label={ariaLabel}
>
  <label class="kit-color-input__well" style:--kit-color-input-value={normalized}>
    <input
      class="kit-color-input__picker"
      type="color"
      value={normalized}
      {disabled}
      aria-label={pickerLabel}
      aria-invalid={invalid ? "true" : undefined}
      aria-describedby={ariaDescribedby}
      oninput={(event) => commit(event.currentTarget.value)}
    />
  </label>
  <TextInput
    class="kit-color-input__hex"
    {size}
    {id}
    value={draft}
    {disabled}
    invalid={invalid || draftRejected}
    ariaLabel={hexLabel ?? (id === undefined ? "Hex color" : undefined)}
    {ariaDescribedby}
    autocomplete="off"
    oninput={(next) => {
      draft = next;
      draftRejected = false;
    }}
    onchange={commit}
  />
  {#if swatches.length > 0}
    <div class="kit-color-input__swatches">
      {#each swatches as swatch (swatch.value)}
        {@const swatchColor = parseHexColor(swatch.value)}
        {#if swatchColor}
          <button
            type="button"
            class="kit-color-input__swatch kit-control-states"
            style:--kit-color-input-value={swatchColor}
            aria-label={swatch.label}
            title={swatch.label}
            aria-pressed={swatchColor === normalized}
            {disabled}
            onclick={() => commit(swatchColor)}
          ></button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .kit-color-input {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    max-width: 100%;
  }

  .kit-color-input--disabled {
    opacity: var(--opacity-disabled);
  }

  /* The native input fills the well invisibly: the well draws the color,
   * and clicks and keyboard focus still reach the platform picker. */
  .kit-color-input__well {
    position: relative;
    flex-shrink: 0;
    box-sizing: border-box;
    background: var(--kit-color-input-value);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .kit-color-input--sm .kit-color-input__well {
    width: 24px;
    height: 24px;
  }

  .kit-color-input--md .kit-color-input__well {
    width: 28px;
    height: 28px;
  }

  .kit-color-input--disabled .kit-color-input__well {
    cursor: default;
  }

  .kit-color-input__well:has(.kit-color-input__picker:focus-visible) {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  .kit-color-input__picker {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: inherit;
  }

  .kit-color-input :global(.kit-color-input__hex) {
    width: 92px;
    font-family: var(--font-mono);
  }

  .kit-color-input__swatches {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .kit-color-input__swatch {
    box-sizing: border-box;
    padding: 0;
    background: var(--kit-color-input-value);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-sm);
  }

  .kit-color-input--sm .kit-color-input__swatch {
    width: 16px;
    height: 16px;
  }

  .kit-color-input--md .kit-color-input__swatch {
    width: 20px;
    height: 20px;
  }

  /* A ring, not a hue change, marks the current pick so the state reads
   * without color vision. */
  .kit-color-input__swatch[aria-pressed="true"] {
    box-shadow:
      0 0 0 2px var(--bg-surface),
      0 0 0 4px var(--text-primary);
  }
</style>
