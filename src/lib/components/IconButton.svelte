<script module lang="ts">
  export type IconButtonSize = "sm" | "md";
  export type IconButtonTone = "neutral" | "success" | "danger" | "info" | "workflow";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Accessible name — required, an icon carries no text of its own. */
    ariaLabel: string;
    /** Hover tooltip; defaults to the aria-label. */
    title?: string;
    /** sm = 24px, md = 28px square. */
    size?: IconButtonSize;
    /** Accent applied on hover (and to the pressed state). */
    tone?: IconButtonTone;
    disabled?: boolean;
    /** For menu/popover triggers. */
    ariaExpanded?: boolean;
    /** For menu/popover triggers: the kind of popup (e.g. "menu", "dialog",
     * true). */
    ariaHaspopup?: "menu" | "listbox" | "dialog" | "grid" | "tree" | boolean;
    /** id of the element this button controls (pairs with ariaExpanded). */
    ariaControls?: string;
    /** For toggle buttons — `true` renders the pressed (inset) look. */
    ariaPressed?: boolean;
    type?: "button" | "submit" | "reset";
    onclick?: ((event: MouseEvent) => void) | undefined;
    /** The icon (size 14 works well at both button sizes). */
    children: Snippet;
    class?: string;
  }

  let {
    ariaLabel,
    title = undefined,
    size = "md",
    tone = "neutral",
    disabled = false,
    ariaExpanded = undefined,
    ariaHaspopup = undefined,
    ariaControls = undefined,
    ariaPressed = undefined,
    type = "button",
    onclick = undefined,
    children,
    class: className = "",
  }: Props = $props();
</script>

<button
  {type}
  class={["kit-icon-button", `kit-icon-button--${size}`, `kit-icon-button--${tone}`, className]}
  {disabled}
  title={title ?? ariaLabel}
  aria-label={ariaLabel}
  aria-expanded={ariaExpanded}
  aria-haspopup={ariaHaspopup}
  aria-controls={ariaControls}
  aria-pressed={ariaPressed}
  {onclick}
>
  {@render children()}
</button>

<style>
  .kit-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .kit-icon-button--sm {
    width: 24px;
    height: 24px;
  }

  .kit-icon-button--md {
    width: 28px;
    height: 28px;
  }

  .kit-icon-button:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-icon-button[aria-pressed="true"] {
    background: var(--bg-inset);
    color: var(--text-primary);
  }

  .kit-icon-button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  .kit-icon-button:disabled {
    opacity: var(--opacity-disabled);
    cursor: default;
  }

  .kit-icon-button--success:hover:not(:disabled) {
    color: var(--accent-green);
    background: color-mix(in srgb, var(--accent-green) 10%, transparent);
  }

  .kit-icon-button--danger:hover:not(:disabled) {
    color: var(--accent-red);
    background: color-mix(in srgb, var(--accent-red) 10%, transparent);
  }

  .kit-icon-button--info:hover:not(:disabled) {
    color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  }

  .kit-icon-button--workflow:hover:not(:disabled) {
    color: var(--accent-purple);
    background: color-mix(in srgb, var(--accent-purple) 10%, transparent);
  }

  .kit-icon-button--success[aria-pressed="true"] {
    color: var(--accent-green);
  }

  .kit-icon-button--danger[aria-pressed="true"] {
    color: var(--accent-red);
  }

  .kit-icon-button--info[aria-pressed="true"] {
    color: var(--accent-blue);
  }

  .kit-icon-button--workflow[aria-pressed="true"] {
    color: var(--accent-purple);
  }
</style>
