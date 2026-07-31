<script lang="ts">
  import { ProviderBrandMark, ProviderButton } from "../../lib/index.js";
  import enterpriseMark from "../assets/enterprise-provider-mark.svg";
  import DemoSection from "../DemoSection.svelte";

  let activations = $state(0);
</script>

<DemoSection
  title="Provider marks"
  description="Official Google identity, caller-provided enterprise artwork, and a neutral fallback without generated letter logos."
  code={`<ProviderBrandMark provider="google" label="Google" />
<ProviderBrandMark provider="sso" iconUrl={configuredIconUrl} label="Enterprise SSO" />
<ProviderBrandMark provider="sso" label="SSO" />`}
>
  <ProviderBrandMark provider="google" iconUrl="/ignored-provider.svg" label="Google" />
  <ProviderBrandMark provider="sso" iconUrl={enterpriseMark} label="Enterprise SSO" />
  <ProviderBrandMark provider="sso" label="Neutral SSO" />
  <span data-demo="decorative-provider-mark">
    <ProviderBrandMark provider="google" />
  </span>
</DemoSection>

<DemoSection
  title="Provider buttons"
  description="Provider actions use the large kit button geometry and type. Google keeps one coherent white surface, and callers can restyle the full control through public CSS variables."
  code={`<ProviderButton provider="google" label="Continue with Google" onclick={continueWithGoogle} />
<ProviderButton provider="sso" label="Continue with Enterprise SSO" iconUrl={configuredIconUrl} />`}
>
  <ProviderButton
    provider="google"
    label="Continue with Google"
    onclick={() => (activations += 1)}
  />
  <ProviderButton provider="google" label="Unavailable Google" disabled />
  <ProviderButton provider="sso" label="Continue with Enterprise SSO" iconUrl={enterpriseMark} />
  <ProviderButton provider="sso" label="Continue with SSO" iconUrl="/missing-provider.svg" />
  <ProviderButton provider="sso" label="Styled provider" class="provider-demo__custom" />
  <ProviderButton
    provider="sso"
    label="Styled unavailable provider"
    class="provider-demo__custom"
    disabled
  />
  <span>activations: <code data-demo="provider-activations">{activations}</code></span>
</DemoSection>

<style>
  :global(.provider-demo__custom) {
    --provider-button-background: var(--bg-surface);
    --provider-button-border: var(--accent-teal);
    --provider-button-color: var(--accent-blue);
    --provider-button-hover-background: var(--bg-surface-hover);
    --provider-button-disabled-background: var(--bg-primary);
    --provider-button-disabled-border: var(--border-muted);
    --provider-button-disabled-color: var(--text-muted);
  }
</style>
