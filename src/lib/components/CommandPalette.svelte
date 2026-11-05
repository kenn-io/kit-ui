<script module lang="ts">
  import type { Component } from "svelte";

  export interface PaletteCommand {
    id: string;
    label: string;
    /** Group header the command sorts under. */
    section?: string;
    /** Extra match text (synonyms) — searched but not displayed. */
    keywords?: string;
    /** Shortcut combo displayed as a KbdBadge, e.g. "mod+shift+p". */
    combo?: string;
    disabled?: boolean;
    /** Decorative leading icon, rendered at 16px. */
    icon?: Component;
    children?: PaletteLeaf[];
  }

  export type PaletteLeaf = Omit<PaletteCommand, "children">;
</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import { highlightSegments } from "../utils/highlight.js";
  import { trapFocus } from "../utils/focus-trap.js";
  import { backdropCloses } from "../utils/overlay.js";
  import { appShortcuts } from "../utils/shortcuts.js";
  import { formatShortcutKeys } from "../utils/shortcuts.js";
  import KbdBadge from "./KbdBadge.svelte";
  import SearchInput from "./SearchInput.svelte";

  interface Props {
    /** Whether the palette is showing (bindable). */
    open?: boolean;
    commands: PaletteCommand[];
    /** Run a leaf command (the palette closes first). */
    onrun: (command: PaletteCommand, query: string) => void;
    /** Search text used on each open. */
    initialQuery?: string;
    /** Extra commands following all matches for a non-empty query. */
    fallbacks?: (query: string) => PaletteLeaf[];
    /** Ids shown under `recentLabel` while the query is empty. */
    recentIds?: string[];
    placeholder?: string;
    emptyLabel?: string;
    recentLabel?: string;
    navigateLabel?: string;
    runLabel?: string;
    closeLabel?: string;
    ariaLabel?: string;
    class?: string;
  }

  let {
    open = $bindable(false),
    commands,
    onrun,
    initialQuery = "",
    fallbacks,
    recentIds = [],
    placeholder = "Type a command…",
    emptyLabel = "No matching commands",
    recentLabel = "Recent",
    navigateLabel = "navigate",
    runLabel = "run",
    closeLabel = "close",
    ariaLabel = "Command palette",
    class: className = "",
  }: Props = $props();

  const uid = $props.id();
  let query = $state("");
  let highlighted = $state(0);
  let parentId = $state<string>();
  let inputEl = $state<HTMLInputElement>();
  let listEl = $state<HTMLDivElement>();
  const { tree, allCommands, recent, originals } = $derived.by(() => {
    const originals = new WeakMap<PaletteCommand, PaletteCommand>();
    const tree = commands.map((c) => {
      if (!c.children) return c;
      const copy = {
        ...c,
        disabled: c.disabled || c.children.length === 0,
        children: c.children.map((child) => {
          const copy = {
            ...child,
            section: child.section ?? c.section,
            disabled: c.disabled || child.disabled,
          };
          originals.set(copy, child);
          return copy;
        }),
      };
      originals.set(copy, c);
      return copy;
    });
    const allCommands = tree.flatMap((c) => [c, ...(c.children ?? [])]);
    const recent = recentIds
      .map((id) => allCommands.find((c) => c.id === id))
      .filter((c): c is PaletteCommand => c !== undefined)
      .map((c) => {
        const copy = { ...c, section: recentLabel };
        originals.set(copy, originals.get(c) ?? c);
        return copy;
      });
    return { tree, allCommands, recent, originals };
  });
  const parent = $derived(tree.find((c) => c.id === parentId && c.children));
  const parentLabels = $derived(
    new Map(tree.flatMap((c) => (c.children ?? []).map((child) => [child.id, c.label]))),
  );

  interface Group {
    section: string | undefined;
    commands: PaletteCommand[];
  }

  // Rank: label prefix > label substring > keyword substring.
  const ranked = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      if (parent) return parent.children ?? [];
      const rest = tree.filter((c) => !recentIds.includes(c.id));
      return [...recent, ...rest];
    }
    const prefix: PaletteCommand[] = [];
    const substring: PaletteCommand[] = [];
    const keyword: PaletteCommand[] = [];
    for (const c of parent ? (parent.children ?? []) : allCommands) {
      const label = c.label.toLowerCase();
      if (label.startsWith(q)) prefix.push(c);
      else if (label.includes(q)) substring.push(c);
      else if (c.keywords?.toLowerCase().includes(q)) keyword.push(c);
    }
    return [...prefix, ...substring, ...keyword];
  });

  const matchedIds = $derived(new Set(ranked.map((c) => c.id)));
  const extra = $derived.by(() => {
    if (parent || !query.trim() || !fallbacks) return [];
    const listedIds = new Set(matchedIds);
    return fallbacks(query.trim()).filter((c) => {
      if (listedIds.has(c.id)) return false;
      listedIds.add(c.id);
      return true;
    });
  });

  // Group matches and fallbacks separately so every fallback follows the matches.
  const groups = $derived.by(() => {
    const out: Group[] = [];
    for (const rows of [ranked, extra]) {
      const bySection = new Map<string | undefined, Group>();
      for (const c of rows) {
        let group = bySection.get(c.section);
        if (!group) {
          group = { section: c.section, commands: [] };
          bySection.set(c.section, group);
          out.push(group);
        }
        group.commands.push(c);
      }
    }
    return out;
  });

  // Visual order — highlight/keyboard navigation indexes into this.
  const flat = $derived(groups.flatMap((g) => g.commands));

  // Rendered options need their flat index; indexOf per option would be
  // quadratic in the result count on every keystroke.
  const flatIndex = $derived(new Map(flat.map((c, i) => [c, i])));

  const comboKeys = $derived(
    new Map(flat.filter((c) => c.combo).map((c) => [c.id, formatShortcutKeys(c.combo!)])),
  );

  const firstEnabled = (): number => flat.findIndex((c) => !c.disabled);

  // Reset search state on every open; push a shortcut scope so page-level
  // shortcuts are suspended while the palette is up.
  $effect(() => {
    if (!open) return;
    query = untrack(() => initialQuery);
    const pop = appShortcuts.pushScope(`kit-command-palette-${uid}`);
    return () => {
      parentId = undefined;
      pop();
    };
  });

  // Re-highlight on open and whenever results change; skip disabled leading
  // results so Enter always has a runnable target (−1 when nothing is).
  $effect(() => {
    if (!open) return;
    highlighted = firstEnabled();
  });

  $effect(() => {
    if (parentId !== undefined && !parent) setParent(undefined);
  });

  async function setParent(id: string | undefined): Promise<void> {
    parentId = id;
    query = "";
    if (listEl) listEl.scrollTop = 0;
    inputEl?.focus();
    await tick();
    document.getElementById(`${uid}-option-${highlighted}`)?.scrollIntoView({ block: "nearest" });
  }

  function close(): void {
    open = false;
  }

  function run(command: PaletteCommand): void {
    if (command.disabled) return;
    if (!parent && command.children) {
      setParent(command.id);
      return;
    }
    const typed = query.trim();
    const original = originals.get(command) ?? command;
    close();
    onrun(original, typed);
  }

  function move(delta: number): void {
    if (flat.length === 0 || firstEnabled() === -1) return;
    let next = highlighted >= 0 ? highlighted : delta > 0 ? -1 : flat.length;
    for (let i = 0; i < flat.length; i += 1) {
      next = (next + delta + flat.length) % flat.length;
      if (!flat[next]?.disabled) break;
    }
    highlighted = next;
    document.getElementById(`${uid}-option-${next}`)?.scrollIntoView({ block: "nearest" });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      const command = flat[highlighted];
      if (command) run(command);
    } else if (event.key === "Backspace" && !query && parent) {
      event.preventDefault();
      setParent(undefined);
    } else if (event.key === "Escape") {
      // SearchInput already consumed Escape-with-content (clear); an
      // Escape off the input clears, then leaves a child list or closes.
      event.stopPropagation();
      if (query) {
        query = "";
        inputEl?.focus();
      } else if (parent) setParent(undefined);
      else close();
    }
  }
