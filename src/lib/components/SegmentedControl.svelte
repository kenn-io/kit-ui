<script module lang="ts">
  export interface SegmentedControlOption {
    value: string;
    label: string;
    title?: string;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  interface Props {
    options: SegmentedControlOption[];
    value: string;
    onchange: (value: string) => void;
    /** Accessible name for the group. */
    ariaLabel?: string;
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
      type="button"
      role="radio"
      aria-checked={option.value === value}
      tabindex={option.value === value ? 0 : -1}
      title={option.title}
      disabled={disabled || option.disabled}
      onclick={() => select(option)}
      onkeydown={handleKeydown}
    >
      {option.label}
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
    padding: 3px 10px;
    border: 0;
    background: transparent;
    font-family: inherit;
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-muted);
    border-radius: calc(var(--radius-sm) - 1px);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
    white-space: nowrap;
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
   * borders. Each segment owns its border (collapsed with -1px margins)
   * so the active segment's accent-tinted border wins the shared edges —
   * the outer border is never one uniform color around a tinted pill. */
  .kit-segmented--borderless {
    gap: 0;
    padding: 0;
    background: transparent;
  }

  .kit-segmented--borderless .kit-segmented__btn {
    position: relative;
    padding: 4px 10px;
    border: 1px solid var(--border-default);
    border-radius: 0;
    margin-left: -1px;
  }

  .kit-segmented--borderless .kit-segmented__btn:first-child {
    margin-left: 0;
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

  .kit-segmented--borderless .kit-segmented__btn.active {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    color: var(--accent-blue);
    font-weight: 600;
    border-color: color-mix(in srgb, var(--accent-blue) 30%, var(--border-default));
    box-shadow: none;
    z-index: 1;
  }

  .kit-segmented--borderless .kit-segmented__btn:hover:not(.active):not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-secondary);
  }
</style>
