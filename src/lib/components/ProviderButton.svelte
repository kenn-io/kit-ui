<script lang="ts">
  import ProviderBrandMark from "./ProviderBrandMark.svelte";
  import type { ProviderBrand } from "./provider-brand.js";

  interface Props {
    provider: ProviderBrand;
    label: string;
    iconUrl?: string;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    title?: string;
    ariaLabel?: string;
    class?: string;
    onclick?: (event: MouseEvent) => void;
  }

  let {
    provider,
    label,
    iconUrl = undefined,
    disabled = false,
    type = "button",
    title = undefined,
    ariaLabel = undefined,
    class: className = "",
    onclick = undefined,
  }: Props = $props();

  const classes = $derived(
    ["kit-provider-button", `kit-provider-button--${provider}`, className]
      .filter(Boolean)
      .join(" "),
  );
</script>

<button {type} class={classes} {disabled} {title} aria-label={ariaLabel} {onclick}>
  <ProviderBrandMark {provider} {iconUrl} />
  <span class="kit-provider-button__label">{label}</span>
</button>

<style>
  .kit-provider-button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--provider-button-height, 40px);
    padding: var(--provider-button-padding, 0 var(--space-5));
    gap: var(--provider-button-gap, var(--space-5));
    border: var(--border-width) solid
      var(--provider-button-border, var(--provider-button-default-border));
    border-radius: var(--provider-button-radius, var(--radius-sm));
    background: var(--provider-button-background, var(--provider-button-default-background));
    color: var(--provider-button-color, var(--provider-button-default-color));
    font-family: inherit;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-medium);
    line-height: normal;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background-color var(--transition-fast) var(--transition-ease, ease),
      border-color var(--transition-fast) var(--transition-ease, ease),
      color var(--transition-fast) var(--transition-ease, ease),
      transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-provider-button--google {
    --provider-button-default-background: var(--provider-google-button-background);
    --provider-button-default-border: var(--provider-google-button-border);
    --provider-button-default-color: var(--provider-google-button-color);
    --provider-button-default-hover-background: var(--provider-google-button-hover-background);
    --provider-button-default-disabled-background: var(--provider-google-button-background);
    --provider-button-default-disabled-border: var(--provider-google-button-disabled-border);
    --provider-button-default-disabled-color: var(--provider-google-button-disabled-color);
  }

  .kit-provider-button--sso {
    --provider-button-default-background: var(--bg-inset);
    --provider-button-default-border: var(--border-default);
    --provider-button-default-color: var(--text-secondary);
    --provider-button-default-hover-background: var(--bg-surface-hover);
    --provider-button-default-disabled-background: var(--bg-inset);
    --provider-button-default-disabled-border: var(--border-muted);
    --provider-button-default-disabled-color: var(--text-muted);
  }

  .kit-provider-button:hover:not(:disabled) {
    background: var(
      --provider-button-hover-background,
      var(--provider-button-default-hover-background)
    );
  }

  .kit-provider-button:active:not(:disabled) {
    transform: var(--press-transform);
  }

  .kit-provider-button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  .kit-provider-button:disabled {
    background: var(
      --provider-button-disabled-background,
      var(--provider-button-background, var(--provider-button-default-disabled-background))
    );
    border-color: var(
      --provider-button-disabled-border,
      var(--provider-button-border, var(--provider-button-default-disabled-border))
    );
    color: var(
      --provider-button-disabled-color,
      var(--provider-button-color, var(--provider-button-default-disabled-color))
    );
    cursor: not-allowed;
  }

  .kit-provider-button__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
