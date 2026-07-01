<script module lang="ts">
  export type ButtonTone = "neutral" | "success" | "danger" | "info" | "workflow";
  export type ButtonSurface = "outline" | "soft" | "solid";
  export type ButtonSize = "sm" | "md";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    tone?: ButtonTone;
    surface?: ButtonSurface;
    size?: ButtonSize;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    title?: string | undefined;
    ariaLabel?: string | undefined;
    ariaDescribedby?: string | undefined;
    label?: string;
    shortLabel?: string;
    ariaExpanded?: boolean;
    class?: string;
    onclick?: ((event: MouseEvent) => void) | undefined;
    children?: Snippet;
    trailing?: Snippet;
  }

  let {
    tone = "neutral",
    surface = "outline",
    size = "md",
    type = "button",
    disabled = false,
    title = undefined,
    ariaLabel = undefined,
    ariaDescribedby = undefined,
    label = undefined,
    shortLabel = undefined,
    ariaExpanded = undefined,
    class: className = "",
    onclick = undefined,
    children,
    trailing,
  }: Props = $props();

  const classes = $derived(
    [
      "kit-button",
      `kit-button--${tone}`,
      `kit-button--${surface}`,
      `kit-button--${size}`,
      className,
    ].filter(Boolean).join(" "),
  );
</script>

<button
  {type}
  class={classes}
  {disabled}
  {title}
  aria-expanded={ariaExpanded}
  aria-label={ariaLabel ?? (label && shortLabel ? label : undefined)}
  aria-describedby={ariaDescribedby}
  onclick={onclick}
>
  {#if children}
    {@render children()}
  {/if}
  {#if label}
    <span class="kit-button__label">{label}</span>
  {/if}
  {#if shortLabel}
    <span class="kit-button__short-label">{shortLabel}</span>
  {/if}
  {#if trailing}
    {@render trailing()}
  {/if}
</button>

<style>
  .kit-button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 28px;
    font-family: inherit;
    font-size: var(--font-size-md);
    font-weight: 500;
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease,
      box-shadow 0.12s ease,
      transform 0.08s ease,
      opacity 0.1s ease;
    white-space: nowrap;
    line-height: 1;
  }

  .kit-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 42%, transparent);
  }

  .kit-button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .kit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .kit-button--sm {
    min-height: 24px;
    padding: 4px 12px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .kit-button :global(svg) {
    flex-shrink: 0;
  }

  .kit-button__short-label {
    display: none;
  }

  /* Neutral outline — cancel / secondary */
  .kit-button--outline.kit-button--neutral {
    background: var(--bg-inset);
    color: var(--text-secondary);
    border: 1px solid var(--border-default);
  }
  .kit-button--outline.kit-button--neutral:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  /* Neutral soft — low-emphasis secondary actions */
  .kit-button--soft.kit-button--neutral {
    background: color-mix(in srgb, var(--text-muted) 8%, var(--bg-inset));
    color: var(--text-secondary);
    border: 1px solid color-mix(in srgb, var(--border-default) 80%, transparent);
  }
  .kit-button--soft.kit-button--neutral:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
    border-color: var(--border-default);
  }

  /* Danger outline — neutral at rest, red on hover */
  .kit-button--outline.kit-button--danger {
    background: var(--bg-surface);
    color: var(--text-secondary);
    border: 1px solid var(--border-default);
  }
  .kit-button--outline.kit-button--danger:hover:not(:disabled) {
    background: var(--accent-red, #d73a49);
    color: #fff;
    border-color: var(--accent-red, #d73a49);
  }

  /* Danger solid — destructive confirm */
  .kit-button--solid.kit-button--danger {
    background: var(--accent-red);
    color: #fff;
    border: 1px solid var(--accent-red);
  }
  .kit-button--solid.kit-button--danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-red) 88%, #000);
    border-color: color-mix(in srgb, var(--accent-red) 88%, #000);
  }
  .kit-button--solid.kit-button--danger:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-red) 42%, transparent);
  }

  /* Success solid — merge, confirm */
  .kit-button--solid.kit-button--success {
    background: #1a7f37;
    color: #e6ffe6;
    border: 1px solid #1a7f37;
  }
  .kit-button--solid.kit-button--success:hover:not(:disabled) {
    background: #176b2e;
    border-color: #176b2e;
  }
  .kit-button--solid.kit-button--success:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-green) 48%, transparent);
  }
  .kit-button--solid.kit-button--success:active:not(:disabled),
  .kit-button--solid.kit-button--success[aria-expanded="true"] {
    background: #145c27;
    border-color: #145c27;
  }

  /* Info solid — primary submit / save */
  .kit-button--solid.kit-button--info {
    background: var(--accent-blue);
    color: #fff;
    border: 1px solid var(--accent-blue);
  }
  .kit-button--solid.kit-button--info:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-blue) 88%, #000);
    border-color: color-mix(in srgb, var(--accent-blue) 88%, #000);
  }
  .kit-button--solid.kit-button--info:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 42%, transparent);
  }
  .kit-button--solid.kit-button--info:active:not(:disabled),
  .kit-button--solid.kit-button--info[aria-expanded="true"] {
    background: color-mix(in srgb, var(--accent-blue) 78%, #000);
    border-color: color-mix(in srgb, var(--accent-blue) 78%, #000);
  }

  /* Success soft — approve */
  .kit-button--soft.kit-button--success {
    background: color-mix(in srgb, var(--accent-green) 12%, transparent);
    color: var(--accent-green);
    border: 1px solid color-mix(in srgb, var(--accent-green) 30%, transparent);
  }
  .kit-button--soft.kit-button--success:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-green) 20%, transparent);
  }
  .kit-button--soft.kit-button--success:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-green) 38%, transparent);
  }
  .kit-button--soft.kit-button--success:active:not(:disabled),
  .kit-button--soft.kit-button--success[aria-expanded="true"] {
    background: color-mix(in srgb, var(--accent-green) 26%, transparent);
    border-color: color-mix(in srgb, var(--accent-green) 48%, transparent);
  }

  /* Info soft — ready for review */
  .kit-button--soft.kit-button--info {
    background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
    color: var(--accent-blue);
    border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
  }
  .kit-button--soft.kit-button--info:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-blue) 18%, transparent);
  }

  /* Workflow soft — purple emphasis */
  .kit-button--soft.kit-button--workflow {
    background: color-mix(in srgb, var(--accent-purple) 12%, transparent);
    color: var(--accent-purple);
    border: 1px solid color-mix(in srgb, var(--accent-purple) 30%, transparent);
  }
  .kit-button--soft.kit-button--workflow:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-purple) 20%, transparent);
  }
</style>
