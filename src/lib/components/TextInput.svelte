<script module lang="ts">
  export type TextInputSize = "sm" | "md";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Current text (bindable). */
    value?: string;
    /** Input type. Text-like types only — date/checkbox/radio/etc. have
     * their own chrome and don't belong in this wrapper. */
    type?: "text" | "search" | "email" | "url" | "password" | "tel";
    placeholder?: string;
    /** sm = 24px, md = 28px tall — the shared toolbar control heights. */
    size?: TextInputSize;
    /** Red border + aria-invalid, e.g. failed validation. */
    invalid?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    /** Stretch to the container width (default shrink-wraps ~180px). */
    block?: boolean;
    id?: string;
    name?: string;
    /** Accessible name when there is no associated `<label for>`. */
    ariaLabel?: string;
    /** Focus the input when it mounts. */
    autofocus?: boolean;
    autocomplete?: HTMLInputElement["autocomplete"];
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    /** Leading adornment inside the border (icon, unit). */
    prefix?: Snippet;
    /** Trailing adornment inside the border (icon, clear button, kbd). */
    suffix?: Snippet;
    /** The underlying input element (bindable) — for focus management. */
    inputEl?: HTMLInputElement;
    class?: string;
  }

  let {
    value = $bindable(""),
    type = "text",
    placeholder = undefined,
    size = "md",
    invalid = false,
    disabled = false,
    readonly = false,
    block = false,
    id = undefined,
    name = undefined,
    ariaLabel = undefined,
    autofocus = false,
    autocomplete = undefined,
    oninput = undefined,
    onchange = undefined,
    onkeydown = undefined,
    prefix = undefined,
    suffix = undefined,
    inputEl = $bindable(undefined),
    class: className = "",
  }: Props = $props();

  function focusOnMount(node: HTMLInputElement): void {
    if (autofocus) node.focus();
  }

  function handleInput(event: Event): void {
    value = (event.currentTarget as HTMLInputElement).value;
    oninput?.(value);
  }
</script>

<!-- The wrapper carries all the chrome (border, focus, invalid) so prefix/
     suffix adornments sit inside the field; the input itself is chromeless.
     `type` stays dynamic, so value syncs via the input handler instead of
     bind:value (Svelte requires a static type for two-way binding). -->
<div
  class={[
    "kit-text-input",
    `kit-text-input--${size}`,
    className,
  ]}
  class:kit-text-input--invalid={invalid}
  class:kit-text-input--block={block}
  class:kit-text-input--disabled={disabled}
>
  {#if prefix}
    <span class="kit-text-input__adornment">{@render prefix()}</span>
  {/if}
  <input
    bind:this={inputEl}
    class="kit-text-input__control"
    {type}
    {value}
    {placeholder}
    {disabled}
    {readonly}
    {id}
    {name}
    {autocomplete}
    aria-label={ariaLabel}
    aria-invalid={invalid ? "true" : undefined}
    oninput={handleInput}
    onchange={(event) =>
      onchange?.((event.currentTarget as HTMLInputElement).value)}
    {onkeydown}
    {@attach focusOnMount}
  />
  {#if suffix}
    <span class="kit-text-input__adornment">{@render suffix()}</span>
  {/if}
</div>

<style>
  .kit-text-input {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    width: 180px;
    max-width: 100%;
    padding: 0 var(--space-3);
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    transition: border-color 0.12s;
  }

  .kit-text-input--sm {
    height: 24px;
    font-size: var(--font-size-xs);
  }

  .kit-text-input--md {
    height: 28px;
    font-size: var(--font-size-sm);
  }

  .kit-text-input--block {
    display: flex;
    width: 100%;
  }

  .kit-text-input:focus-within {
    border-color: var(--accent-blue);
  }

  .kit-text-input--invalid,
  .kit-text-input--invalid:focus-within {
    border-color: var(--accent-red);
  }

  .kit-text-input--disabled {
    opacity: 0.5;
  }

  .kit-text-input__control {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  .kit-text-input__control:focus {
    outline: none;
  }

  .kit-text-input__control::placeholder {
    color: var(--text-muted);
  }

  .kit-text-input__control:disabled {
    cursor: default;
  }

  /* type="search": the wrapper owns the clear affordance (SearchInput),
   * so suppress the native webkit cancel button. */
  .kit-text-input__control::-webkit-search-cancel-button,
  .kit-text-input__control::-webkit-search-decoration {
    -webkit-appearance: none;
  }

  .kit-text-input__adornment {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--text-muted);
  }
</style>
