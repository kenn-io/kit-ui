<script module lang="ts">
  export type NoticeTone = "info" | "success" | "warning" | "error" | "note" | "tip" | "important";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    tone?: NoticeTone;
    toneLabel?: string;
    title?: string;
    /** Plain-text body. Use `children` for rich content (links, code,
     * lists); when both are passed, `children` wins. */
    message?: string;
    children?: Snippet;
    /** Replaces the tone dot, e.g. a Lucide icon. Decorative: the tone
     * label carries the meaning. */
    icon?: Snippet;
    /** `true` (default) announces the notice as a live status (alert for
     * errors), for feedback that appears in response to something. Set
     * `false` for a static callout in page content; it renders as a
     * `note` and is not announced. */
    live?: boolean;
    actionLabel?: string;
    onaction?: () => void;
    class?: string;
  }

  let {
    tone = "info",
    toneLabel = undefined,
    title = undefined,
    message = undefined,
    children = undefined,
    icon = undefined,
    live = true,
    actionLabel = undefined,
    onaction = undefined,
    class: className = "",
  }: Props = $props();

  const DEFAULT_TONE_LABELS: Record<NoticeTone, string> = {
    info: "Info",
    success: "Success",
    warning: "Warning",
    error: "Error",
    note: "Note",
    tip: "Tip",
    important: "Important",
  };
  const resolvedToneLabel = $derived(toneLabel?.trim() || DEFAULT_TONE_LABELS[tone]);
  const role = $derived(live ? (tone === "error" ? "alert" : "status") : "note");
  const ariaLive = $derived(live ? (tone === "error" ? "assertive" : "polite") : undefined);
</script>

<div class="kit-notice {className}" data-tone={tone} {role} aria-live={ariaLive}>
  {#if icon}
    <span class="kit-notice__icon" aria-hidden="true">{@render icon()}</span>
  {:else}
    <span class="kit-notice__mark" aria-hidden="true"></span>
  {/if}
  <div class="kit-notice__content">
    <p class="kit-notice__tone">{resolvedToneLabel}</p>
    {#if title}<p class="kit-notice__title">{title}</p>{/if}
    {#if children}
      <div class="kit-notice__message kit-notice__body">{@render children()}</div>
    {:else if message}
      <p class="kit-notice__message">{message}</p>
    {/if}
  </div>
  {#if actionLabel && onaction}
    <button class="kit-control-states" type="button" onclick={onaction}>{actionLabel}</button>
  {/if}
</div>

<style>
  .kit-notice {
    --kit-notice-accent: var(--accent-blue);

    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-4);
    padding: var(--space-5);
    background: color-mix(in srgb, var(--kit-notice-accent) 8%, var(--bg-surface));
    border: var(--border-width) solid
      color-mix(in srgb, var(--kit-notice-accent) 32%, var(--border-default));
    border-radius: var(--radius-md);
    color: var(--text-primary);
  }

  .kit-notice[data-tone="success"] {
    --kit-notice-accent: var(--accent-green);
  }

  .kit-notice[data-tone="warning"] {
    --kit-notice-accent: var(--accent-amber);
  }

  .kit-notice[data-tone="error"] {
    --kit-notice-accent: var(--accent-red);
  }

  .kit-notice[data-tone="note"] {
    --kit-notice-accent: var(--text-muted);
  }

  .kit-notice[data-tone="tip"] {
    --kit-notice-accent: var(--accent-teal);
  }

  .kit-notice[data-tone="important"] {
    --kit-notice-accent: var(--accent-purple);
  }

  .kit-notice__mark {
    width: 8px;
    height: 8px;
    margin-top: 6px;
    border-radius: 50%;
    background: var(--kit-notice-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--kit-notice-accent) 16%, transparent);
  }

  .kit-notice__icon {
    display: inline-flex;
    color: var(--kit-notice-accent);
    line-height: 0;
  }

  .kit-notice__icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .kit-notice__content {
    min-width: 0;
  }

  .kit-notice__tone,
  .kit-notice__title,
  .kit-notice__message {
    margin: 0;
  }

  .kit-notice__tone {
    margin-bottom: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    line-height: 1.4;
  }

  .kit-notice__title {
    margin-bottom: var(--space-1);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
  }

  .kit-notice__message {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .kit-notice__body > :global(:first-child) {
    margin-top: 0;
  }

  .kit-notice__body > :global(:last-child) {
    margin-bottom: 0;
  }

  .kit-notice__body :global(ul),
  .kit-notice__body :global(ol) {
    margin: 0;
    padding-left: 1.25em;
  }

  .kit-notice__body :global(a) {
    color: var(--text-primary);
  }

  .kit-notice__body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }

  .kit-notice button {
    padding: var(--space-2) var(--space-4);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
  }

  .kit-notice button:hover {
    background: color-mix(in srgb, var(--kit-notice-accent) 10%, transparent);
  }

  .kit-notice button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    .kit-notice {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .kit-notice button {
      grid-column: 2;
      justify-self: start;
      margin-left: calc(-1 * var(--space-4));
    }
  }
</style>
