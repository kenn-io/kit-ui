<script module lang="ts">
  import type { ChipTone } from "./Chip.svelte";

  export type TimelineTone = ChipTone;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Dot accent, using the Chip tone vocabulary. Untinted dots read as
     * system events. */
    tone?: TimelineTone | undefined;
    class?: string;
    children?: Snippet;
  }

  let { tone = undefined, class: className = "", children }: Props = $props();
</script>

<li class={["kit-timeline-item", tone && `kit-timeline-item--tone-${tone}`, className]}>
  <div class="kit-timeline-item__rail" aria-hidden="true">
    <span class="kit-timeline-item__dot"></span>
    <span class="kit-timeline-item__line"></span>
  </div>
  <div class="kit-timeline-item__content">
    {#if children}
      {@render children()}
    {/if}
  </div>
</li>

<style>
  .kit-timeline-item {
    display: flex;
    gap: var(--space-4);
    min-width: 0;
  }

  /* The rail: a 10px toned dot punched out of a 2px connector by a halo of
   * the canvas color (middleman's .event-rail anatomy). The halo assumes
   * the timeline sits on --bg-primary; on another surface, override
   * --kit-timeline-halo. */
  .kit-timeline-item__rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 24px;
    flex-shrink: 0;
    padding-top: 14px;
  }

  .kit-timeline-item__dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-dot, 50%);
    background: var(--kit-timeline-dot, var(--border-default));
    box-shadow: 0 0 0 3px var(--kit-timeline-halo, var(--bg-primary));
    z-index: 1;
    flex-shrink: 0;
  }

  .kit-timeline-item__line {
    flex: 1;
    width: 2px;
    background: var(--border-default);
    margin-top: var(--space-1);
  }

  .kit-timeline-item:last-child .kit-timeline-item__line {
    display: none;
  }

  .kit-timeline-item__content {
    flex: 1;
    min-width: 0;
    padding: var(--space-2) 0 var(--space-6);
  }

  .kit-timeline-item:last-child .kit-timeline-item__content {
    padding-bottom: var(--space-2);
  }

  /* Dot tones — same accent map as Chip. */
  .kit-timeline-item--tone-info {
    --kit-timeline-dot: var(--accent-blue);
  }
  .kit-timeline-item--tone-success {
    --kit-timeline-dot: var(--accent-green);
  }
  .kit-timeline-item--tone-warning {
    --kit-timeline-dot: var(--accent-amber);
  }
  .kit-timeline-item--tone-danger {
    --kit-timeline-dot: var(--accent-red);
  }
  .kit-timeline-item--tone-merged {
    --kit-timeline-dot: var(--accent-purple);
  }
  .kit-timeline-item--tone-workspace {
    --kit-timeline-dot: var(--accent-teal);
  }
  .kit-timeline-item--tone-neutral {
    --kit-timeline-dot: var(--text-secondary);
  }
  .kit-timeline-item--tone-muted,
  .kit-timeline-item--tone-canceled {
    --kit-timeline-dot: var(--text-muted);
  }
</style>
