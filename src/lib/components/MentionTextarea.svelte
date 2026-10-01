<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import { autoReposition } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import type { MentionOption, MentionTrigger } from "./mention.js";

  interface Props {
    value: string;
    /** App-provided lookup for `trigger`: called with the text between the
     * trigger character and the caret (may be empty on a bare trigger).
     * Results beyond `maxResults` are dropped. Required unless `triggers`
     * is set. */
    search?: (query: string) => MentionOption[] | Promise<MentionOption[]>;
    /** Character that opens the menu when it starts a word (default "#"). */
    trigger?: string;
    /** Several triggers, each with its own search, e.g. "/" for commands
     * and "@" for files. Replaces `trigger`, `search`, `hideEmpty`, and the
     * status labels when set. */
    triggers?: MentionTrigger[];
    /** Keep the menu closed while nothing matches instead of showing the
     * searching and empty rows. Suits synchronous searches over a fixed
     * list, where an empty menu only gets in the way of typing. */
    hideEmpty?: boolean;
    /** Borderless, transparent field that grows with its content and has no
     * resize handle, for a textarea inside a composer card that draws its
     * own frame. Size it with --kit-mention-padding, --kit-mention-min-height,
     * and --kit-mention-max-height. */
    embedded?: boolean;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    ariaLabel?: string;
    ariaDescribedby?: string;
    maxResults?: number;
    searchingLabel?: string;
    emptyLabel?: string;
    /** Custom row rendering; receives the option, whether it is the
     * keyboard-active row, and the trigger character that opened the menu.
     * Defaults to trigger+insert, label, dim meta. */
    option?: Snippet<[MentionOption, boolean, string]>;
    /** Receives keys the mention menu did not consume. */
    onkeydown?: (event: KeyboardEvent) => void;
    /** Called with the new text after each edit. */
    oninput?: (value: string) => void;
    /** Receives paste events, e.g. to take pasted files. */
    onpaste?: (event: ClipboardEvent) => void;
    /** The underlying textarea (bindable) — for focus and caret management. */
    textareaEl?: HTMLTextAreaElement | undefined;
    class?: string;
  }

  let {
    value = $bindable(""),
    search = undefined,
    trigger = "#",
    triggers = undefined,
    hideEmpty = false,
    embedded = false,
    placeholder = "",
    rows = 3,
    disabled = false,
    ariaLabel = undefined,
    ariaDescribedby = undefined,
    maxResults = 8,
    searchingLabel = "Searching…",
    emptyLabel = "No matches",
    option,
    onkeydown = undefined,
    oninput = undefined,
    onpaste = undefined,
    textareaEl: textarea = $bindable(undefined),
    class: className = "",
  }: Props = $props();

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
  // The single-trigger props are shorthand for a one-entry list.
  const triggerList = $derived<MentionTrigger[]>(
    triggers ?? (search ? [{ char: trigger, search, hideEmpty, searchingLabel, emptyLabel }] : []),
  );
  // Index into triggerList of the trigger that opened the menu.
  let activeIndex = $state(0);
  const active = $derived(triggerList[activeIndex]);
  // With hideEmpty, an open query that matches nothing shows no menu and
  // leaves its keys to the textarea.
  const visible = $derived(open && (!active?.hideEmpty || results.length > 0));

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
    const lookup = active?.search;
    const version = ++searchVersion;
    // Drop the previous query's results up front: while the new search is
    // pending there must be nothing stale to navigate to or insert.
    results = [];
    searching = true;
    void (async () => {
      try {
        if (!lookup) throw new Error("MentionTextarea needs search or triggers");
        const found = await lookup(q);
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
    if (!visible) return;
    positionMenu();
    return autoReposition(() => [menuEl, wrapEl], positionMenu);
  });

  /** The trigger governing the caret: the word holding the caret (text
   * since the last whitespace) must start with a trigger character. Reading
   * the word's first character means a later trigger character inside it,
   * like the "/" in "@src/lib", stays part of the query. */
  function findTrigger(text: string, caret: number): { start: number; index: number } | null {
    let start = caret;
    while (start > 0 && !" \n\t".includes(text[start - 1]!)) start--;
    if (start === caret) return null;
    const index = triggerList.findIndex((entry) => entry.char === text[start]);
    return index === -1 ? null : { start, index };
  }

  function refreshMention(): void {
    if (!textarea) {
      open = false;
      return;
    }
    const caret = textarea.selectionStart;
    const text = textarea.value;
    const found = findTrigger(text, caret);
    if (!found) {
      open = false;
      query = "";
      queryStart = -1;
      return;
    }
    queryStart = found.start;
    activeIndex = found.index;
    query = text.slice(found.start + 1, caret);
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
    const replacement = `${active?.char ?? trigger}${item.insert} `;
    value = before + replacement + after;
    oninput?.(value);
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
    if (visible && event.key === "Escape") {
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

<div class={["kit-mention", embedded && "kit-mention--embedded", className]} bind:this={wrapEl}>
  <textarea
    bind:this={textarea}
    bind:value
    class="kit-mention__textarea"
    {disabled}
    {rows}
    {placeholder}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedby}
    aria-autocomplete="list"
    aria-controls={visible ? listId : undefined}
    aria-activedescendant={visible && results.length > 0 ? `${listId}-opt-${highlight}` : undefined}
    oninput={() => {
      refreshMention();
      oninput?.(value);
    }}
    onkeydown={handleKeydown}
    onkeyup={handleKeyup}
    onclick={refreshMention}
    onblur={handleBlur}
    {onpaste}></textarea>
  {#if visible}
    <div
      bind:this={menuEl}
      class="kit-mention__menu kit-popover-card"
      style={menuStyle}
      id={listId}
      role="listbox"
      aria-label={active?.menuLabel ?? "Insert reference"}
      tabindex="-1"
      onmousedown={preventBlur}
    >
      {#if searching && results.length === 0}
        <div class="kit-mention__status">{active?.searchingLabel ?? searchingLabel}</div>
      {:else if results.length === 0}
        <div class="kit-mention__status">{active?.emptyLabel ?? emptyLabel}</div>
      {:else}
        {#each results as item, index (item.id)}
          <button
            type="button"
            class="kit-mention__option kit-control-states"
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
              {@render option(item, index === highlight, active?.char ?? trigger)}
            {:else}
              <span class="kit-mention__insert">{active?.char ?? trigger}{item.insert}</span>
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
    transition: border-color var(--transition-fast) var(--transition-ease, ease);
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

  /* Embedded: the surrounding composer owns the frame and focus styling. */
  .kit-mention--embedded .kit-mention__textarea {
    display: block;
    min-height: var(--kit-mention-min-height, auto);
    max-height: var(--kit-mention-max-height, none);
    padding: var(--kit-mention-padding, var(--space-2) var(--space-3));
    background: transparent;
    border: 0;
    border-radius: 0;
    font: inherit;
    line-height: 1.5;
    resize: none;
    field-sizing: content;
  }

  .kit-mention--embedded .kit-mention__textarea::placeholder {
    color: var(--text-secondary);
  }

  .kit-mention--embedded .kit-mention__textarea:disabled {
    opacity: 1;
    cursor: not-allowed;
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
