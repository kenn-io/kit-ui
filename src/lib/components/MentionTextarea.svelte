<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import { autoReposition } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import type { MentionOption } from "./mention.js";

  interface Props {
    value: string;
    /** App-provided lookup: called with the text between the trigger
     * character and the caret (may be empty on a bare trigger). Results
     * beyond `maxResults` are dropped. */
    search: (query: string) => MentionOption[] | Promise<MentionOption[]>;
    /** Character that opens the menu at a word boundary (default "#"). */
    trigger?: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    ariaLabel?: string;
    maxResults?: number;
    searchingLabel?: string;
    emptyLabel?: string;
    /** Custom row rendering; receives the option and whether it is the
     * keyboard-active row. Defaults to trigger+insert, label, dim meta. */
    option?: Snippet<[MentionOption, boolean]>;
    /** Receives keys the mention menu did not consume. */
    onkeydown?: (event: KeyboardEvent) => void;
  }

  let {
    value = $bindable(""),
    search,
    trigger = "#",
    placeholder = "",
    rows = 3,
    disabled = false,
    ariaLabel = undefined,
    maxResults = 8,
    searchingLabel = "Searching…",
    emptyLabel = "No matches",
    option,
    onkeydown = undefined,
  }: Props = $props();

  let textarea = $state<HTMLTextAreaElement>();
  let wrapEl = $state<HTMLDivElement>();
  let menuEl = $state<HTMLDivElement>();
  let menuStyle = $state("");
  let open = $state(false);
  let query = $state("");
  let highlight = $state(0);
  let results = $state.raw<MentionOption[]>([]);
  let searching = $state(false);
  let queryStart = -1;
  let searchVersion = 0;

  const uid = $props.id();
  const listId = `${uid}-mention-list`;

  $effect(() => {
    if (!open) {
      // Bump the version so an in-flight response can't land after close and
      // repopulate results (which would flash on the next open).
      searchVersion++;
      results = [];
      searching = false;
      return;
    }
    const q = query;
    const version = ++searchVersion;
    // Drop the previous query's results up front: while the new search is
    // pending there must be nothing stale to navigate to or insert.
    results = [];
    searching = true;
    void (async () => {
      try {
        const found = await search(q);
        if (version !== searchVersion) return;
        results = found.slice(0, maxResults);
        highlight = 0;
      } catch {
        if (version !== searchVersion) return;
        results = [];
      } finally {
        if (version === searchVersion) searching = false;
      }
    })();
  });

  // Same fixed-position contract as the other popovers so the menu escapes
  // overflow-hidden ancestors; width pins to the textarea.
  function positionMenu(): void {
    if (!wrapEl || !menuEl) return;
    const rect = wrapEl.getBoundingClientRect();
    menuStyle = `${floatingPopoverStyle({
      trigger: rect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: rect.width,
      popoverHeight: menuEl.offsetHeight,
      triggerGap: 4,
    })}; width: ${Math.round(rect.width)}px`;
  }

  $effect(() => {
    if (!open) return;
    positionMenu();
    return autoReposition(() => menuEl, positionMenu);
  });

  /** Index of the trigger character governing the caret, or -1: the trigger
   * must start the text or follow whitespace, with no whitespace between it
   * and the caret. */
  function findTriggerIndex(text: string, caret: number): number {
    for (let i = caret - 1; i >= 0; i--) {
      const char = text[i];
      if (char === trigger) {
        if (i === 0) return i;
        const prev = text[i - 1];
        if (prev === " " || prev === "\n" || prev === "\t") return i;
        return -1;
      }
      if (char === " " || char === "\n" || char === "\t") return -1;
    }
    return -1;
  }

  function refreshMention(): void {
    if (!textarea) {
      open = false;
      return;
    }
    const caret = textarea.selectionStart;
    const text = textarea.value;
    const triggerIndex = findTriggerIndex(text, caret);
    if (triggerIndex === -1) {
      open = false;
      query = "";
      queryStart = -1;
      return;
    }
    queryStart = triggerIndex;
    query = text.slice(triggerIndex + 1, caret);
    open = true;
  }

  // Every key that can move the caret without editing. ArrowUp/ArrowDown
  // belong here for multiline values: when the menu consumes them for
  // highlight cycling it prevents default, so the caret hasn't moved and the
  // refresh is a no-op — otherwise they change lines and the mention state
  // must follow the caret.
  const caretKeys = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ]);

  function handleKeyup(event: KeyboardEvent): void {
    if (caretKeys.has(event.key)) refreshMention();
  }

  function handleBlur(event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    if (menuEl && related && menuEl.contains(related)) return;
    open = false;
  }

  async function selectOption(item: MentionOption): Promise<void> {
    if (!textarea || queryStart < 0) return;
    const text = textarea.value;
    const caret = textarea.selectionStart;
    const before = text.slice(0, queryStart);
    const after = text.slice(caret);
    const replacement = `${trigger}${item.insert} `;
    value = before + replacement + after;
    open = false;
    query = "";
    await tick();
    if (!textarea) return;
    const nextCaret = before.length + replacement.length;
    textarea.focus();
    textarea.setSelectionRange(nextCaret, nextCaret);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (open && results.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        highlight = (highlight + 1) % results.length;
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        highlight = (highlight - 1 + results.length) % results.length;
        return;
      }
      if ((event.key === "Enter" && !event.metaKey && !event.ctrlKey) || event.key === "Tab") {
        event.preventDefault();
        const item = results[highlight];
        if (item) void selectOption(item);
        return;
      }
    }
    if (open && event.key === "Escape") {
      event.preventDefault();
      open = false;
      return;
    }
    onkeydown?.(event);
  }

  function preventBlur(event: MouseEvent): void {
    event.preventDefault();
  }
