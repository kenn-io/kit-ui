<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import KbdBadge from "./KbdBadge.svelte";
  import TextInput, { type TextInputSize } from "./TextInput.svelte";

  interface Props {
    /** Current query (bindable). */
    value?: string;
    placeholder?: string;
    size?: TextInputSize;
    invalid?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    /** Stretch to the container width. */
    block?: boolean;
    /** Focus the input when it mounts. */
    autofocus?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
    /** Combobox wiring, forwarded to TextInput (see its docs). */
    role?: "combobox";
    ariaExpanded?: boolean;
    ariaControls?: string;
    ariaActivedescendant?: string;
    ariaAutocomplete?: "list" | "inline" | "both" | "none";
    /** Shortcut hint rendered as a KbdBadge while the field is empty,
     * e.g. ["⌘", "K"]. */
    keys?: string[];
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    /** Fires after the clear button or Escape empties the field. */
    onclear?: () => void;
    clearLabel?: string;
    /** The underlying input element (bindable) — e.g. for app shortcut
     * handlers that focus the search field. */
    inputEl?: HTMLInputElement;
    class?: string;
  }

  let {
    value = $bindable(""),
    placeholder = "Search…",
    size = "md",
    invalid = false,
    disabled = false,
    readonly = false,
    block = false,
    autofocus = false,
    id = undefined,
    name = undefined,
    ariaLabel = "Search",
    role = undefined,
    ariaExpanded = undefined,
    ariaControls = undefined,
    ariaActivedescendant = undefined,
    ariaAutocomplete = undefined,
    keys = undefined,
    oninput = undefined,
    onchange = undefined,
    onkeydown = undefined,
    onclear = undefined,
    clearLabel = "Clear search",
    inputEl = $bindable(undefined),
    class: className = "",
  }: Props = $props();

  function clear(): void {
    if (disabled || readonly) return;
    value = "";
    oninput?.("");
    onclear?.();
    // The clear button unmounts once the value empties — return focus to
    // the field so keyboard users don't get dropped.
    inputEl?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    // Only swallow Escape when a clear will actually happen — a readonly/
    // disabled field passes Escape through to its owner (modal, popover).
    if (event.key === "Escape" && value !== "" && !disabled && !readonly) {
      event.stopPropagation();
      clear();
      return;
    }
    onkeydown?.(event);
  }
</script>

<TextInput
  bind:value
  bind:inputEl
  type="search"
  {placeholder}
  {size}
  {invalid}
  {disabled}
  {readonly}
  {block}
  {autofocus}
  {id}
  {name}
  {ariaLabel}
  {role}
  {ariaExpanded}
  {ariaControls}
  {ariaActivedescendant}
  {ariaAutocomplete}
  {oninput}
  {onchange}
  onkeydown={handleKeydown}
  class={["kit-search-input", className].filter(Boolean).join(" ")}
>
  {#snippet prefix()}
    <SearchIcon
      size={size === "sm" ? 12 : 13}
      strokeWidth="2"
      aria-hidden="true"
    />
  {/snippet}
  {#snippet suffix()}
    {#if value !== "" && !disabled && !readonly}
      <button
        class="kit-search-input__clear"
        type="button"
        title={clearLabel}
        aria-label={clearLabel}
        onclick={clear}
      >
        <XIcon size="12" strokeWidth="2" aria-hidden="true" />
      </button>
    {:else if keys && keys.length > 0}
      <KbdBadge {keys} />
    {/if}
  {/snippet}
</TextInput>

<style>
  .kit-search-input__clear {
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

  .kit-search-input__clear:hover {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  .kit-search-input__clear:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }
</style>
