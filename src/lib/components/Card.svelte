<script module lang="ts">
  import type { ChipTone } from "./Chip.svelte";

  export type CardLevel = "inset" | "default" | "raised";
  export type CardPadding = "none" | "sm" | "md";
  export type CardTone = ChipTone;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Hierarchy level: `inset` (well inside another surface), `default`
     * (list tiles, timeline cards), `raised` (page-level panel). */
    level?: CardLevel;
    padding?: CardPadding;
    /** Uppercase mini-label above/beside the title (e.g. an event type). */
    eyebrow?: string | undefined;
    /** Accent for the eyebrow, using the Chip tone vocabulary. */
    eyebrowTone?: CardTone | undefined;
    title?: string | undefined;
    /** Right-aligned muted text in the header row (e.g. a timestamp). */
    meta?: string | undefined;
    /** Renders an <a> instead of a <div>; implies the hover affordance.
     * Mutually exclusive with onclick — if both are passed, href wins. */
    href?: string | undefined;
    /** Renders a <button> instead of a <div>; implies the hover affordance. */
    onclick?: ((event: MouseEvent) => void) | undefined;
    /** For choice-card sets (theme pickers, plan selectors): marks this card
     * as the active choice. Renders aria-pressed on the button variant,
     * aria-current on the anchor variant, and the accent border + tint;
     * on a static card it is visual-only (prefer a clickable variant). */
    selected?: boolean | undefined;
    ariaLabel?: string | undefined;
    class?: string;
    /** Trailing header content — icon buttons, chips. */
    actions?: Snippet;
    children?: Snippet;
    /** Divided from the body by a muted rule. */
    footer?: Snippet;
  }

  let {
    level = "default",
    padding = "md",
    eyebrow = undefined,
    eyebrowTone = undefined,
    title = undefined,
    meta = undefined,
    href = undefined,
    onclick = undefined,
    selected = undefined,
    ariaLabel = undefined,
    class: className = "",
    actions,
    children,
    footer,
  }: Props = $props();

  const hasHeader = $derived(
    eyebrow !== undefined || title !== undefined || meta !== undefined || actions !== undefined,
  );

  const classes = $derived([
    "kit-card",
    `kit-card--${level}`,
    `kit-card--pad-${padding}`,
    (href !== undefined || onclick !== undefined) && "kit-card--clickable",
    selected && "kit-card--selected",
    className,
  ]);
</script>

{#snippet inner()}
  {#if hasHeader}
    <div class="kit-card__header">
      {#if eyebrow !== undefined}
        <span class={["kit-card__eyebrow", eyebrowTone && `kit-card__eyebrow--tone-${eyebrowTone}`]}
          >{eyebrow}</span
        >
      {/if}
      {#if title !== undefined}
        <span class="kit-card__title">{title}</span>
      {/if}
      {#if meta !== undefined}
        <span class="kit-card__meta">{meta}</span>
      {/if}
      {#if actions}
        <div class="kit-card__actions" class:kit-card__actions--flush={meta === undefined}>
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  {#if children}
    <div class="kit-card__body">
      {@render children()}
    </div>
  {/if}
  {#if footer}
    <div class="kit-card__footer">
      {@render footer()}
    </div>
  {/if}
{/snippet}

{#if href !== undefined}
  <a class={classes} {href} aria-current={selected ? "true" : undefined} aria-label={ariaLabel}
    >{@render inner()}</a
  >
{:else if onclick !== undefined}
  <button type="button" class={classes} {onclick} aria-pressed={selected} aria-label={ariaLabel}
    >{@render inner()}</button
  >
{:else}
  <div class={classes} aria-label={ariaLabel}>{@render inner()}</div>
{/if}

<style>
  .kit-card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
    border-radius: var(--kit-card-radius);
    background: var(--kit-card-bg);
    border: var(--border-width) solid var(--kit-card-border);
    box-shadow: var(--kit-card-shadow);
    color: var(--text-primary);
    text-align: left;
    text-decoration: none;
  }

  /* The three hierarchy levels — the recipes middleman's hand-rolled cards
   * converged on (.inset-box / .event-card / RepoSummaryCard). */
  .kit-card--inset {
    --kit-card-bg: var(--bg-inset);
    --kit-card-border: var(--border-muted);
    --kit-card-radius: var(--radius-sm);
    --kit-card-shadow: none;
  }

  .kit-card--default {
    --kit-card-bg: var(--bg-surface);
    --kit-card-border: var(--border-muted);
    --kit-card-radius: var(--radius-md);
    --kit-card-shadow: none;
  }

  .kit-card--raised {
    --kit-card-bg: var(--bg-surface);
    --kit-card-border: var(--border-default);
    --kit-card-radius: var(--radius-lg);
    --kit-card-shadow: var(--shadow-sm);
  }

  .kit-card--pad-none {
    padding: 0;
  }

  .kit-card--pad-sm {
    padding: var(--space-4) var(--space-5);
  }

  .kit-card--pad-md {
    padding: var(--space-5) var(--space-6);
  }

  /* Clickable cards (a/button) get the accent hover middleman's
   * launch-card established. */
  .kit-card--clickable {
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    transition:
      background-color var(--transition-fast) var(--transition-ease, ease),
      border-color var(--transition-fast) var(--transition-ease, ease),
      box-shadow var(--transition-fast) var(--transition-ease, ease),
      transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-card--clickable:hover {
    border-color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 6%, var(--kit-card-bg));
  }

  .kit-card--clickable:active {
    transform: var(--press-transform);
  }

  /* Declared after :hover so the chosen card holds its stronger tint. */
  .kit-card--selected,
  .kit-card--selected:hover {
    border-color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 8%, var(--kit-card-bg));
  }

  .kit-card__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    flex-wrap: wrap;
  }

  .kit-card__eyebrow {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold, 700);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-label, 0.04em);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  /* Eyebrow tones — the chip ink recipe (65% accent toward text). */
  .kit-card__eyebrow--tone-info {
    color: color-mix(in srgb, var(--accent-blue) 65%, var(--text-primary));
  }
  .kit-card__eyebrow--tone-success {
    color: color-mix(in srgb, var(--accent-green) 65%, var(--text-primary));
  }
  .kit-card__eyebrow--tone-warning {
    color: color-mix(in srgb, var(--accent-amber) 65%, var(--text-primary));
  }
  .kit-card__eyebrow--tone-danger {
    color: color-mix(in srgb, var(--accent-red) 65%, var(--text-primary));
  }
  .kit-card__eyebrow--tone-merged {
    color: color-mix(in srgb, var(--accent-purple) 65%, var(--text-primary));
  }
  .kit-card__eyebrow--tone-workspace {
    color: color-mix(in srgb, var(--accent-teal) 65%, var(--text-primary));
  }
  .kit-card__eyebrow--tone-neutral {
    color: var(--text-secondary);
  }
  .kit-card__eyebrow--tone-muted,
  .kit-card__eyebrow--tone-canceled {
    color: var(--text-muted);
  }

  .kit-card__title {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-card__meta {
    margin-left: auto;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .kit-card__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .kit-card__actions--flush {
    margin-left: auto;
  }

  .kit-card__body {
    min-width: 0;
  }

  .kit-card__footer {
    min-width: 0;
    border-top: 1px solid var(--border-muted);
    padding-top: var(--space-4);
  }
</style>
