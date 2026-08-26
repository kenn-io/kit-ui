<script module lang="ts">
  export type NoticeTone = "info" | "success" | "warning" | "error";
</script>

<script lang="ts">
  interface Props {
    tone?: NoticeTone;
    toneLabel?: string;
    title?: string;
    message: string;
    actionLabel?: string;
    onaction?: () => void;
  }

  let {
    tone = "info",
    toneLabel = undefined,
    title = undefined,
    message,
    actionLabel = undefined,
    onaction = undefined,
  }: Props = $props();

  const DEFAULT_TONE_LABELS: Record<NoticeTone, string> = {
    info: "Info",
    success: "Success",
    warning: "Warning",
    error: "Error",
  };
  const resolvedToneLabel = $derived(toneLabel?.trim() || DEFAULT_TONE_LABELS[tone]);
</script>

<div
  class="kit-notice"
  data-tone={tone}
  role={tone === "error" ? "alert" : "status"}
  aria-live={tone === "error" ? "assertive" : "polite"}
>
  <span class="kit-notice__mark" aria-hidden="true"></span>
  <div class="kit-notice__content">
    <p class="kit-notice__tone">{resolvedToneLabel}</p>
    {#if title}<p class="kit-notice__title">{title}</p>{/if}
    <p class="kit-notice__message">{message}</p>
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

  .kit-notice__mark {
    width: 8px;
    height: 8px;
    margin-top: 6px;
    border-radius: 50%;
    background: var(--kit-notice-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--kit-notice-accent) 16%, transparent);
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
