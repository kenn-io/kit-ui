<script module lang="ts">
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
  }
</script>

<script lang="ts">
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
    /** Run a command (the palette closes first). */
    onrun: (command: PaletteCommand) => void;
    /** Ids shown under `recentLabel` while the query is empty. */
    recentIds?: string[];
    placeholder?: string;
    emptyLabel?: string;
    recentLabel?: string;
    ariaLabel?: string;
    class?: string;
  }

  let {
    open = $bindable(false),
    commands,
    onrun,
    recentIds = [],
    placeholder = "Type a command…",
    emptyLabel = "No matching commands",
    recentLabel = "Recent",
    ariaLabel = "Command palette",
    class: className = "",
  }: Props = $props();

  const uid = $props.id();
  let query = $state("");
  let highlighted = $state(0);

  interface Group {
    section: string | undefined;
    commands: PaletteCommand[];
  }

  // Rank: label prefix > label substring > keyword substring.
  const ranked = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const recent = recentIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is PaletteCommand => c !== undefined)
        .map((c) => ({ ...c, section: recentLabel }));
      const rest = commands.filter((c) => !recentIds.includes(c.id));
      return [...recent, ...rest];
    }
    const prefix: PaletteCommand[] = [];
    const substring: PaletteCommand[] = [];
    const keyword: PaletteCommand[] = [];
    for (const c of commands) {
      const label = c.label.toLowerCase();
      if (label.startsWith(q)) prefix.push(c);
      else if (label.includes(q)) substring.push(c);
      else if (c.keywords?.toLowerCase().includes(q)) keyword.push(c);
    }
    return [...prefix, ...substring, ...keyword];
  });

  // Each section appears once, ordered by its best-ranked match; ranking
  // is preserved within a section. (Grouping only adjacent ranks would
  // repeat section headers across rank buckets.)
  const groups = $derived.by(() => {
    const out: Group[] = [];
    const bySection = new Map<string | undefined, Group>();
    for (const c of ranked) {
      let group = bySection.get(c.section);
      if (!group) {
        group = { section: c.section, commands: [] };
        bySection.set(c.section, group);
        out.push(group);
      }
      group.commands.push(c);
    }
    return out;
  });

  // Visual order — highlight/keyboard navigation indexes into this.
  const flat = $derived(groups.flatMap((g) => g.commands));

  // Rendered options need their flat index; indexOf per option would be
  // quadratic in the result count on every keystroke.
  const flatIndex = $derived(new Map(flat.map((c, i) => [c, i])));

  // Combo parsing is per command set, not per render — the list
  // re-renders on every keystroke. Keyed by id so the recent-section
  // clones share their source command's entry.
  const comboKeys = $derived(
    new Map(commands.filter((c) => c.combo).map((c) => [c.id, formatShortcutKeys(c.combo!)])),
  );

  const firstEnabled = (): number => flat.findIndex((c) => !c.disabled);

  // Reset search state on every open; push a shortcut scope so page-level
  // shortcuts are suspended while the palette is up.
  $effect(() => {
    if (!open) return;
    query = "";
    const pop = appShortcuts.pushScope(`kit-command-palette-${uid}`);
    return pop;
  });

  // Re-highlight whenever the result set changes; skip disabled leading
  // results so Enter always has a runnable target (−1 when nothing is).
  $effect(() => {
    highlighted = firstEnabled();
  });

  function close(): void {
    open = false;
  }

  function run(command: PaletteCommand): void {
    if (command.disabled) return;
    close();
    onrun(command);
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
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = flat[highlighted];
      if (command) run(command);
    } else if (event.key === "Escape") {
      // SearchInput already consumed Escape-with-content (clear); an
      // Escape that reaches here closes the palette.
      event.stopPropagation();
      close();
    }
  }
</script>

{#if open}
  <div
    class="kit-command-palette-overlay"
    role="presentation"
    onpointerdown={backdropCloses(close)}
  >
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
        <SearchInput
          bind:value={query}
          {placeholder}
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
        class="kit-command-palette__list"
        role="listbox"
        id="{uid}-listbox"
        aria-label={ariaLabel}
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
              class="kit-command-palette__option"
              class:highlighted={index === highlighted}
              id="{uid}-option-{index}"
              role="option"
              aria-selected={index === highlighted}
              aria-disabled={command.disabled ? "true" : undefined}
              tabindex="-1"
              onpointerenter={() => {
                if (!command.disabled) highlighted = index;
              }}
              onclick={() => run(command)}
            >
              <span class="kit-command-palette__label">{command.label}</span>
              {#if command.combo}
                <KbdBadge keys={comboKeys.get(command.id) ?? []} />
              {/if}
            </button>
          {/each}
        {/each}
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
    padding: var(--space-3);
    border-bottom: 1px solid var(--border-muted);
  }

  .kit-command-palette__list {
    overflow-y: auto;
    padding: var(--space-2);
  }

  .kit-command-palette__section {
    padding: var(--space-3) var(--space-4) var(--space-1);
    font-size: var(--font-size-2xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .kit-command-palette__option {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
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

  .kit-command-palette__empty {
    padding: var(--space-5);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-align: center;
  }
</style>
