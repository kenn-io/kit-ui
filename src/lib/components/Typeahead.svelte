<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { tick, type Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import { SvelteMap } from "svelte/reactivity";
  import { highlightSegments } from "../utils/highlight.js";
  import { autoReposition } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import type {
    TypeaheadInputAttributes,
    TypeaheadOption,
    TypeaheadTriggerProps,
  } from "./typeahead.js";

  interface Props {
    options: TypeaheadOption[];
    /** The chosen option name. Unused in `multiple` mode, which reads
     * `values`. */
    value?: string;
    /** Choose several options: each choice calls `onselect` with that
     * option's name and the list stays open. The caller adds or removes it
     * from `values`. */
    multiple?: boolean;
    /** The chosen option names in `multiple` mode. */
    values?: readonly string[];
    /** Closed-trigger text when `multiple` has more than one choice;
     * `{count}` is replaced with the number chosen. */
    multipleLabel?: string;
    fallbackLabel: string;
    placeholder: string;
    /** Native attributes for the open search input. Typeahead-owned behavior
     * and ARIA attributes take precedence. */
    inputAttributes?: TypeaheadInputAttributes;
    title?: string;
    emptyLabel?: string;
    disabled?: boolean;
    /** Prepend a row that selects `""`; the trigger falls back to
     * `fallbackLabel` when nothing matches the value. */
    allowClear?: boolean;
    clearLabel?: string;
    /** Start on the first visible choice instead of a group row. */
    highlightFirstOption?: boolean;
    /** Offer any non-empty trimmed query that is not an exact option name as
     * a row that selects the query verbatim. */
    allowCustom?: boolean;
    /** Label of the custom-value row; `{query}` is replaced with the trimmed
     * query. */
    customLabel?: string;
    /** Force the list above/below the trigger; "auto" (default) flips near
     * the viewport bottom. */
    placement?: "auto" | "top" | "bottom";
    /** Align the panel's left edge and width with this element. */
    panelAnchor?: HTMLElement;
    /** Dim text rendered before the value on the closed trigger. */
    triggerPrefix?: string;
    /** Replace the option rows with a loading row (async option sources). */
    loading?: boolean;
    loadingLabel?: string;
    /** Disable local filtering when the caller supplies remotely filtered options. */
    remote?: boolean;
    /** Called when the query changes, including the initial query on open and reset on close. */
    onquery?: (query: string) => void;
    /** Error row rendered above the options, which stay selectable so the
     * user can retry (clear it in `onselect`). */
    error?: string;
    /** Rendered inside the popover above the option list (e.g. a tab
     * switcher); receives no arguments. */
    header?: Snippet;
    /** Decorative icon before each option and the selected trigger label. */
    icon?: Snippet<[TypeaheadOption]>;
    /** Replaces the built-in trigger with a button the caller renders, such as an
     * IconButton. Attach `attachment` to it. The button stays in place while
     * the list is open and the search field moves into the popover. The
     * caller names the button. */
    trigger?: Snippet<[TypeaheadTriggerProps]>;
    /** Return `false` (or a promise of `false`), or throw, to keep the list
     * open — e.g. to veto a value or surface `error`. */
    onselect: (value: string) => void | boolean | Promise<void | boolean>;
  }

  let {
    options,
    value = "",
    multiple = false,
    values = [],
    multipleLabel = "{count} selected",
    fallbackLabel,
    placeholder,
    inputAttributes = {},
    title,
    emptyLabel = "No matches",
    disabled = false,
    allowClear = false,
    clearLabel = "None",
    highlightFirstOption = false,
    allowCustom = false,
    customLabel = 'Use "{query}"',
    placement = "auto",
    panelAnchor,
    triggerPrefix = "",
    loading = false,
    loadingLabel = "Loading…",
    remote = false,
    onquery,
    error = "",
    header,
    icon,
    trigger,
    onselect,
  }: Props = $props();

  let query = $state("");
  let open = $state(false);
  // -1 follows the default row as options change.
  let highlightIndex = $state(-1);
  let inputEl = $state<HTMLInputElement>();
  // The built-in trigger, or the caller's button when `trigger` is set.
  let triggerEl = $state<HTMLButtonElement>();
  let containerEl = $state<HTMLDivElement>();
  // What the hidden trigger showed when the list opened. It keeps showing it
  // while open, so a choice in `multiple` mode, a custom value, or a remote
  // label never resizes the field under the pointer. No width is pinned, so
  // the field still follows its container and app CSS.
  let openLabel = $state<string>();
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
    posInSet: number;
    setSize: number;
  }

  // Fixed positioning (same contract as SelectDropdown) so the list is
  // never clipped by an overflow-hidden ancestor. The list is as wide as the
  // trigger so long labels keep truncating instead of widening the menu,
  // unless `--typeahead-panel-min-width` asks for more room (a compact
  // trigger over long option labels). The wider list is positioned with its
  // real width, so it slides left to stay inside the viewport instead of
  // hanging past the right edge.
  function positionPanel(): void {
    if (!containerEl || !panelEl) return;
    // Fixed offsets and offsetWidth/Height use the menu's unzoomed CSS units.
    // Engines without currentCSSZoom (WebKit's Linux ports) get the
    // pre-zoom-aware maths; dividing by undefined would NaN the whole style
    // and leave the panel unpositioned and unsized.
    const zoom = panelEl.currentCSSZoom ?? 1;
    // A caller's button stays visible while open, so the list hangs off it.
    const rect = (trigger && triggerEl ? triggerEl : containerEl).getBoundingClientRect();
    const horizontalRect = panelAnchor?.getBoundingClientRect() ?? rect;
    const anchor = new DOMRect(
      horizontalRect.left / zoom,
      rect.top / zoom,
      horizontalRect.width / zoom,
      rect.height / zoom,
    );
    const viewportWidth = window.innerWidth / zoom;
    // CSS vw ignores ancestor zoom, so the stylesheet's width cap reads this
    // instead. Set it before measuring so min-width resolves against it.
    const maxWidth = Math.max(0, viewportWidth - 16);
    const widthLimit = `${maxWidth}px`;
    panelEl.style.setProperty("--kit-typeahead-width-limit", widthLimit);
    const minWidth = parseFloat(getComputedStyle(panelEl).minWidth) || 0;
    // A trigger wider than the window must not drag the list off screen.
    const width = Math.min(Math.max(anchor.width, minWidth), maxWidth);
    panelStyle = `${floatingPopoverStyle({
      trigger: anchor,
      viewportWidth,
      viewportHeight: window.innerHeight / zoom,
      popoverWidth: width,
      popoverHeight: panelEl.offsetHeight,
      triggerGap: trigger ? 4 : 2,
      placement: placement === "top" ? "above" : placement === "bottom" ? "below" : "auto",
    })}; width: ${Math.round(width)}px; --kit-typeahead-width-limit: ${widthLimit}`;
  }

  // Filtering/expansion changes the panel's height — keep the flip/clamp
  // current. No dismissable() here: the typeahead closes on blur instead.
  $effect(() => {
    if (!open) return;
    return autoReposition(() => [panelEl, triggerEl, containerEl, panelAnchor], positionPanel);
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
    const visible: {
      option: TypeaheadOption;
      group: boolean;
      expanded: boolean;
      children: Row[];
    }[] = [];
    for (const option of opts) {
      if (option.children) {
        const selfMatch = q !== "" && matches(option, q);
        const kids = buildRows(option.children, depth + 1, selfMatch ? "" : q, force || selfMatch);
        if (q !== "" && !selfMatch && kids.length === 0) continue;
        const expanded = q !== "" || force ? true : isExpanded(option);
        visible.push({ option, group: true, expanded, children: kids });
      } else if (q === "" || matches(option, q)) {
        visible.push({ option, group: false, expanded: false, children: [] });
      }
    }
    return visible.flatMap(({ option, group, expanded, children }, index) => {
      const row = {
        option,
        depth,
        group,
        expanded,
        posInSet: index + 1,
        setSize: visible.length,
      };
      return group && expanded ? [row, ...children] : [row];
    });
  }

  const filterQuery = $derived(remote ? "" : query.trim().toLowerCase());
  const rows = $derived(buildRows(options, 0, filterQuery, false));
  const firstOptionIndex = $derived.by(() => {
    if (!highlightFirstOption) return 0;
    const index = rows.findIndex((row) => !row.group);
    return index === -1 ? (customValue !== "" ? rows.length : 0) : index;
  });
  const grouped = $derived(options.some((o) => o.children));
  const clearOffset = $derived(allowClear ? 1 : 0);
  const exactOption = $derived(findByName(options, query.trim()));
  const customValue = $derived(
    allowCustom && query.trim() !== "" && !exactOption ? query.trim() : "",
  );
  const customOffset = $derived(clearOffset + rows.length);
  const rowCount = $derived(rows.length + clearOffset + (customValue !== "" ? 1 : 0));
  // The listbox (or tree) exists only while it has rows to choose from: an
  // empty one is invalid ARIA, so loading, empty, and error messages render
  // beside it and the combobox reports its popup collapsed meanwhile.
  const listShown = $derived(!loading && rowCount > 0);
  const rootTreeSize = $derived(
    rows.filter((row) => row.depth === 0).length + clearOffset + (customValue !== "" ? 1 : 0),
  );

  // Async option/header swaps can shrink the list under the highlight, so
  // rendering, aria-activedescendant, and selection all read this clamped
  // view — it always names a rendered row (with zero rows the descendant is
  // dropped instead).
  const activeIndex = $derived(
    Math.min(
      highlightIndex < 0 ? clearOffset + firstOptionIndex : highlightIndex,
      Math.max(rowCount - 1, 0),
    ),
  );

  function findByName(opts: TypeaheadOption[], name: string): TypeaheadOption | undefined {
    for (const option of opts) {
      if (option.name === name) return option;
      const child = option.children && findByName(option.children, name);
      if (child) return child;
    }
    return undefined;
  }

  function isChosen(name: string): boolean {
    return multiple ? values.includes(name) : name === value;
  }
  const nothingChosen = $derived(multiple ? values.length === 0 : value === "");
  // The one value the closed trigger names: in multiple mode, the only
  // choice, or none when there are several.
  const shownValue = $derived(multiple ? (values.length === 1 ? values[0]! : "") : value);
  const selectedOption = $derived(shownValue === "" ? undefined : findByName(options, shownValue));
  // A custom value has no matching option — show it verbatim so the closed
  // trigger doesn't look unselected.
  const displayValue = $derived(
    multiple && values.length > 1
      ? multipleLabel.replace("{count}", String(values.length))
      : (selectedOption?.displayLabel ??
          selectedOption?.label ??
          (remote ? selectedLabelCache.get(shownValue)?.label : undefined) ??
          (allowCustom && shownValue !== "" ? shownValue : fallbackLabel)),
  );
  // A row of M's, the widest letter, as long as the longest label the
  // built-in trigger can show. It sits invisibly under the current label, so
  // the trigger is as wide as its longest choice, as a native select is, and
  // choosing an option never resizes it. A remote list changes with every
  // query, so only the fixed labels count there; the frozen open label
  // covers the rest.
  const triggerLabel = $derived(open && openLabel !== undefined ? openLabel : displayValue);
  const reservedWidth = $derived.by(() => {
    if (trigger) return "";
    // fallbackLabel is typed as required, but some callers leave it out.
    let longest = Math.max(fallbackLabel?.length ?? 0, triggerLabel?.length ?? 0);
    let count = 0;
    const walk = (opts: TypeaheadOption[]) => {
      for (const option of opts) {
        count += 1;
        if (!remote) longest = Math.max(longest, (option.displayLabel ?? option.label).length);
        if (option.children) walk(option.children);
      }
    };
    walk(options);
    if (multiple) {
      const label = multipleLabel.replace("{count}", String(Math.max(count, 2)));
      longest = Math.max(longest, label.length);
    }
    return "M".repeat(longest);
  });

  // The closed trigger's accessible name carries the current selection, so a
  // screen reader hears "Time zone: UTC" rather than only the placeholder.
  const triggerName = $derived(
    triggerPrefix
      ? `${triggerPrefix} ${displayValue}`
      : displayValue && displayValue !== placeholder
        ? `${placeholder}: ${displayValue}`
        : placeholder,
  );

  function cacheSelectedLabel(name: string, label: string, version = ++labelSeq): void {
    const cached = selectedLabelCache.get(name);
    if (!cached || cached.version <= version) {
      selectedLabelCache.set(name, { label, version });
    }
  }

  // With several choices no single option is "selected", so remember the
  // label of every chosen row still listed. Removing all but one choice
  // must leave its label on the trigger after the remote rows are gone.
  function rememberSelectedLabel(): void {
    if (!remote) return;
    const chosen = multiple ? values : selectedOption ? [selectedOption.name] : [];
    for (const name of chosen) {
      const option = findByName(options, name);
      if (option) cacheSelectedLabel(name, option.displayLabel ?? option.label);
    }
  }

  function updateQuery(nextQuery: string): void {
    rememberSelectedLabel();
    query = nextQuery;
    onquery?.(nextQuery);
  }

  async function openDropdown(initialQuery = "") {
    if (disabled) return;
    updateQuery(initialQuery);
    openLabel = displayValue;
    open = true;
    // The trigger button hides as the input mounts over it; focus briefly
    // lands on <body> and would fire focusout on the container. Suppress
    // dismissal until we've handed focus to the input.
    opening = true;
    highlightIndex = !remote && customValue !== "" ? customOffset : -1;
    await tick();
    positionPanel();
    inputEl?.focus();
    opening = false;
  }

  // `refocus` moves focus back to the (re-shown) trigger — pass it whenever
  // the close is keyboard-driven (Escape, Enter-select), where unmounting the
  // input would otherwise drop focus on <body>. Focusout-driven closes must
  // NOT refocus: the user is deliberately leaving.
  async function closeDropdown(refocus = false) {
    open = false;
    openLabel = undefined;
    updateQuery("");
    // Invalidate in-flight selections: a slow onselect from this (or an
    // earlier) open instance must not close a menu the user reopens later.
    selectSeq += 1;
    if (refocus) {
      await tick();
      triggerEl?.focus();
    }
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void openDropdown();
      return;
    }
    if (
      event.key.length !== 1 ||
      event.key === " " ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    void openDropdown(event.key);
  }

  // Wires a caller's button the way MenuTrigger's `child` attachment does: it
  // adds the popup ARIA state, click and type-to-search handling, and
  // `kit-control-states`, and restores the button's own values on detach.
  const triggerAttachment: Attachment<HTMLButtonElement> = (node) => {
    const attributes = ["type", "aria-haspopup", "aria-expanded", "aria-controls"];
    const previousAttributes = new Map(
      attributes.map((name) => [name, node.getAttribute(name)] as const),
    );
    const wasDisabled = node.disabled;
    const hadControlStates = node.classList.contains("kit-control-states");
    // IconButton's ariaDisabled guards only its own onclick, not these
    // listeners.
    const unavailable = () => node.getAttribute("aria-disabled") === "true";
    // Safari and Firefox on macOS do not focus a pressed button, so the
    // input's blur would close the list before the click reopened it. Keep
    // focus in the input until the click closes the list.
    const mousedown = (event: MouseEvent) => {
      if (open) event.preventDefault();
    };
    const toggle = () => {
      if (open) void closeDropdown(true);
      else if (!unavailable()) void openDropdown();
    };
    const keydown = (event: KeyboardEvent) => {
      // Shift+Tab from the input lands here with the list still open.
      if (open && handleEscape(event)) return;
      if (unavailable()) return;
      handleTriggerKeydown(event);
    };

    triggerEl = node;
    node.classList.add("kit-control-states");
    node.addEventListener("mousedown", mousedown);
    node.addEventListener("click", toggle);
    node.addEventListener("keydown", keydown);

    $effect(() => {
      node.type = "button";
      node.setAttribute("aria-haspopup", grouped ? "tree" : "listbox");
      node.setAttribute("aria-expanded", String(open));
      if (open && listShown) node.setAttribute("aria-controls", listId);
      else node.removeAttribute("aria-controls");
      node.disabled = disabled;
    });

    return () => {
      node.removeEventListener("mousedown", mousedown);
      node.removeEventListener("click", toggle);
      node.removeEventListener("keydown", keydown);
      if (triggerEl === node) triggerEl = undefined;
      node.disabled = wasDisabled;
      if (!hadControlStates) node.classList.remove("kit-control-states");
      for (const [name, value] of previousAttributes) {
        if (value === null) node.removeAttribute(name);
        else node.setAttribute(name, value);
      }
    };
  };

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
        // A multiple choice leaves the list open for the next one.
        if (seq === selectSeq && !multiple) void closeDropdown(true);
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
    if (customValue !== "" && activeIndex === customOffset) {
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

  // focusout bubbles (blur does not), so one handler on the container catches
  // focus leaving the input *or* a focusable header control. Without it, a
  // keyboard user could tab from the input into a header button and then out
  // of the component, leaving the panel stuck open.
  function handleFocusOut(e: FocusEvent) {
    if (!open || opening) return;
    const related = e.relatedTarget as Node | null;
    if (containerEl && related && containerEl.contains(related)) return;
    closeDropdown();
  }

  // Keeps focus in the input while the pointer uses the list. A press on the
  // input itself, which sits in the popover under a caller's trigger, still
  // places the caret.
  function preventBlur(e: MouseEvent) {
    if (e.target === inputEl) return;
    e.preventDefault();
  }
</script>

{#snippet segments(text: string)}
  {#each highlightSegments(text, query.trim()) as seg, segIndex (segIndex)}
    {#if seg.match}<mark class="kit-typeahead__match">{seg.text}</mark>{:else}{seg.text}{/if}
  {/each}
{/snippet}

<!-- aria-selected carries the state; the mark only shows it. -->
{#snippet check(chosen: boolean)}
  <span class="kit-typeahead__check" aria-hidden="true">
    {#if chosen}<CheckIcon size="12" strokeWidth="2.2" />{/if}
  </span>
{/snippet}

{#snippet searchInput()}
  <input
    {...inputAttributes}
    bind:this={inputEl}
    class="kit-typeahead__input"
    class:kit-typeahead__input--over-trigger={!trigger}
    type="text"
    role="combobox"
    value={query}
    oninput={(event) => {
      updateQuery(event.currentTarget.value);
      highlightIndex = !remote && customValue !== "" ? customOffset : -1;
    }}
    onkeydown={handleKeydown}
    {placeholder}
    {disabled}
    aria-label={placeholder}
    aria-expanded={listShown}
    aria-controls={listShown ? listId : undefined}
    aria-haspopup={grouped ? "tree" : "listbox"}
    aria-autocomplete="list"
    aria-activedescendant={listShown ? `${listId}-row-${activeIndex}` : undefined}
    autocomplete="off"
    data-1p-ignore="true"
    data-bwignore="true"
    data-lpignore="true"
    data-form-type="other"
  />
{/snippet}

<div
  class="kit-typeahead"
  class:kit-typeahead--custom-trigger={trigger !== undefined}
  bind:this={containerEl}
  onfocusout={handleFocusOut}
>
  {#if trigger}
    {@render trigger({ attachment: triggerAttachment })}
  {:else}
    <!-- Stays laid out while open, hidden under the search input, so the
         control keeps the closed trigger's size and nothing beside it moves. -->
    <button
      bind:this={triggerEl}
      class="kit-typeahead__trigger kit-control-states"
      class:kit-typeahead__trigger--holding={open}
      type="button"
      onclick={() => void openDropdown()}
      onkeydown={handleTriggerKeydown}
      {title}
      {disabled}
      aria-label={triggerName}
    >
      <span class="kit-typeahead__value">
        {#if triggerPrefix}<span class="kit-typeahead__prefix">{triggerPrefix}</span>{/if}
        {#if icon}
          <span class="kit-typeahead__icon" aria-hidden="true">
            {#if selectedOption}{@render icon(selectedOption)}{/if}
          </span>
        {/if}
        <span class="kit-typeahead__value-text" data-reserve={reservedWidth}>
          <span class="kit-typeahead__value-label">{triggerLabel}</span>
        </span>
      </span>
      <ChevronDownIcon
        class="kit-typeahead__chevron"
        size="12"
        strokeWidth="2"
        aria-hidden="true"
      />
    </button>
  {/if}
  {#if open}
    {#if !trigger}{@render searchInput()}{/if}
    <div
      class="kit-typeahead__panel kit-popover-card"
      style={panelStyle}
      bind:this={panelEl}
      onmousedown={preventBlur}
      onkeydown={(e) => void handleEscape(e)}
      role="presentation"
    >
      {#if trigger}
        <div class="kit-typeahead__search">{@render searchInput()}</div>
      {/if}
      {#if header}
        <div class="kit-typeahead__header">{@render header()}</div>
      {/if}
      <!-- Messages sit outside the listbox but scroll with it, so a long error
           can't push the panel past its height cap and hide the options. -->
      <div class="kit-typeahead__body">
        {#if loading}
          <div class="kit-typeahead__status">{loadingLabel}</div>
        {:else if error}
          <!-- Above (not instead of) the options: the user must be able to
             retry, since callers clear `error` on the next onselect.
             role="alert" announces the veto to screen readers. -->
          <div class="kit-typeahead__status kit-typeahead__status--error" role="alert">
            {error}
          </div>
        {/if}
        {#if listShown}
          <ul
            class="kit-typeahead__list"
            id={listId}
            role={grouped ? "tree" : "listbox"}
            aria-label={placeholder}
            aria-multiselectable={multiple || undefined}
          >
            {#if allowClear}
              <li
                class="kit-typeahead__option"
                class:highlighted={activeIndex === 0}
                class:selected={nothingChosen}
                id={`${listId}-row-0`}
                role={grouped ? "treeitem" : "option"}
                aria-selected={nothingChosen}
                aria-level={grouped ? 1 : undefined}
                aria-posinset={grouped ? 1 : undefined}
                aria-setsize={grouped ? rootTreeSize : undefined}
                onmousedown={() => void select("")}
                onmouseenter={() => (highlightIndex = 0)}
              >
                {#if multiple}{@render check(nothingChosen)}{/if}
                {#if icon}<span class="kit-typeahead__icon" aria-hidden="true"></span>{/if}
                <span class="kit-typeahead__option-label">{clearLabel}</span>
              </li>
            {/if}
            {#each rows as row, i (row.option.name)}
              <li
                class="kit-typeahead__option"
                class:kit-typeahead__option--group={row.group}
                class:kit-typeahead__option--root-group={row.group && row.depth === 0}
                class:kit-typeahead__option--nested={row.depth > 0}
                class:highlighted={i + clearOffset === activeIndex}
                class:selected={!row.group && isChosen(row.option.name)}
                id={`${listId}-row-${i + clearOffset}`}
                role={grouped ? "treeitem" : "option"}
                aria-selected={row.group ? undefined : isChosen(row.option.name)}
                aria-expanded={row.group ? row.expanded : undefined}
                aria-level={grouped ? row.depth + 1 : undefined}
                aria-posinset={grouped
                  ? row.posInSet + (row.depth === 0 ? clearOffset : 0)
                  : undefined}
                aria-setsize={grouped ? (row.depth === 0 ? rootTreeSize : row.setSize) : undefined}
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
                {#if multiple && !row.group}{@render check(isChosen(row.option.name))}{/if}
                {#if icon}
                  <span class="kit-typeahead__icon" aria-hidden="true">
                    {@render icon(row.option)}
                  </span>
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
            {/each}
            {#if customValue !== ""}
              <li
                class="kit-typeahead__option"
                class:highlighted={activeIndex === customOffset}
                class:selected={isChosen(customValue)}
                id={`${listId}-row-${customOffset}`}
                role={grouped ? "treeitem" : "option"}
                aria-selected={isChosen(customValue)}
                aria-level={grouped ? 1 : undefined}
                aria-posinset={grouped ? rootTreeSize : undefined}
                aria-setsize={grouped ? rootTreeSize : undefined}
                onmousedown={() => void select(customValue)}
                onmouseenter={() => (highlightIndex = customOffset)}
              >
                {#if multiple}{@render check(isChosen(customValue))}{/if}
                {#if icon}<span class="kit-typeahead__icon" aria-hidden="true"></span>{/if}
                <span class="kit-typeahead__option-label">
                  {customLabel.replace("{query}", customValue)}
                </span>
              </li>
            {/if}
          </ul>
        {/if}
        {#if !loading && rows.length === 0 && customValue === ""}
          <div class="kit-typeahead__empty">{emptyLabel}</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .kit-typeahead {
    position: relative;
    min-width: min(100%, var(--typeahead-min-width, 180px));
    max-width: var(--typeahead-max-width, 300px);
  }

  .kit-typeahead__trigger {
    height: var(--typeahead-control-height, 26px);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: var(--typeahead-control-padding, 0 8px);
    background: var(--bg-raised, var(--bg-inset));
    border: var(--border-width) solid var(--border-muted);
    box-shadow: var(--shadow-raised, none);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--typeahead-control-font-size, var(--font-size-xs));
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      border-color var(--transition-fast) var(--transition-ease, ease),
      box-shadow var(--transition-fast) var(--transition-ease, ease);
    text-align: left;
  }

  .kit-typeahead__trigger:hover {
    border-color: var(--border-default);
  }

  .kit-typeahead__trigger:focus {
    outline: none;
    border-color: var(--accent-blue);
  }

  /* A press only: while open, the input covers the trigger and sinks as a field. */
  .kit-typeahead__trigger:where(:active:not(:disabled)) {
    background: var(--bg-inset);
    box-shadow: var(--shadow-sunken, none);
  }

  /* Open: the trigger keeps its box so the control never resizes, but the
     search input covers it and it leaves the focus order and a11y tree. */
  .kit-typeahead__trigger--holding {
    visibility: hidden;
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

  .kit-typeahead__icon {
    width: var(--typeahead-icon-width, 16px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  /* One grid cell holds the label and the reserved row of M's, so the
     column takes the wider; minmax(0, …) still lets a capped trigger ellipsize. */
  .kit-typeahead__value-text {
    display: grid;
    grid-template-columns: minmax(0, auto);
    min-width: 0;
  }

  .kit-typeahead__value-label,
  .kit-typeahead__value-text::after {
    grid-area: 1 / 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The reserved M's, plus a little slack so the longest label never sits
     tight against the chevron. Generated content, so they never join the
     trigger's text or accessible name; the second declaration gives them
     empty alternative text, as TopBar's reserved labels do. */
  .kit-typeahead__value-text::after {
    content: attr(data-reserve);
    content: attr(data-reserve) / "";
    height: 0;
    padding-inline-end: var(--space-2);
    visibility: hidden;
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
    box-shadow: var(--shadow-sunken, none);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--typeahead-control-font-size, var(--font-size-xs));
    color: var(--text-primary);
    outline: none;
    box-sizing: border-box;
  }

  .kit-typeahead__input--over-trigger {
    position: absolute;
    inset: 0;
    height: 100%;
  }

  .kit-typeahead__input::placeholder {
    color: var(--text-muted);
  }

  .kit-typeahead__panel {
    position: fixed;
    box-sizing: border-box;
    /* Never wider than the viewport minus the popover edge gaps, so the
       positioning clamp can always keep the list on screen. positionPanel
       sets the limit in zoom-corrected pixels; 100vw covers first paint. */
    min-width: min(
      var(--typeahead-panel-min-width, 0px),
      var(--kit-typeahead-width-limit, calc(100vw - 16px))
    );
    display: flex;
    flex-direction: column;
    max-height: 50vh;
    z-index: var(--z-popover);
    padding: 2px;
  }

  /* A caller's button sizes the component, and the list needs its own width. */
  .kit-typeahead--custom-trigger {
    display: inline-flex;
    min-width: 0;
    max-width: none;
  }

  .kit-typeahead--custom-trigger .kit-typeahead__panel {
    min-width: min(
      var(--typeahead-panel-min-width, 240px),
      var(--kit-typeahead-width-limit, calc(100vw - 16px))
    );
  }

  .kit-typeahead__search {
    flex-shrink: 0;
    padding: 2px;
    border-bottom: 1px solid var(--border-muted);
    margin-bottom: 2px;
  }

  .kit-typeahead__header {
    flex-shrink: 0;
    padding: 2px;
    border-bottom: 1px solid var(--border-muted);
    margin-bottom: 2px;
  }

  /* An overlay scrollbar draws over the row's trailing edge, so keep the
     meta text clear of it; a classic one gets its own gutter. */
  .kit-typeahead__body {
    min-height: 0;
    overflow-y: auto;
  }

  .kit-typeahead__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .kit-typeahead__option {
    position: relative;
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

  .kit-typeahead__check {
    display: inline-flex;
    flex-shrink: 0;
    width: 12px;
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
    gap: var(--space-2);
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold, 600);
  }

  .kit-typeahead__option--root-group {
    margin-top: var(--space-1);
    background-color: color-mix(in srgb, var(--bg-inset) 55%, transparent);
  }

  .kit-typeahead__option--nested {
    padding-left: calc(var(--space-7) + (var(--typeahead-depth) - 1) * var(--space-6));
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

  /* Primary ink on a light tint: accent-colored text on an accent tint
     can't reach AA (4.5:1) for option-sized text. */
  .kit-typeahead__match {
    background: color-mix(in srgb, var(--accent-blue) 22%, transparent);
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold, 600);
    border-radius: var(--radius-sm);
  }

  .kit-typeahead__empty,
  .kit-typeahead__status {
    padding: 6px 8px;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    font-style: italic;
  }

  .kit-typeahead__status--error {
    color: var(--accent-red);
    font-style: normal;
  }
</style>
