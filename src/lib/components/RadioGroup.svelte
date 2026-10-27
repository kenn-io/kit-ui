<script module lang="ts">
  export interface RadioGroupOption {
    value: string;
    label: string;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";

  interface Props {
    options: RadioGroupOption[];
    /** Chosen option value (bindable); undefined leaves every option unchosen. */
    value?: string | undefined;
    /** The group's visible name, rendered as the fieldset's legend. */
    legend: string;
    /** Shared input name: it groups the radios for arrow keys and form
     * submission. Defaults to an id unique to this instance. */
    name?: string;
    /** Id of the fieldset. */
    id?: string;
    /** Disables every option. */
    disabled?: boolean;
    /** Native constraint validation: the form won't submit with no choice. */
    required?: boolean;
    /** Points at hint/error text elsewhere in the form. */
    ariaDescribedby?: string;
    /** Called with the newly chosen value. A form reset also calls it, with
     * undefined when the reset leaves no option chosen. */
    onchange?: (value: string | undefined) => void;
    class?: string;
  }

  let {
    options,
    value = $bindable(undefined),
    legend,
    name = undefined,
    id = undefined,
    disabled = false,
    required = false,
    ariaDescribedby = undefined,
    onchange = undefined,
    class: className = "",
  }: Props = $props();

  const uid = $props.id();
  const groupName = $derived(name ?? uid);
  // The value at mount is the default a form reset returns to, as the
  // `checked` attribute is for native radios.
  const initialValue = untrack(() => value);

  function choose(event: Event & { currentTarget: HTMLInputElement }): void {
    value = event.currentTarget.value;
    onchange?.(value);
  }

  // A form reset restores the radios without a change event, so read the
  // restored choice back. The reset event fires before the inputs change,
  // hence the timeout.
  function syncOnReset(fieldset: HTMLFieldSetElement) {
    const form = fieldset.form;
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onReset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.defaultPrevented) return;
        const next = fieldset.querySelector<HTMLInputElement>(
          ".kit-radio-group__input:checked",
        )?.value;
        if (next === value) return;
        value = next;
        onchange?.(next);
      });
    };
    form.addEventListener("reset", onReset);
    return () => {
      // A reset can also remove the group; its pending read must not write
      // into the app's state afterwards.
      clearTimeout(timer);
      form.removeEventListener("reset", onReset);
    };
  }
</script>

<fieldset
  class={["kit-radio-group", className]}
  {id}
  {disabled}
  aria-describedby={ariaDescribedby}
  {@attach syncOnReset}
>
  <legend class="kit-radio-group__legend">{legend}</legend>
  {#each options as option (option.value)}
    <label
      class="kit-radio-group__option"
      class:kit-radio-group__option--disabled={!disabled && option.disabled}
    >
      <input
        class="kit-radio-group__input"
        type="radio"
        name={groupName}
        value={option.value}
        checked={option.value === value}
        defaultChecked={option.value === initialValue}
        disabled={option.disabled}
        {required}
        onchange={choose}
      />
      <span class="kit-radio-group__mark" aria-hidden="true"></span>
      <span class="kit-radio-group__label">{option.label}</span>
    </label>
  {/each}
</fieldset>

<style>
  .kit-radio-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .kit-radio-group:disabled {
    opacity: var(--opacity-disabled);
  }

  /* Matches FormField's label so a radio group reads as one more field. */
  .kit-radio-group__legend {
    padding: 0;
    margin-bottom: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    line-height: 1.4;
  }

  /* Each option is Checkbox's row: the drawn mark, then the label. */
  .kit-radio-group__option {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    cursor: pointer;
    position: relative;
  }

  .kit-radio-group:disabled .kit-radio-group__option,
  .kit-radio-group__option--disabled {
    cursor: not-allowed;
  }

  .kit-radio-group__option--disabled {
    opacity: var(--opacity-disabled);
  }

  /* As in Checkbox: the real input is invisible but stretched over the
   * whole label as the hit target, so test drivers' hit-target checks
   * land on it. The drawn mark carries the focus ring. */
  .kit-radio-group__input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
    z-index: 1;
  }

  /* Checkbox's 16px box and edge, drawn round. */
  .kit-radio-group__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    box-sizing: border-box;
    background: var(--bg-surface);
    border: max(1.5px, var(--border-width)) solid var(--border-default);
    border-radius: 50%;
    transition:
      background-color var(--transition-fast) var(--transition-ease, ease),
      border-color var(--transition-fast) var(--transition-ease, ease),
      transform var(--transition-fast) var(--transition-ease, ease);
  }

  /* The centre dot is surface-colored so it contrasts against the accent
   * fill in both modes, like Checkbox's check. */
  .kit-radio-group__mark::after {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bg-surface);
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity var(--transition-fast) var(--transition-ease, ease),
      transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-radio-group__option:hover .kit-radio-group__input:not(:disabled) + .kit-radio-group__mark {
    border-color: var(--accent-blue);
  }

  .kit-radio-group__option:active .kit-radio-group__input:not(:disabled) + .kit-radio-group__mark {
    transform: var(--press-transform);
  }

  .kit-radio-group__input:checked + .kit-radio-group__mark {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
  }

  .kit-radio-group__input:checked + .kit-radio-group__mark::after {
    opacity: 1;
    transform: scale(1);
  }

  .kit-radio-group__input:focus-visible + .kit-radio-group__mark {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  /* Delegated-focus exception to the global ring rule, as in Checkbox:
   * the invisible input's own outline is never seen, so the drawn mark
   * mirrors the high-contrast widening of :focus-visible. */
  :global(:root.high-contrast) .kit-radio-group__input:focus-visible + .kit-radio-group__mark {
    outline-width: 3px;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-radio-group__mark,
    .kit-radio-group__mark::after {
      transition: none;
    }
  }

  .kit-radio-group__label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    min-width: 0;
  }
</style>
