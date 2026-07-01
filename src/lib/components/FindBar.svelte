<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";

  interface Props {
    /** Current search text (bindable). */
    query?: string;
    /** Total number of matches for `query`. */
    matchCount: number;
    /** 0-based index of the current match; displayed 1-based. */
    currentIndex: number;
    /** Advance to the next match (Enter, down button). */
    onnext?: () => void;
    /** Go to the previous match (Shift+Enter, up button). */
    onprev?: () => void;
    /** Dismiss the bar (Escape, close button). */
    onclose?: () => void;
    /** Called with the new query on every keystroke. */
    oninput?: (query: string) => void;
    /** Focus the input when the bar mounts (default true). */
    autofocus?: boolean;
    placeholder?: string;
    /** Counter template; `{current}` and `{total}` are replaced. */
    matchCountLabel?: string;
    noMatchesLabel?: string;
    ariaLabel?: string;
    inputAriaLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
    closeLabel?: string;
  }

  let {
    query = $bindable(""),
    matchCount,
    currentIndex,
    onnext = undefined,
    onprev = undefined,
    onclose = undefined,
    oninput = undefined,
    autofocus = true,
    placeholder = "Find…",
    matchCountLabel = "{current} of {total}",
    noMatchesLabel = "No matches",
    ariaLabel = "Find",
    inputAriaLabel = "Search query",
    previousLabel = "Previous match",
    nextLabel = "Next match",
    closeLabel = "Close",
  }: Props = $props();

  const hasQuery = $derived(query.trim().length > 0);
  const hasMatches = $derived(matchCount > 0);
  const noResults = $derived(hasQuery && !hasMatches);

  const counterText = $derived.by(() => {
    if (!hasQuery) return "";
    if (matchCount === 0) return noMatchesLabel;
    return matchCountLabel
      .replace("{current}", String(currentIndex + 1))
      .replace("{total}", String(matchCount));
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose?.();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onprev?.();
      } else {
        onnext?.();
      }
    }
  }
</script>

<div class="kit-find-bar" role="search" aria-label={ariaLabel}>
  <span class="kit-find-bar__icon" aria-hidden="true">
    <SearchIcon size="13" strokeWidth="2" />
  </span>

  <input
    class="kit-find-bar__input"
    class:no-results={noResults}
    type="text"
    {placeholder}
    spellcheck="false"
    autocomplete="off"
    bind:value={query}
    oninput={() => oninput?.(query)}
    onkeydown={handleKeydown}
    aria-label={inputAriaLabel}
    {@attach (node) => {
      if (autofocus) node.focus();
    }}
  />

  {#if hasQuery}
    <span class="kit-find-bar__counter" class:no-results={noResults} aria-live="polite">
      {counterText}
    </span>
  {/if}

  <div class="kit-find-bar__nav">
    <button
      class="kit-find-bar__nav-btn"
      type="button"
      title={previousLabel}
      disabled={!hasMatches}
      onclick={() => onprev?.()}
      aria-label={previousLabel}
    >
      <ChevronUpIcon size="11" strokeWidth="2.4" aria-hidden="true" />
    </button>
    <button
      class="kit-find-bar__nav-btn"
      type="button"
      title={nextLabel}
      disabled={!hasMatches}
      onclick={() => onnext?.()}
      aria-label={nextLabel}
    >
      <ChevronDownIcon size="11" strokeWidth="2.4" aria-hidden="true" />
    </button>
  </div>

  <div class="kit-find-bar__divider"></div>

  <button
    class="kit-find-bar__close"
    type="button"
    title={closeLabel}
    onclick={() => onclose?.()}
    aria-label={closeLabel}
  >
    <XIcon size="12" strokeWidth="2.4" aria-hidden="true" />
  </button>
</div>

<style>
  .kit-find-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-6);
    border-bottom: 1px solid var(--border-muted);
    background: var(--bg-surface);
    flex-shrink: 0;
    animation: kit-find-bar-slide-down 0.12s ease-out;
  }

  @keyframes kit-find-bar-slide-down {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-find-bar {
      animation: none;
    }
  }

  .kit-find-bar__icon {
    display: inline-flex;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .kit-find-bar__input {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 0 var(--space-4);
    font-size: var(--font-size-md);
    font-family: inherit;
    color: var(--text-primary);
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    outline: none;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .kit-find-bar__input:focus {
    border-color: var(--accent-blue);
    background: var(--bg-surface);
  }

  .kit-find-bar__input.no-results:focus {
    border-color: var(--accent-red);
  }

  .kit-find-bar__counter {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
    min-width: 72px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .kit-find-bar__counter.no-results {
    color: var(--accent-red);
  }

  .kit-find-bar__nav {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .kit-find-bar__nav-btn,
  .kit-find-bar__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 0.12s,
      color 0.12s;
  }

  .kit-find-bar__nav-btn {
    color: var(--text-secondary);
  }

  .kit-find-bar__nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .kit-find-bar__nav-btn:not(:disabled):hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-find-bar__nav-btn:not(:disabled):active {
    transform: scale(0.9);
  }

  .kit-find-bar__divider {
    width: 1px;
    height: 16px;
    background: var(--border-muted);
    flex-shrink: 0;
    margin: 0 var(--space-1);
  }

  .kit-find-bar__close {
    color: var(--text-muted);
  }

  .kit-find-bar__close:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-find-bar__close:active {
    transform: scale(0.9);
  }
</style>
