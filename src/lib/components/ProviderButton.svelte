<script lang="ts">
  import Button from "./Button.svelte";
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

<Button
  tone="neutral"
  surface="outline"
  size="lg"
  {type}
  {disabled}
  {title}
  {ariaLabel}
  class={classes}
  {onclick}
  {label}
>
  <ProviderBrandMark {provider} {iconUrl} />
</Button>

<style>
  :global(.kit-button.kit-button--outline.kit-provider-button) {
    min-height: var(--provider-button-height, 36px);
    padding: var(--provider-button-padding, 5px var(--space-5));
    gap: var(--provider-button-gap, 6px);
    border-color: var(--provider-button-border, var(--provider-button-default-border));
    border-radius: var(--provider-button-radius, var(--radius-sm));
    background: var(--provider-button-background, var(--provider-button-default-background));
    color: var(--provider-button-color, var(--provider-button-default-color));
  }

  :global(.kit-provider-button--google) {
    --provider-button-default-background: var(--provider-google-button-background);
    --provider-button-default-border: var(--provider-google-button-border);
    --provider-button-default-color: var(--provider-google-button-color);
    --provider-button-default-hover-background: var(--provider-google-button-hover-background);
    --provider-button-default-hover-color: var(--provider-google-button-color);
    --provider-button-default-disabled-background: var(--provider-google-button-background);
    --provider-button-default-disabled-border: var(--provider-google-button-disabled-border);
    --provider-button-default-disabled-color: var(--provider-google-button-disabled-color);
  }

  :global(.kit-provider-button--google .kit-provider-brand-mark) {
    transform: translateY(var(--provider-button-mark-offset-y, calc(var(--space-1) * -1)));
  }

  :global(.kit-provider-button--sso) {
    --provider-button-default-background: var(--bg-inset);
    --provider-button-default-border: var(--border-default);
    --provider-button-default-color: var(--text-secondary);
    --provider-button-default-hover-background: var(--bg-surface-hover);
    --provider-button-default-hover-color: var(--text-primary);
    --provider-button-default-disabled-background: var(--bg-inset);
    --provider-button-default-disabled-border: var(--border-muted);
    --provider-button-default-disabled-color: var(--text-muted);
  }

  :global(.kit-button.kit-button--outline.kit-provider-button:hover:not(:disabled)) {
    background: var(
      --provider-button-hover-background,
      var(--provider-button-default-hover-background)
    );
    color: var(
      --provider-button-hover-color,
      var(--provider-button-color, var(--provider-button-default-hover-color))
    );
  }

  :global(.kit-button.kit-provider-button:disabled) {
    opacity: 1;
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
</style>
