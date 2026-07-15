<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { tick, type Snippet } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
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
    /** Prepend a row that selects `""`; the trigger falls back to
     * `fallbackLabel` when nothing matches the value. */
    allowClear?: boolean;
    clearLabel?: string;
    /** With no matching option, offer a row that selects the trimmed query
     * verbatim. */
    allowCustom?: boolean;
    /** Label of the custom-value row; `{query}` is replaced with the trimmed
     * query. */
    customLabel?: string;
    /** Force the list above/below the trigger; "auto" (default) flips near
     * the viewport bottom. */
    placement?: "auto" | "top" | "bottom";
    /** Dim text rendered before the value on the closed trigger. */
    triggerPrefix?: string;
    /** Replace the option rows with a loading row (async option sources). */
    loading?: boolean;
    loadingLabel?: string;
    /** Disable local filtering when the caller supplies remotely filtered options. */
    remote?: boolean;
    /** Called when the open input query changes, including reset on open and close. */
    onquery?: (query: string) => void;
    /** Error row rendered above the options, which stay selectable so the
     * user can retry (clear it in `onselect`). */
    error?: string;
    /** Rendered inside the popover above the option list (e.g. a tab
     * switcher); receives no arguments. */
    header?: Snippet;
    /** Return `false` (or a promise of `false`), or throw, to keep the list
     * open — e.g. to veto a value or surface `error`. */
    onselect: (value: string) => void | boolean | Promise<void | boolean>;
  }

  let {
    options,
    value,
    fallbackLabel,
    placeholder,
    title,
    emptyLabel = "No matches",
    disabled = false,
    allowClear = false,
    clearLabel = "None",
    allowCustom = false,
    customLabel = 'Use "{query}"',
    placement = "auto",
    triggerPrefix = "",
    loading = false,
    loadingLabel = "Loading…",
    remote = false,
    onquery,
    error = "",
    header,
    onselect,
  }: Props = $props();

  let query = $state("");
  let open = $state(false);
  let highlightIndex = $state(0);
  let inputEl = $state<HTMLInputElement>();
  let triggerEl = $state<HTMLButtonElement>();
  let containerEl = $state<HTMLDivElement>();
  let panelEl = $state<HTMLDivElement>();
  let panelStyle = $state("");
  // Guards the focusout dismissal during the trigger→input focus handoff.
  let opening = false;
  // Group rows the user has toggled away from their initial state.
  let expansionOverrides = $state<Record<string, boolean>>({});
  // Remote result sets are commonly cleared when the picker closes. Retain
  // labels by option name so the controlled value still has meaningful trigger
  // text after its source row disappears. Versions prevent an older async
  // selection from replacing a newer label for the same option.
  const selectedLabelCache = new SvelteMap<string, { label: string; version: number }>();
  let labelSeq = 0;

  const uid = $props.id();
  const listId = `${uid}-list`;

  interface Row {
    option: TypeaheadOption;
    depth: number;
    group: boolean;
    expanded: boolean;
  }

  // Fixed positioning (same contract as SelectDropdown) so the list is
  // never clipped by an overflow-hidden ancestor; width pins to the
  // trigger so long labels keep truncating instead of widening the menu.
  function positionPanel(): void {
    if (!containerEl || !panelEl) return;
    const trigger = containerEl.getBoundingClientRect();
    panelStyle = `${floatingPopoverStyle({
      trigger,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: trigger.width,
      popoverHeight: panelEl.offsetHeight,
      triggerGap: 2,
      placement: placement === "top" ? "above" : placement === "bottom" ? "below" : "auto",
    })}; width: ${Math.round(trigger.width)}px`;
  }

  // Filtering/expansion changes the panel's height — keep the flip/clamp
  // current. No dismissable() here: the typeahead closes on blur instead.
  $effect(() => {
    if (!open) return;
    return autoReposition(() => panelEl, positionPanel);
  });

  function matches(option: TypeaheadOption, q: string): boolean {
    return [option.label, option.name, option.meta ?? ""].some((part) =>
      part.toLowerCase().includes(q),
    );
  }

  function isExpanded(option: TypeaheadOption): boolean {
    return expansionOverrides[option.name] ?? option.expanded ?? true;
  }

  /** Flatten the option tree into visible rows. While filtering, groups are
   * forced open and shown only when they (or a descendant) match; a group
   * whose own label matches keeps all its descendants. */
  function buildRows(opts: TypeaheadOption[], depth: number, q: string, force: boolean): Row[] {
    const rows: Row[] = [];
    for (const option of opts) {
      if (option.children) {
        const selfMatch = q !== "" && matches(option, q);
        const kids = buildRows(option.children, depth + 1, selfMatch ? "" : q, force || selfMatch);
        if (q !== "" && !selfMatch && kids.length === 0) continue;
        const expanded = q !== "" || force ? true : isExpanded(option);
        rows.push({ option, depth, group: true, expanded });
        if (expanded) rows.push(...kids);
      } else if (q === "" || matches(option, q)) {
        rows.push({ option, depth, group: false, expanded: false });
      }
    }
    return rows;
  }

  const filterQuery = $derived(remote ? "" : query.trim().toLowerCase());
  const rows = $derived(buildRows(options, 0, filterQuery, false));
  const grouped = $derived(options.some((o) => o.children));
  const clearOffset = $derived(allowClear ? 1 : 0);
  // With no matches, the custom value is a real row (at index `clearOffset`)
  // rather than hidden Enter behavior, so aria-activedescendant always names
  // the row Enter will commit.
  const customValue = $derived(allowCustom && rows.length === 0 ? query.trim() : "");
  const rowCount = $derived(rows.length + clearOffset + (customValue !== "" ? 1 : 0));

  // Async option/header swaps can shrink the list under the highlight, so
  // rendering, aria-activedescendant, and selection all read this clamped
  // view — it always names a rendered row (with zero rows the descendant is
  // dropped instead).
  const activeIndex = $derived(Math.min(highlightIndex, Math.max(rowCount - 1, 0)));

  function findByName(opts: TypeaheadOption[], name: string): TypeaheadOption | undefined {
    for (const option of opts) {
      if (option.name === name) return option;
      const child = option.children && findByName(option.children, name);
      if (child) return child;
    }
    return undefined;
  }

  const selectedOption = $derived(value === "" ? undefined : findByName(options, value));
  // A custom value has no matching option — show it verbatim so the closed
  // trigger doesn't look unselected.
  const displayValue = $derived(
    selectedOption?.displayLabel ??
      selectedOption?.label ??
      (remote ? selectedLabelCache.get(value)?.label : undefined) ??
      (allowCustom && value !== "" ? value : fallbackLabel),
  );

  function cacheSelectedLabel(name: string, label: string, version = ++labelSeq): void {
    const cached = selectedLabelCache.get(name);
    if (!cached || cached.version <= version) {
      selectedLabelCache.set(name, { label, version });
    }
  }

  function rememberSelectedLabel(): void {
    if (!remote || !selectedOption) return;
    cacheSelectedLabel(selectedOption.name, selectedOption.displayLabel ?? selectedOption.label);
  }

  function updateQuery(nextQuery: string): void {
    rememberSelectedLabel();
    query = nextQuery;
    onquery?.(nextQuery);
  }

  async function openDropdown() {
    if (disabled) return;
    updateQuery("");
    open = true;
    // The trigger button unmounts as the input mounts; focus briefly lands on
    // <body> and would fire focusout on the container. Suppress dismissal
    // until we've handed focus to the input.
    opening = true;
    highlightIndex = rows.length > 0 ? clearOffset : 0;
    await tick();
    positionPanel();
    inputEl?.focus();
    opening = false;
  }

  // `refocus` moves focus to the (re-mounted) trigger — pass it whenever the
  // close is keyboard-driven (Escape, Enter-select), where unmounting the
  // input would otherwise drop focus on <body>. Focusout-driven closes must
  // NOT refocus: the user is deliberately leaving.
  async function closeDropdown(refocus = false) {
    open = false;
    updateQuery("");
    // Invalidate in-flight selections: a slow onselect from this (or an
    // earlier) open instance must not close a menu the user reopens later.
    selectSeq += 1;
    if (refocus) {
      await tick();
      triggerEl?.focus();
    }
  }

  // Orders concurrent async onselect calls: only the latest attempt may close
  // the list, so a slow earlier selection resolving after a later veto/error
  // can't hide the caller's error state, and none may outlive the open
  // instance it started in (closeDropdown bumps the token).
  let selectSeq = 0;

  async function select(name: string) {
    const seq = ++selectSeq;
    const option = findByName(options, name);
    const selectedLabel = option?.displayLabel ?? option?.label;
    const selectedLabelVersion = ++labelSeq;
    try {
      const vetoed = (await onselect(name)) === false;
      if (!vetoed) {
        if (remote && selectedLabel !== undefined) {
          cacheSelectedLabel(name, selectedLabel, selectedLabelVersion);
        }
        if (seq === selectSeq) void closeDropdown(true);
      }
    } catch {
      // Keep the list open so the caller can surface its own error state
      // (e.g. the `error` prop) without losing the attempted value.
    }
  }

  function toggleExpand(option: TypeaheadOption) {
    expansionOverrides[option.name] = !isExpanded(option);
  }

  function activateRow(row: Row) {
    if (row.group) toggleExpand(row.option);
    else void select(row.option.name);
  }

  // Enter commits exactly the row aria-activedescendant names — never a
  // different value than what a screen reader announced as active.
  function selectHighlighted() {
    if (allowClear && activeIndex === 0) {
      void select("");
      return;
    }
    if (customValue !== "" && activeIndex === clearOffset) {
      void select(customValue);
      return;
    }
    const row = rows[activeIndex - clearOffset];
    if (row) activateRow(row);
  }

  // Escape must close the typeahead from any focused descendant — the input
  // or a header snippet control — without also closing a parent overlay.
  // Attached to both the input and the panel (the header lives in the panel,
  // which is a DOM sibling of the input). Skips events a descendant already
  // consumed, e.g. a header SearchInput clearing its own text.
  function handleEscape(e: KeyboardEvent): boolean {
    if (e.key !== "Escape" || e.defaultPrevented) return false;
    e.preventDefault();
    e.stopPropagation();
    void closeDropdown(true);
    return true;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (handleEscape(e)) return;
    // A loading status row stands in for the options, so there is nothing to
    // navigate to or select — keep selection/navigation keys inert (Enter
    // would otherwise submit an enclosing form) but let editing keys reach
    // the input. An error row does NOT stand in: the options stay selectable
    // so the user can immediately retry (which is where callers clear the
    // caller-owned `error`).
    if (loading) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(activeIndex + 1, Math.max(rowCount - 1, 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "ArrowRight" && grouped && filterQuery === "") {
      const row = rows[activeIndex - clearOffset];
      if (row?.group && !row.expanded) {
        e.preventDefault();
        toggleExpand(row.option);
      }
    } else if (e.key === "ArrowLeft" && grouped && filterQuery === "") {
      const idx = activeIndex - clearOffset;
      const row = rows[idx];
      if (!row) return;
      if (row.group && row.expanded) {
        e.preventDefault();
        toggleExpand(row.option);
      } else if (row.depth > 0) {
        // On a leaf (or an already-collapsed group), move to the parent:
        // the nearest preceding row at a shallower depth.
        e.preventDefault();
        for (let i = idx - 1; i >= 0; i -= 1) {
          if (rows[i]!.depth < row.depth) {
            highlightIndex = i + clearOffset;
            break;
          }
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectHighlighted();
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

  // focusout bubbles (blur does not), so one handler on the container catches
  // focus leaving the input *or* a focusable header control. Without it, a
  // keyboard user could tab from the input into a header button and then out
  // of the component, leaving the panel stuck open.
  function handleFocusOut(e: FocusEvent) {
    if (opening) return;
    const related = e.relatedTarget as Node | null;
    if (containerEl && related && containerEl.contains(related)) return;
    closeDropdown();
  }

  function preventBlur(e: MouseEvent) {
    e.preventDefault();
  }
</script>

{#snippet segments(text: string)}
  {#each highlightSegments(text, query.trim()) as seg, segIndex (segIndex)}
    {#if seg.match}<mark class="kit-typeahead__match">{seg.text}</mark>{:else}{seg.text}{/if}
  {/each}
{/snippet}

<div class="kit-typeahead" bind:this={containerEl} onfocusout={handleFocusOut}>
  {#if open}
    <input
      bind:this={inputEl}
      class="kit-typeahead__input"
      type="text"
      role="combobox"
      value={query}
      oninput={(event) => {
        updateQuery(event.currentTarget.value);
        highlightIndex = clearOffset;
      }}
      onkeydown={handleKeydown}
      {placeholder}
      {disabled}
      aria-label={placeholder}
      aria-expanded="true"
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={!loading && rowCount > 0 ? `${listId}-row-${activeIndex}` : undefined}
      autocomplete="off"
    />
    <div
      class="kit-typeahead__panel kit-popover-card"
      style={panelStyle}
      bind:this={panelEl}
      onmousedown={preventBlur}
      onkeydown={(e) => void handleEscape(e)}
      role="presentation"
    >
      {#if header}
        <div class="kit-typeahead__header">{@render header()}</div>
      {/if}
      <ul
        class="kit-typeahead__list"
        id={listId}
        role={grouped ? "tree" : "listbox"}
        aria-label={placeholder}
      >
        {#if loading}
          <li class="kit-typeahead__status" role="presentation">{loadingLabel}</li>
        {:else}
          {#if error}
            <!-- Above (not instead of) the options: the user must be able to
                 retry, since callers clear `error` on the next onselect.
                 role="alert" announces the veto to screen readers. -->
            <li class="kit-typeahead__status kit-typeahead__status--error" role="alert">
              {error}
            </li>
          {/if}
          {#if allowClear}
            <li
              class="kit-typeahead__option"
              class:highlighted={activeIndex === 0}
              class:selected={value === ""}
              id={`${listId}-row-0`}
              role={grouped ? "treeitem" : "option"}
              aria-selected={value === ""}
              onmousedown={() => void select("")}
              onmouseenter={() => (highlightIndex = 0)}
            >
              <span class="kit-typeahead__option-label">{clearLabel}</span>
            </li>
          {/if}
          {#each rows as row, i (row.option.name)}
            <li
              class="kit-typeahead__option"
              class:kit-typeahead__option--group={row.group}
              class:highlighted={i + clearOffset === activeIndex}
              class:selected={!row.group && row.option.name === value}
              id={`${listId}-row-${i + clearOffset}`}
              role={grouped ? "treeitem" : "option"}
              aria-selected={row.group ? undefined : row.option.name === value}
              aria-expanded={row.group ? row.expanded : undefined}
              aria-level={grouped ? row.depth + 1 : undefined}
              style:--typeahead-depth={row.depth}
              onmousedown={() => activateRow(row)}
              onmouseenter={() => (highlightIndex = i + clearOffset)}
            >
              {#if row.group}
                <ChevronRightIcon
                  class="kit-typeahead__group-chevron{row.expanded
                    ? ' kit-typeahead__group-chevron--open'
                    : ''}"
                  size="12"
                  strokeWidth="2"
                  aria-hidden="true"
                />
              {/if}
              <span class="kit-typeahead__option-label">
                {@render segments(row.option.label)}
              </span>
              {#if row.option.meta}
                <span class="kit-typeahead__option-meta">
                  {@render segments(row.option.meta)}
                </span>
              {/if}
            </li>
          {:else}
            {#if customValue !== ""}
              <li
                class="kit-typeahead__option"
                class:highlighted={activeIndex === clearOffset}
                class:selected={customValue === value}
                id={`${listId}-row-${clearOffset}`}
                role={grouped ? "treeitem" : "option"}
                aria-selected={customValue === value}
                aria-level={grouped ? 1 : undefined}
                onmousedown={() => void select(customValue)}
                onmouseenter={() => (highlightIndex = clearOffset)}
              >
                <span class="kit-typeahead__option-label">
                  {customLabel.replace("{query}", customValue)}
                </span>
              </li>
            {:else}
              <li class="kit-typeahead__empty" role="presentation">{emptyLabel}</li>
            {/if}
          {/each}
        {/if}
      </ul>
    </div>
  {:else}
    <button
      bind:this={triggerEl}
      class="kit-typeahead__trigger"
      type="button"
      onclick={openDropdown}
      {title}
      {disabled}
      aria-label={triggerPrefix ? `${triggerPrefix} ${displayValue}` : placeholder}
    >
      <span class="kit-typeahead__value">
        {#if triggerPrefix}<span class="kit-typeahead__prefix">{triggerPrefix}</span>{/if}
        <span class="kit-typeahead__value-text">{displayValue}</span>
      </span>
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
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--typeahead-control-font-size, var(--font-size-xs));
    color: var(--text-secondary);
    cursor: pointer;
    transition: border-color var(--transition-fast) var(--transition-ease, ease);
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
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .kit-typeahead__value-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-typeahead__prefix {
    flex-shrink: 0;
    color: var(--text-muted);
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
    border: var(--border-width) solid var(--accent-blue);
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

  .kit-typeahead__panel {
    position: fixed;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    max-height: 50vh;
    z-index: var(--z-popover);
    padding: 2px;
  }

  .kit-typeahead__header {
    flex-shrink: 0;
    padding: 2px;
    border-bottom: 1px solid var(--border-muted);
    margin-bottom: 2px;
  }

  .kit-typeahead__list {
    overflow-y: auto;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .kit-typeahead__option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    padding-left: calc(8px + var(--typeahead-depth, 0) * 14px);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }

  .kit-typeahead__option-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-typeahead__option-meta {
    flex-shrink: 0;
    margin-left: auto;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kit-typeahead__option--group {
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold, 600);
  }

  :global(.kit-typeahead__group-chevron) {
    flex-shrink: 0;
    opacity: 0.72;
    transition: transform var(--transition-fast) var(--transition-ease, ease);
  }

  :global(.kit-typeahead__group-chevron--open) {
    transform: rotate(90deg);
  }

  .kit-typeahead__option.highlighted {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-typeahead__option.selected {
    color: var(--accent-blue);
    font-weight: var(--font-weight-semibold, 600);
  }

  .kit-typeahead__match {
    background: color-mix(in srgb, var(--accent-blue) 40%, transparent);
    color: var(--accent-blue);
    font-weight: var(--font-weight-semibold, 600);
    border-radius: 1px;
  }

  .kit-typeahead__empty,
  .kit-typeahead__status {
    padding: 6px 8px;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
  }

  .kit-typeahead__status--error {
    color: var(--accent-red);
    font-style: normal;
  }
</style>
