<script module lang="ts">
  export type SegmentedControlTone = "info" | "success" | "warning" | "danger";

  export interface SegmentedControlOption {
    value: string;
    label: string;
    title?: string;
    disabled?: boolean;
    /** Per-segment semantic accent. In the borderless variant a toned
     * segment tints its ink and border even while inactive; when active
     * it takes the full tone band. Untoned segments keep the default
     * accent when active. */
    tone?: SegmentedControlTone;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    options: SegmentedControlOption[];
    value: string;
    onchange: (value: string) => void;
    /** Accessible name for the group. */
    ariaLabel?: string;
    /** Custom segment content (icons, counts, icon+text) rendered in
     * place of the label text. `option.label` stays the accessible name
     * — it becomes the button's aria-label — so icon-only segments keep
     * a readable name for assistive tech. */
    segment?: Snippet<[SegmentedControlOption, boolean]>;
    /** Stretch to the container width, segments sharing space equally. */
    block?: boolean;
    /** boxed (default): inset pad with a floating surface pill.
     * borderless: flat strip of flush segments, the active one tinted
     * with the accent. Segments draw their own borders, so the border
     * around the active segment takes the accent-tinted color (the Modal
     * tone-border fixup) instead of a uniform outer line fighting the
     * selection. */
    variant?: "boxed" | "borderless";
    disabled?: boolean;
    class?: string;
  }

  let {
    options,
    value,
    onchange,
    ariaLabel = undefined,
    segment = undefined,
    block = false,
    variant = "boxed",
    disabled = false,
    class: className = "",
  }: Props = $props();

  let groupEl = $state<HTMLDivElement>();

  function select(option: SegmentedControlOption): void {
    if (disabled || option.disabled) return;
    if (option.value !== value) onchange(option.value);
  }

  // Roving focus: arrows move selection like a radio group.
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex((o) => o.value === value);
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    const next = enabled[(current + delta + enabled.length) % enabled.length];
    if (!next) return;
    onchange(next.value);
    const index = options.findIndex((o) => o.value === next.value);
    const buttons = groupEl?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[index]?.focus();
  }
</script>

<div
  class={[
    "kit-segmented",
    `kit-segmented--${variant}`,
    { "kit-segmented--block": block },
    className,
  ]}
  role="radiogroup"
  aria-label={ariaLabel}
  bind:this={groupEl}
>
  {#each options as option (option.value)}
    <button
      class="kit-segmented__btn"
      class:active={option.value === value}
      data-kit-tone={option.tone}
      type="button"
      role="radio"
      aria-checked={option.value === value}
      aria-label={segment ? option.label : undefined}
      tabindex={option.value === value ? 0 : -1}
      title={option.title}
      disabled={disabled || option.disabled}
      onclick={() => select(option)}
      onkeydown={handleKeydown}
    >
      {#if segment}
        {@render segment(option, option.value === value)}
      {:else}
        {option.label}
      {/if}
    </button>
  {/each}
</div>

<style>
  .kit-segmented {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    background: var(--bg-inset);
    border-radius: var(--radius-sm);
    padding: 2px;
  }

  .kit-segmented--block {
    display: flex;
    width: 100%;
  }

  .kit-segmented__btn {
    /* Flex so snippet content (icon + text) aligns and gaps cleanly;
     * inherited line-height keeps text-only segments unchanged. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: 3px 10px;
    border: 0;
    background: transparent;
    font-family: inherit;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium, 500);
    color: var(--text-muted);
    border-radius: calc(var(--radius-sm) - 1px);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
    white-space: nowrap;
  }

  /* Per-segment accent comes from the shared data-kit-tone map in
   * theme.css; untoned segments fall back to the historical active-blue
   * via var(--kit-tone, var(--accent-blue)).
   *
   * Toned active ink follows the shared band recipe (72% toward
   * --text-primary keeps small text at AA on the tint) — applies to the
   * boxed pill too so a toned option reads consistently across variants. */
  .kit-segmented__btn[data-kit-tone].active {
    color: var(--kit-tone-ink);
  }

  .kit-segmented--block .kit-segmented__btn {
    flex: 1;
    padding-inline: 6px;
  }

  .kit-segmented__btn.active {
    background: var(--bg-surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .kit-segmented__btn:hover:not(.active):not(:disabled) {
    color: var(--text-secondary);
  }

  .kit-segmented__btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }

  .kit-segmented__btn:disabled {
    opacity: var(--opacity-disabled);
    cursor: not-allowed;
  }

  /* Borderless (flat strip) variant: flush segments sharing hairline
   * borders. Each segment owns its border so a segment's border area can
   * take its own tone (the Modal band principle) — the outer border is
   * never one uniform color around a tinted pill. Shared-edge precedence:
   * the ACTIVE segment's border wins its edges; between inactive
   * neighbors the LEFTMOST segment's right border owns the shared edge
   * (segments after the first drop their left border, so nothing
   * overlaps by default). */
  .kit-segmented--borderless {
    gap: 0;
    padding: 0;
    background: transparent;
  }

  .kit-segmented--borderless .kit-segmented__btn {
    position: relative;
    padding: 4px 10px;
    border: var(--border-width) solid var(--border-default);
    border-radius: 0;
  }

  .kit-segmented--borderless .kit-segmented__btn + .kit-segmented__btn {
    border-left-width: 0;
  }

  /* Active trumps leftmost: it restores its left border and pulls over
   * the left neighbor's right border, its z-index winning the overlap. */
  .kit-segmented--borderless .kit-segmented__btn + .kit-segmented__btn.active {
    border-left-width: 1px;
    margin-left: -1px;
  }

  .kit-segmented--borderless .kit-segmented__btn:first-child {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  .kit-segmented--borderless .kit-segmented__btn:last-child {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  /* A lone segment matches first- and last-child; last-child's radius
   * would square the left corners without this. */
  .kit-segmented--borderless .kit-segmented__btn:only-child {
    border-radius: var(--radius-sm);
  }

  /* Toned segments carry their color while inactive too: tinted border
   * (30% mix, same as the active edge) and ink mixed toward
   * --text-secondary — deliberately quieter than the active band's
   * --kit-tone-ink. */
  .kit-segmented--borderless .kit-segmented__btn[data-kit-tone]:not(.active) {
    border-color: var(--kit-tone-border);
    color: color-mix(in srgb, var(--kit-tone) 72%, var(--text-secondary));
  }

  /* Active fill is 12% toward transparent (not the 9%-toward-surface band
   * recipe): segments sit on arbitrary surfaces, so the tint must let the
   * underlying background through. */
  .kit-segmented--borderless .kit-segmented__btn.active {
    background: color-mix(in srgb, var(--kit-tone, var(--accent-blue)) 12%, transparent);
    color: color-mix(in srgb, var(--kit-tone, var(--accent-blue)) 72%, var(--text-primary));
    font-weight: var(--font-weight-semibold, 600);
    border-color: color-mix(
      in srgb,
      var(--kit-tone, var(--accent-blue)) 30%,
      var(--border-default)
    );
    box-shadow: none;
    z-index: 1;
  }

  .kit-segmented--borderless .kit-segmented__btn:hover:not(.active):not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-secondary);
  }

  .kit-segmented--borderless .kit-segmented__btn[data-kit-tone]:hover:not(.active):not(:disabled) {
    color: color-mix(in srgb, var(--kit-tone) 82%, var(--text-primary));
  }
</style>