</script>

{#if open}
  <div class="kit-command-palette-overlay" role="presentation" {@attach backdropCloses(close)}>
    <div
      class={["kit-command-palette", "kit-popover-card", className]}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabindex="-1"
      onkeydown={handleKeydown}
      {@attach trapFocus}
    >
      <!-- Focus stays in the field; combobox wiring announces the
           highlighted option to assistive tech as arrows move it. -->
      <div class="kit-command-palette__search">
        {#if parent}
          <button
            type="button"
            class="kit-command-palette__parent"
            title={parent.label}
            tabindex="-1"
            onpointerdown={(event) => event.preventDefault()}
            onclick={() => setParent(undefined)}>{parent.label}</button
          >
        {/if}
        <SearchInput
          bind:inputEl
          bind:value={query}
          placeholder={parent ? "" : placeholder}
          block
          autofocus
          {ariaLabel}
          role="combobox"
          ariaExpanded={true}
          ariaControls="{uid}-listbox"
          ariaAutocomplete="list"
          ariaActivedescendant={highlighted >= 0 && highlighted < flat.length
            ? `${uid}-option-${highlighted}`
            : undefined}
        />
      </div>
      <div
        bind:this={listEl}
        class="kit-command-palette__list"
        role="listbox"
        id="{uid}-listbox"
        aria-label={parent?.label ?? ariaLabel}
      >
        {#if flat.length === 0}
          <div class="kit-command-palette__empty">{emptyLabel}</div>
        {/if}
        {#each groups as group, gi (gi)}
          {#if group.section}
            <div class="kit-command-palette__section" role="presentation">
              {group.section}
            </div>
          {/if}
          {#each group.commands as command (command.id)}
            {@const index = flatIndex.get(command) ?? -1}
            <!-- aria-disabled (not disabled) keeps disabled commands
                 perceivable to screen readers; run() guards activation. -->
            <button
              type="button"
              class="kit-command-palette__option kit-control-states"
              class:highlighted={index === highlighted}
              id="{uid}-option-{index}"
              role="option"
              aria-selected={index === highlighted}
              aria-disabled={command.disabled ? "true" : undefined}
              tabindex="-1"
              onpointerdown={(event) => event.preventDefault()}
              onpointermove={() => {
                if (!command.disabled) highlighted = index;
              }}
              onclick={() => run(command)}
            >
              <span class="kit-command-palette__icon" aria-hidden="true">
                {#if command.icon}
                  <command.icon size={16} />
                {/if}
              </span>
              <span class="kit-command-palette__label">
                {#if !parent && matchedIds.has(command.id) && parentLabels.has(command.id)}{parentLabels.get(
                    command.id,
                  )} ›
                {/if}
                {#each highlightSegments(command.label, matchedIds.has(command.id) ? query.trim() : "") as segment, si (si)}
                  {#if segment.match}<mark>{segment.text}</mark>{:else}{segment.text}{/if}
                {/each}
              </span>
              {#if command.combo}
                <KbdBadge keys={comboKeys.get(command.id) ?? []} />
              {/if}
            </button>
          {/each}
        {/each}
      </div>
      <div class="kit-command-palette__footer" aria-hidden="true">
        <KbdBadge keys={["↑", "↓"]} />
        {navigateLabel} ·
        <KbdBadge keys={["↵"]} />
        {runLabel} ·
        <KbdBadge keys={["esc"]} />
        {closeLabel}
      </div>
    </div>
  </div>
{/if}

<style>
  .kit-command-palette-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: var(--overlay-bg);
    -webkit-backdrop-filter: var(--overlay-filter, none);
    backdrop-filter: var(--overlay-filter, none);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
  }

  .kit-command-palette {
    display: flex;
    flex-direction: column;
    width: min(560px, calc(100vw - 32px));
    max-height: min(420px, 70vh);
    overflow: hidden;
  }

  .kit-command-palette__search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    height: 48px;
    padding: 0 var(--space-3);
    border-bottom: 1px solid var(--border-muted);
  }

  .kit-command-palette__parent {
    flex: 0 1 auto;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--bg-surface-hover);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .kit-command-palette__search :global(.kit-search-input) {
    flex: 1;
    min-width: 0;
  }

  .kit-command-palette__search :global(.kit-text-input),
  .kit-command-palette__search :global(.kit-text-input:focus-within) {
    height: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    outline: none;
  }

  .kit-command-palette__search :global(.kit-text-input__control:focus-visible) {
    outline: none;
  }

  .kit-command-palette__list {
    overflow-y: auto;
    padding: var(--space-2);
  }

  .kit-command-palette__section {
    padding: var(--space-3) var(--space-4) var(--space-1);
    font-size: var(--font-size-2xs);
    font-weight: var(--font-weight-semibold, 600);
    letter-spacing: var(--letter-spacing-label, 0.04em);
    text-transform: var(--label-transform, uppercase);
    color: var(--text-muted);
  }

  .kit-command-palette__section ~ .kit-command-palette__section {
    margin-top: var(--space-4);
  }

  .kit-command-palette__option {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    min-height: 36px;
    padding: var(--space-3) var(--space-4);
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-size-md);
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
  }

  .kit-command-palette__option.highlighted {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
  }

  .kit-command-palette__option[aria-disabled="true"] {
    opacity: var(--opacity-disabled);
    cursor: default;
  }

  .kit-command-palette__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-command-palette__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
  }

  .kit-command-palette__footer {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    height: 32px;
    padding: 0 var(--space-5);
    border-top: 1px solid var(--border-muted);
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
  }

  .kit-command-palette__label mark {
    font-weight: var(--font-weight-semibold, 600);
    background: none;
    color: inherit;
  }

  .kit-command-palette__empty {
    padding: var(--space-5);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-align: center;
  }

  @media (pointer: coarse) {
    .kit-command-palette__footer {
      display: none;
    }
  }
</style>
