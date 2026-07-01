<script module lang="ts">
  export type ChipSize = "xs" | "sm" | "md";
  export type ChipTone =
    | "muted"
    | "neutral"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "merged"
    | "canceled"
    | "workspace";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    size?: ChipSize;
    tone?: ChipTone;
    dot?: boolean;
    interactive?: boolean;
    uppercase?: boolean;
    title?: string | undefined;
    style?: string | undefined;
    expanded?: boolean | undefined;
    disabled?: boolean;
    class?: string;
    ariaLabel?: string | undefined;
    dataTestid?: string | undefined;
    onclick?: ((event: MouseEvent) => void) | undefined;
    children?: Snippet | undefined;
  }

  let {
    size = "md",
    tone = undefined,
    dot = false,
    interactive = false,
    uppercase = true,
    title = undefined,
    style = undefined,
    expanded = undefined,
    disabled = false,
    class: className = "",
    ariaLabel = undefined,
    dataTestid = undefined,
    onclick = undefined,
    children,
  }: Props = $props();
</script>

{#if interactive}
  <button
    type="button"
    class={[
      "kit-chip",
      `kit-chip--${size}`,
      tone ? `kit-chip--tone-${tone}` : undefined,
      {
        "kit-chip--interactive": interactive,
        "kit-chip--plain-case": !uppercase,
      },
      className,
    ]}
    {title}
    {style}
    aria-expanded={expanded}
    aria-label={ariaLabel}
    data-testid={dataTestid}
    {disabled}
    onclick={onclick}
  >{#if dot}<span class="kit-chip__dot" aria-hidden="true"></span>{/if}{#if children}<span class="kit-chip__label">{@render children()}</span>{/if}</button>
{:else}
  <span
    class={[
      "kit-chip",
      `kit-chip--${size}`,
      tone ? `kit-chip--tone-${tone}` : undefined,
      {
        "kit-chip--plain-case": !uppercase,
      },
      className,
    ]}
    {title}
    {style}
    aria-label={ariaLabel}
    data-testid={dataTestid}
  >{#if dot}<span class="kit-chip__dot" aria-hidden="true"></span>{/if}{#if children}<span class="kit-chip__label">{@render children()}</span>{/if}</span>
{/if}

<style>
  .kit-chip {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    vertical-align: middle;
    white-space: nowrap;
  }

  /* Pill radius on every size — a large fixed value clamps to half the
   * rendered height, so the shape stays consistent across sizes. Font sizes
   * are fixed tokens (not em-relative), one ladder step apart, so xs < sm <
   * md is visible regardless of the surrounding text size. */
  .kit-chip--xs {
    min-height: 16px;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: var(--font-size-2xs);
    line-height: 1.15;
  }

  .kit-chip--sm {
    min-height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: var(--font-size-xs);
  }

  .kit-chip--md {
    min-height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: var(--font-size-sm);
  }

  .kit-chip--interactive {
    appearance: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.1s;
  }

  .kit-chip--interactive:hover:not(:disabled) {
    opacity: 0.8;
  }

  .kit-chip--interactive:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .kit-chip--plain-case {
    text-transform: none;
    letter-spacing: normal;
  }

  .kit-chip__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .kit-chip__label {
    min-width: 0;
    padding-block: 0.1em;
    margin-block: -0.1em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-chip--xs .kit-chip__dot {
    width: 5px;
    height: 5px;
  }

  .kit-chip--tone-success {
    background: color-mix(in srgb, var(--accent-green) 15%, transparent);
    color: var(--accent-green);
  }

  .kit-chip--tone-danger {
    background: color-mix(in srgb, var(--accent-red) 15%, transparent);
    color: var(--accent-red);
  }

  .kit-chip--tone-warning {
    background: color-mix(in srgb, var(--accent-amber) 15%, transparent);
    color: var(--accent-amber);
  }

  .kit-chip--tone-merged {
    background: color-mix(in srgb, var(--accent-purple) 15%, transparent);
    color: var(--accent-purple);
  }

  .kit-chip--tone-info {
    background: color-mix(in srgb, var(--accent-blue) 15%, transparent);
    color: var(--accent-blue);
  }

  .kit-chip--tone-muted {
    background: var(--bg-inset);
    color: var(--text-muted);
  }

  .kit-chip--tone-canceled {
    background: color-mix(in srgb, var(--text-muted) 15%, transparent);
    color: var(--text-muted);
  }

  .kit-chip--tone-neutral {
    background: var(--bg-inset);
    color: var(--text-secondary);
  }

  .kit-chip--tone-workspace {
    background: color-mix(
      in srgb,
      var(--accent-teal, var(--accent-green)) 15%,
      transparent
    );
    color: var(--accent-teal, var(--accent-green));
  }
</style>
