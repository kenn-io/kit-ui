<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { tick } from "svelte";
  import { autoReposition } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import type { TypeaheadOption } from "./typeahead.js";

  interface Props {
    options: TypeaheadOption[];
    value: string;
    fallbackLabel: string;
    placeholder: string;
    title?: string;
    emptyLabel?: string;
    disabled?: boolean;
    onselect: (value: string) => void;
  }

  let {
    options,
    value,
    fallbackLabel,
    placeholder,
    title,
    emptyLabel = "No matches",
    disabled = false,
    onselect,
  }: Props = $props();

  let query = $state("");
  let open = $state(false);
  let highlightIndex = $state(0);
  let inputEl = $state<HTMLInputElement>();
  let containerEl = $state<HTMLDivElement>();
  let listEl = $state<HTMLUListElement>();
  let listStyle = $state("");

  // Fixed positioning (same contract as SelectDropdown) so the list is
  // never clipped by an overflow-hidden ancestor; width pins to the
  // trigger so long labels keep truncating instead of widening the menu.
  function positionList(): void {
    if (!containerEl || !listEl) return;
    const trigger = containerEl.getBoundingClientRect();
    listStyle = `${floatingPopoverStyle({
      trigger,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: trigger.width,
      popoverHeight: listEl.offsetHeight,
      triggerGap: 2,
    })}; width: ${Math.round(trigger.width)}px`;
  }

  // Filtering changes the list's height — keep the flip/clamp current.
  // No dismissable() here: the typeahead closes on blur instead.
  $effect(() => {
    if (!open) return;
    return autoReposition(() => listEl, positionList);
  });

  const filtered = $derived.by(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  });

  const displayValue = $derived(
    options.find((o) => o.name === value)?.displayLabel ??
      options.find((o) => o.name === value)?.label ??
      fallbackLabel,
  );

  async function openDropdown() {
    if (disabled) return;
    query = "";
    open = true;
    highlightIndex = 0;
    await tick();
    positionList();
    inputEl?.focus();
  }

  function closeDropdown() {
    open = false;
    query = "";
  }

  function select(name: string) {
    onselect(name);
    closeDropdown();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[highlightIndex];
      if (item) select(item.name);
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  }

  function highlightSegments(label: string, q: string): { text: string; match: boolean }[] {
    if (!q) return [{ text: label, match: false }];
    const idx = label.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return [{ text: label, match: false }];
    return [
      ...(idx > 0 ? [{ text: label.slice(0, idx), match: false }] : []),
      {
        text: label.slice(idx, idx + q.length),
        match: true,
      },
      ...(idx + q.length < label.length
        ? [
            {
              text: label.slice(idx + q.length),
              match: false,
            },
          ]
        : []),
    ];
  }

  function handleBlur(e: FocusEvent) {
    const related = e.relatedTarget as Node | null;
    if (containerEl && related && containerEl.contains(related)) {
      return;
    }
    closeDropdown();
  }

  function preventBlur(e: MouseEvent) {
    e.preventDefault();
  }
</script>

<div class="kit-typeahead" bind:this={containerEl}>
  {#if open}
    <input
      bind:this={inputEl}
      class="kit-typeahead__input"
      type="text"
      bind:value={query}
      oninput={() => (highlightIndex = 0)}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      {placeholder}
      {disabled}
      aria-label={placeholder}
      autocomplete="off"
    />
    <ul
      class="kit-typeahead__list"
      style={listStyle}
      bind:this={listEl}
      role="listbox"
      onmousedown={preventBlur}
    >
      {#each filtered as option, i (option.name)}
        <li
          class="kit-typeahead__option"
          class:highlighted={i === highlightIndex}
          class:selected={option.name === value}
          role="option"
          aria-selected={option.name === value}
          onmousedown={() => select(option.name)}
          onmouseenter={() => (highlightIndex = i)}
        >
          {#each highlightSegments(option.label, query) as seg, segIndex (segIndex)}
            {#if seg.match}<mark class="kit-typeahead__match">{seg.text}</mark
              >{:else}{seg.text}{/if}
          {/each}
        </li>
      {:else}
        <li class="kit-typeahead__empty">{emptyLabel}</li>
      {/each}
    </ul>
  {:else}
    <button
      class="kit-typeahead__trigger"
      type="button"
      onclick={openDropdown}
      {title}
      {disabled}
      aria-label={placeholder}
    >
      <span class="kit-typeahead__value">{displayValue}</span>
      <ChevronDownIcon
        class="kit-typeahead__chevron"
        size="12"
        strokeWidth="2"
        aria-hidden="true"
      />
    </button>
  {/if}
</div>

<style>
  .kit-typeahead {
    position: relative;
    min-width: var(--typeahead-min-width, 180px);
    max-width: var(--typeahead-max-width, 300px);
  }

  .kit-typeahead__trigger {
    height: var(--typeahead-control-height, 26px);
    width: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: var(--typeahead-control-padding, 0 8px);
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--typeahead-control-font-size, var(--font-size-xs));
    color: var(--text-secondary);
    cursor: pointer;
    transition: border-color var(--transition-fast);
    text-align: left;
  }

  .kit-typeahead__trigger:hover {
    border-color: var(--border-default);
  }

  .kit-typeahead__trigger:focus {
    outline: none;
    border-color: var(--accent-blue);
  }

  .kit-typeahead__trigger:disabled {
    opacity: var(--opacity-disabled);
    cursor: default;
  }

  .kit-typeahead__value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.kit-typeahead__chevron) {
    flex-shrink: 0;
    opacity: 0.72;
  }

  .kit-typeahead__input {
    height: var(--typeahead-control-height, 26px);
    width: 100%;
    padding: var(--typeahead-control-padding, 0 8px);
    background: var(--bg-inset);
    border: 1px solid var(--accent-blue);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--typeahead-control-font-size, var(--font-size-xs));
    color: var(--text-primary);
    outline: none;
    box-sizing: border-box;
  }

  .kit-typeahead__input::placeholder {
    color: var(--text-muted);
  }

  .kit-typeahead__list {
    position: fixed;
    box-sizing: border-box;
    max-height: 50vh;
    overflow-y: auto;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    list-style: none;
    padding: 2px;
    margin-block-end: 0;
  }

  .kit-typeahead__option {
    padding: 4px 8px;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kit-typeahead__option.highlighted {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-typeahead__option.selected {
    color: var(--accent-blue);
    font-weight: 600;
  }

  .kit-typeahead__match {
    background: color-mix(in srgb, var(--accent-blue) 40%, transparent);
    color: var(--accent-blue);
    font-weight: 600;
    border-radius: 1px;
  }

  .kit-typeahead__empty {
    padding: 6px 8px;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
  }
</style>
