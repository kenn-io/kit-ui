<script lang="ts">
  import type { Snippet } from "svelte";
  import Card, { type CardLevel, type CardTone } from "./Card.svelte";

  interface Props {
    label: string;
    value: string;
    meta?: string | undefined;
    tone?: CardTone | undefined;
    level?: CardLevel;
    ariaLabel?: string | undefined;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    label,
    value,
    meta = undefined,
    tone = undefined,
    level = "raised",
    ariaLabel = undefined,
    children,
    footer,
  }: Props = $props();
</script>

<div class="kit-metric-card" role="group" aria-label={ariaLabel ?? label}>
  <Card {level} padding="none" class="kit-metric-card__surface">
    <div class="kit-metric-card__layout">
      <div class="kit-metric-card__header">
        <span class={["kit-metric-card__label", tone && `kit-metric-card__label--tone-${tone}`]}>
          {label}
        </span>
        {#if meta}<span class="kit-metric-card__meta">{meta}</span>{/if}
      </div>
      <strong class="kit-metric-card__value">{value}</strong>
      {#if children}<div class="kit-metric-card__content">{@render children()}</div>{/if}
      {#if footer}<div class="kit-metric-card__footer">{@render footer()}</div>{/if}
    </div>
  </Card>
</div>

<style>
  .kit-metric-card,
  :global(.kit-metric-card__surface) {
    min-width: 0;
    height: 100%;
  }

  :global(.kit-metric-card__surface > .kit-card__body) {
    height: 100%;
  }

  .kit-metric-card__layout {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 10rem;
    height: 100%;
    padding: var(--space-5) var(--space-6);
  }

  .kit-metric-card__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    min-width: 0;
  }

  .kit-metric-card__label {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold, 700);
    line-height: 1.25;
    letter-spacing: var(--letter-spacing-label, 0.04em);
    text-transform: uppercase;
  }

  .kit-metric-card__label--tone-info {
    color: color-mix(in srgb, var(--accent-blue) 65%, var(--text-primary));
  }

  .kit-metric-card__label--tone-success {
    color: color-mix(in srgb, var(--accent-green) 65%, var(--text-primary));
  }

  .kit-metric-card__label--tone-warning {
    color: color-mix(in srgb, var(--accent-amber) 65%, var(--text-primary));
  }

  .kit-metric-card__label--tone-danger {
    color: color-mix(in srgb, var(--accent-red) 65%, var(--text-primary));
  }

  .kit-metric-card__label--tone-merged {
    color: color-mix(in srgb, var(--accent-purple) 65%, var(--text-primary));
  }

  .kit-metric-card__label--tone-workspace {
    color: color-mix(in srgb, var(--accent-teal) 65%, var(--text-primary));
  }

  .kit-metric-card__label--tone-neutral {
    color: var(--text-secondary);
  }

  .kit-metric-card__label--tone-muted,
  .kit-metric-card__label--tone-canceled {
    color: var(--text-muted);
  }

  .kit-metric-card__meta {
    min-width: 0;
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    line-height: 1.35;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-metric-card__value {
    margin-top: var(--space-4);
    overflow-wrap: anywhere;
    color: var(--text-primary);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold, 600);
    line-height: 1.18;
  }

  .kit-metric-card__content {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-5);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .kit-metric-card__footer {
    margin-top: auto;
    padding-top: var(--space-5);
    border-top: var(--border-width) solid var(--border-muted);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    line-height: 1.4;
  }

  @media (max-width: 480px) {
    .kit-metric-card__layout {
      min-height: 9rem;
      padding: var(--space-5);
    }
  }
</style>
