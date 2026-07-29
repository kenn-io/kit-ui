<script module lang="ts">
  export interface FieldState {
    id: string;
    label: string;
    value: string;
    error?: string;
    disabled?: boolean;
  }

  export type FormFieldType = "text" | "email" | "password" | "tel" | "url";
</script>

<script lang="ts">
  import TextInput from "./components/TextInput.svelte";

  interface Props {
    field: FieldState;
    type?: FormFieldType;
    name?: string;
    placeholder?: string;
    autocomplete?: HTMLInputElement["autocomplete"];
    required?: boolean;
    oninput?: (value: string) => void;
    onblur?: () => void;
  }

  let {
    field,
    type = "text",
    name = undefined,
    placeholder = undefined,
    autocomplete = undefined,
    required = false,
    oninput = undefined,
    onblur = undefined,
  }: Props = $props();

  const errorId = $derived(`${field.id}-error`);
</script>

<div class="kit-form-field">
  <label for={field.id}>{field.label}</label>
  <TextInput
    id={field.id}
    {name}
    {type}
    value={field.value}
    {placeholder}
    {autocomplete}
    {required}
    disabled={field.disabled}
    invalid={!!field.error}
    block
    size="lg"
    ariaDescribedby={field.error ? errorId : undefined}
    {oninput}
    {onblur}
  />
  {#if field.error}
    <p id={errorId} class="kit-form-field__error">{field.error}</p>
  {/if}
</div>

<style>
  .kit-form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }

  .kit-form-field label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    line-height: 1.4;
  }

  .kit-form-field__error {
    margin: 0;
    color: var(--accent-red);
    font-size: var(--font-size-sm);
    line-height: 1.4;
  }
</style>
