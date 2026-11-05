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

  const glyphNames: Record<string, string> = {
    "⌘": "Command",
    "⌥": "Option",
    "⌃": "Control",
    "⇧": "Shift",
    "↵": "Enter",
    "↑": "Arrow up",
    "↓": "Arrow down",
    "←": "Arrow left",
    "→": "Arrow right",
  };

  // Tight view boxes keep symbol ink at the surrounding letters' cap height.
  const symbolPaths: Record<string, string> = {
    "⌘": "M5 5H2.5A2.5 2.5 0 1 1 5 2.5V13.5A2.5 2.5 0 1 1 2.5 11H13.5A2.5 2.5 0 1 1 11 13.5V2.5A2.5 2.5 0 1 1 13.5 5Z",
    "⌥": "M0 0H5L11 16H16M10 0H16",
    "⌃": "M0 16L8 0L16 16",
    "⇧": "M8 0L16 8H12V16H4V8H0Z",
    "↵": "M16 0V10H0M6 4L0 10L6 16",
    "↑": "M8 16V0M0 8L8 0L16 8",
    "↓": "M8 0V16M0 8L8 16L16 8",
    "←": "M16 8H0M8 0L0 8L8 16",
    "→": "M0 8H16M8 0L16 8L8 16",
  };

  // Symbol-only compact and plus badges keep their original text layout.
  const compactChord = $derived(joiner === "compact" && keys.some((key) => !symbolPaths[key]));

  const glyph = $derived(keys.join(joiner === "plus" ? "+" : ""));
  const aria = $derived(ariaLabel ?? keys.map((key) => glyphNames[key] ?? key).join(" "));
</script>

{#snippet keyContent(key: string)}
  {#if symbolPaths[key]}
    <svg class="kit-kbd-badge__symbol" viewBox="-1 -1 18 18" aria-hidden="true">
      <path d={symbolPaths[key]} />
    </svg>
    <span class="kit-sr-only">{key}</span>
  {:else}
    {key}
  {/if}
{/snippet}

<kbd class="kit-kbd-badge" data-joiner={joiner} aria-label={aria}>
  {#if joiner === "keys"}
    {#each keys as key, index (index)}
      <kbd class="kit-kbd-badge__key" aria-hidden="true">{@render keyContent(key)}</kbd>
    {/each}
  {:else if compactChord}
    <span class="kit-kbd-badge__chord" aria-hidden="true">
      {#each keys as key, index (index)}
        {@render keyContent(key)}
      {/each}
    </span>
  {:else}
    <span aria-hidden="true">{glyph}</span>
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: calc(1em + 10px + 2 * var(--border-width));
    min-height: calc(1em + 2px + 2 * var(--border-width));
    font: inherit;
  }

  .kit-kbd-badge__chord {
    display: inline-flex;
    align-items: center;
    letter-spacing: inherit;
  }

  .kit-kbd-badge__symbol {
    width: 1cap;
    height: 1cap;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
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
