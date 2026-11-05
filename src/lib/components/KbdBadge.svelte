<script lang="ts">
  import Command from "@lucide/svelte/icons/command";
  import Option from "@lucide/svelte/icons/option";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ArrowBigUp from "@lucide/svelte/icons/arrow-big-up";
  import CornerDownLeft from "@lucide/svelte/icons/corner-down-left";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";

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

  const symbolIcons: Record<string, typeof Command> = {
    "⌘": Command,
    "⌥": Option,
    "⌃": ChevronUp,
    "⇧": ArrowBigUp,
    "↵": CornerDownLeft,
    "↑": ArrowUp,
    "↓": ArrowDown,
    "←": ArrowLeft,
    "→": ArrowRight,
  };

  const glyph = $derived(keys.join(joiner === "plus" ? "+" : ""));
  const aria = $derived(ariaLabel ?? keys.map((key) => glyphNames[key] ?? key).join(" "));
</script>

<kbd class="kit-kbd-badge" data-joiner={joiner} aria-label={aria}>
  {#if joiner === "keys"}
    {#each keys as key, index (index)}
      {@const Icon = symbolIcons[key]}
      <kbd class="kit-kbd-badge__key" aria-hidden="true">
        {#if Icon}
          <Icon size="1cap" strokeWidth={1.8} />
        {:else}
          {key}
        {/if}
      </kbd>
    {/each}
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

  .kit-kbd-badge[data-joiner="keys"] {
    gap: var(--space-2);
  }

  /* Lucide paths leave space inside their 24-unit view box. Fill the cap
     height with the drawing while preserving the keycap's layout box. */
  .kit-kbd-badge__key :global(svg) {
    overflow: visible;
    --symbol-scale-x: 1.3333;
    --symbol-scale-y: 1.3333;
  }

  .kit-kbd-badge__key :global(svg > *) {
    transform-box: view-box;
    transform-origin: center;
    transform: scale(var(--symbol-scale-x), var(--symbol-scale-y));
    vector-effect: non-scaling-stroke;
    stroke-width: 0.09em;
  }

  .kit-kbd-badge__key :global(.lucide-arrow-big-up) {
    --symbol-scale-x: 1.45;
    --symbol-scale-y: 1.45;
  }

  .kit-kbd-badge__key :global(.lucide-corner-down-left) {
    --symbol-scale-x: 1.5;
    --symbol-scale-y: 1.5;
  }

  .kit-kbd-badge__key :global(.lucide-chevron-up) {
    --symbol-scale-x: 2;
    --symbol-scale-y: 4;
  }

  .kit-kbd-badge__key :global(.lucide-arrow-up),
  .kit-kbd-badge__key :global(.lucide-arrow-down),
  .kit-kbd-badge__key :global(.lucide-arrow-left),
  .kit-kbd-badge__key :global(.lucide-arrow-right) {
    --symbol-scale-x: 1.7143;
    --symbol-scale-y: 1.7143;
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