</script>

<div class="kit-mention" bind:this={wrapEl}>
  <textarea
    bind:this={textarea}
    bind:value
    class="kit-mention__textarea"
    {disabled}
    {rows}
    {placeholder}
    aria-label={ariaLabel}
    aria-activedescendant={open && results.length > 0 ? `${listId}-opt-${highlight}` : undefined}
    oninput={refreshMention}
    onkeydown={handleKeydown}
    onkeyup={handleKeyup}
    onclick={refreshMention}
    onblur={handleBlur}
  ></textarea>
  {#if open}
    <div
      bind:this={menuEl}
      class="kit-mention__menu kit-popover-card"
      style={menuStyle}
      id={listId}
      role="listbox"
      aria-label="Insert reference"
      tabindex="-1"
      onmousedown={preventBlur}
    >
      {#if searching && results.length === 0}
        <div class="kit-mention__status">{searchingLabel}</div>
      {:else if results.length === 0}
        <div class="kit-mention__status">{emptyLabel}</div>
      {:else}
        {#each results as item, index (item.id)}
          <button
            type="button"
            class="kit-mention__option"
            class:active={index === highlight}
            id={`${listId}-opt-${index}`}
            role="option"
            aria-selected={index === highlight}
            onmousedown={(event) => {
              event.preventDefault();
              void selectOption(item);
            }}
            onmouseenter={() => (highlight = index)}
          >
            {#if option}
              {@render option(item, index === highlight)}
            {:else}
              <span class="kit-mention__insert">{trigger}{item.insert}</span>
              <span class="kit-mention__label">{item.label}</span>
              {#if item.meta}
                <span class="kit-mention__meta">{item.meta}</span>
              {/if}
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .kit-mention {
    position: relative;
    width: 100%;
  }

  .kit-mention__textarea {
    box-sizing: border-box;
    width: 100%;
    resize: vertical;
    padding: var(--space-2) var(--space-3);
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: var(--font-size-sm);
    line-height: 1.4;
    color: var(--text-primary);
    transition: border-color var(--transition-fast);
  }

  .kit-mention__textarea:focus {
    outline: none;
    border-color: var(--accent-blue);
  }

  .kit-mention__textarea::placeholder {
    color: var(--text-muted);
  }

  .kit-mention__textarea:disabled {
    opacity: var(--opacity-disabled);
  }

  .kit-mention__menu {
    position: fixed;
    box-sizing: border-box;
    display: grid;
    gap: 1px;
    max-height: 240px;
    overflow-y: auto;
    z-index: var(--z-popover);
    padding: 2px;
  }

  .kit-mention__status {
    padding: 6px 8px;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
  }

  .kit-mention__option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 4px 8px;
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
  }

  .kit-mention__option.active {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-mention__insert {
    flex-shrink: 0;
    color: var(--accent-blue);
    font-family: var(--font-mono);
    font-weight: var(--font-weight-semibold, 600);
  }

  .kit-mention__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-mention__meta {
    flex-shrink: 0;
    color: var(--text-muted);
  }
</style>
