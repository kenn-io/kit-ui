<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import Chip from "./Chip.svelte";
  import type { ChipSize } from "./Chip.svelte";

  interface Props {
    items: T[];
    /** Renders one item — typically a Chip, small Button, or badge. */
    chip: Snippet<[item: T, index: number]>;
    /** How many items show while collapsed; the rest sit behind a "+N"
     * expander chip. */
    maxVisible?: number;
    /** Bindable. Expansion state; parents can control or observe it. */
    expanded?: boolean;
    /** Stable key per item for keyed rendering; defaults to item identity. */
    key?: (item: T) => unknown;
    /** Gap between items as a spacing-scale step (--space-N). */
    gap?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    wrap?: boolean;
    /** Size of the expander chip; match the chips you render. */
    size?: ChipSize;
    ariaLabel?: string;
    moreLabel?: (hidden: number) => string;
    lessLabel?: string;
    class?: string;
  }

  let {
    items,
    chip,
    maxVisible = 5,
    expanded = $bindable(false),
    key = undefined,
    gap = 2,
    wrap = true,
    size = "md",
    ariaLabel = undefined,
    moreLabel = (hidden) => `+${hidden}`,
    lessLabel = "less",
    class: className = "",
  }: Props = $props();

  const overflow = $derived(Math.max(0, items.length - maxVisible));
  const visible = $derived(expanded || overflow === 0 ? items : items.slice(0, maxVisible));
</script>

<div
  class={["kit-chip-stack", { "kit-chip-stack--wrap": wrap }, className]}
  role="group"
  aria-label={ariaLabel}
  style:gap="var(--space-{gap})"
>
  {#each visible as item, index (key ? key(item) : item)}
    {@render chip(item, index)}
  {/each}
  {#if overflow > 0}
    <Chip
      tone="muted"
      {size}
      interactive
      {expanded}
      ariaLabel={expanded ? `Show fewer` : `Show ${overflow} more`}
      onclick={() => (expanded = !expanded)}
    >
      {expanded ? lessLabel : moreLabel(overflow)}
    </Chip>
  {/if}
</div>

<style>
  .kit-chip-stack {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .kit-chip-stack--wrap {
    flex-wrap: wrap;
  }

  .kit-chip-stack:not(.kit-chip-stack--wrap) {
    overflow: hidden;
  }
</style>
