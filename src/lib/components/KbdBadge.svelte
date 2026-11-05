<script lang="ts">
  interface Props {
    /** Key glyphs to display, e.g. ["⌘", "K"] or ["Ctrl", "Shift", "P"]. */
    keys: string[];
    /** "keys" gives each key its own cap; "compact" runs glyphs together
     * ("⌘K"); "plus" joins with "+" ("Ctrl+K"). */
    joiner?: "keys" | "compact" | "plus";
    ariaLabel?: string;
  }

  let { keys, joiner = "keys", ariaLabel = undefined }: Props = $props();

  const glyph = $derived(keys.join(joiner === "plus" ? "+" : ""));
  const aria = $derived(ariaLabel ?? keys.join(" "));
</script>

<kbd class="kit-kbd-badge" data-joiner={joiner} aria-label={aria}>
  {#if joiner === "keys"}
    {#each keys as key}
      <kbd class="kit-kbd-badge__key">{key}</kbd>
    {/each}
  {:else}
    {glyph}
  {/if}
  <span class="kit-sr-only">{aria}</span>
</kbd>

<style>
  .kit-kbd-badge {
    display: inline-flex;
    align-items: center;
    font-size: var(--font-size-xs);
    line-height: 1;
    color: var(--text-secondary);
    font-family: ui-monospace, monospace;
  }

  .kit-kbd-badge:not([data-joiner="keys"]),
  .kit-kbd-badge__key {
    padding: 1px 5px;
    border: var(--border-width) solid var(--border-default);
    border-radius: 3px;
    background: var(--bg-inset);
  }

  .kit-kbd-badge__key {
    font: inherit;
  }

  .kit-kbd-badge[data-joiner="keys"] {
    gap: var(--space-2);
  }

  .kit-kbd-badge[data-joiner="compact"] {
    font-family: var(--font-sans);
    letter-spacing: var(--letter-spacing-label, 0.07em);
  }

  @media (pointer: coarse) {
    .kit-kbd-badge {
      display: none;
    }
  }
</style>
