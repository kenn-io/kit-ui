<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** On/off state (bindable). */
    checked?: boolean;
    disabled?: boolean;
    /** Label text after the switch; use `children` for rich content. */
    label?: string | undefined;
    id?: string;
    name?: string;
    /** Submitted form value when on (native default "on"). */
    value?: string;
    /** Accessible name when there is no visible label. */
    ariaLabel?: string;
    /** Points at hint/error text elsewhere in the form. */
    ariaDescribedby?: string;
    onchange?: (checked: boolean) => void;
    class?: string;
    children?: Snippet;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    label = undefined,
    id = undefined,
    name = undefined,
    value = undefined,
    ariaLabel = undefined,
    ariaDescribedby = undefined,
    onchange = undefined,
    class: className = "",
    children,
  }: Props = $props();
</script>

<label class={["kit-toggle", className]} class:kit-toggle--disabled={disabled}>
  <input
    class="kit-toggle__input"
    type="checkbox"
    role="switch"
    bind:checked
    {disabled}
    {id}
    {name}
    {value}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedby}
    onchange={() => onchange?.(checked)}
  />
  <span class="kit-toggle__track" aria-hidden="true">
    <span class="kit-toggle__knob"></span>
  </span>
  {#if label !== undefined || children}
    <span class="kit-toggle__label">
      {#if label !== undefined}{label}{/if}
      {#if children}{@render children()}{/if}
    </span>
  {/if}
</label>

<style>
  .kit-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    cursor: pointer;
    position: relative;
  }

  .kit-toggle--disabled {
    cursor: not-allowed;
    opacity: var(--opacity-disabled);
  }

  /* Invisible but stretched over the whole label as the hit target (see
   * Checkbox for why not pointer-events: none). */
  .kit-toggle__input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
    z-index: 1;
  }

  /* middleman's DiffToolbar switch: 36×20 track, 16px knob on a 2px
   * inset, 16px travel. Track/knob corners follow the square themes via
   * the same fallback tokens as the status dots. */
  .kit-toggle__track {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
    box-sizing: border-box;
    border-radius: var(--radius-toggle, 999px);
    background: var(--border-default);
    transition: background-color var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-toggle__input:checked + .kit-toggle__track {
    background: var(--accent-blue);
  }

  /* Hover deepens the track toward ink (off) or shade (on); pressing
   * stretches the knob iOS-style along its travel direction. */
  .kit-toggle:hover .kit-toggle__input:not(:disabled) + .kit-toggle__track {
    background: color-mix(in srgb, var(--text-secondary) 25%, var(--border-default));
  }

  .kit-toggle:hover .kit-toggle__input:checked:not(:disabled) + .kit-toggle__track {
    background: color-mix(in srgb, var(--accent-blue) 88%, #000);
  }

  .kit-toggle:active .kit-toggle__input:not(:disabled) + .kit-toggle__track .kit-toggle__knob {
    width: 19px;
  }

  .kit-toggle:active
    .kit-toggle__input:checked:not(:disabled)
    + .kit-toggle__track
    .kit-toggle__knob {
    transform: translateX(13px);
  }

  .kit-toggle__input:focus-visible + .kit-toggle__track {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  /* Delegated-focus exception to the global ring rule (see Checkbox):
   * the drawn track carries the ring and mirrors high-contrast widening. */
  :global(:root.high-contrast) .kit-toggle__input:focus-visible + .kit-toggle__track {
    outline-width: 3px;
    outline-offset: 2px;
  }

  /* Knob stays white in both modes on purpose (middleman's annotated
   * choice): it must read against border-default off AND every theme's
   * accent on. --kit-toggle-knob is the override hook. */
  .kit-toggle__knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-dot, 50%);
    background: var(--kit-toggle-knob, #ffffff);
    box-shadow: var(--shadow-sm);
    transition:
      transform var(--transition-fast) var(--transition-ease, ease),
      width var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-toggle__input:checked + .kit-toggle__track .kit-toggle__knob {
    transform: translateX(16px);
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-toggle__track,
    .kit-toggle__knob {
      transition: none;
    }
  }

  .kit-toggle__label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    min-width: 0;
  }
</style>
