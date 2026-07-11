<script lang="ts">
  interface Props {
    /** Key glyphs to display, e.g. ["⌘", "K"] or ["Ctrl", "Shift", "P"]. */
    keys: string[];
    /** Separator between keys: "compact" renders them run together (mac
     * style, "⌘K"); "plus" joins with "+" ("Ctrl+K"). */
    joiner?: "compact" | "plus";
    ariaLabel?: string;
  }

  let { keys, joiner = "compact", ariaLabel = undefined }: Props = $props();

  const glyph = $derived(keys.join(joiner === "plus" ? "+" : ""));
  const aria = $derived(ariaLabel ?? keys.join(" "));
</script>

<kbd class="kit-kbd-badge" data-joiner={joiner} aria-label={aria}>
  {glyph}
  <span class="kit-sr-only">{aria}</span>
</kbd>

<style>
  .kit-kbd-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 5px;
    border: var(--border-width) solid var(--border-default);
    border-radius: 3px;
    font-size: var(--font-size-xs);
    line-height: 1;
    color: var(--text-secondary);
    background: var(--bg-inset);
    font-family: ui-monospace, monospace;
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
