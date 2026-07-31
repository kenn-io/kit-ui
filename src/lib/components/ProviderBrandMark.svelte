<script lang="ts">
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import googleMark from "../assets/google-sign-in-mark.svg?inline";
  import type { ProviderBrand } from "./provider-brand.js";

  interface Props {
    provider: ProviderBrand;
    iconUrl?: string;
    label?: string;
    size?: number;
    class?: string;
  }

  let {
    provider,
    iconUrl = undefined,
    label = undefined,
    size = 20,
    class: className = "",
  }: Props = $props();

  let failedUrl = $state<string>();
  const hasLabel = $derived(label !== undefined && label !== "");
  const customImage = $derived(
    provider === "sso" && iconUrl !== undefined && iconUrl !== "" && failedUrl !== iconUrl,
  );
  const classes = $derived(["kit-provider-brand-mark", className].filter(Boolean).join(" "));
</script>

<span
  class={classes}
  style:--provider-brand-mark-size={`${size}px`}
  role={hasLabel ? "img" : undefined}
  aria-label={hasLabel ? label : undefined}
  aria-hidden={hasLabel ? undefined : true}
>
  {#if provider === "google"}
    <img src={googleMark} alt="" aria-hidden="true" />
  {:else if customImage}
    <img src={iconUrl} alt="" aria-hidden="true" onerror={() => (failedUrl = iconUrl)} />
  {:else}
    <KeyRoundIcon {size} strokeWidth="1.75" aria-hidden="true" />
  {/if}
</span>

<style>
  .kit-provider-brand-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 var(--provider-brand-mark-size);
    width: var(--provider-brand-mark-size);
    height: var(--provider-brand-mark-size);
    color: var(--text-secondary);
    background: transparent;
    opacity: 1;
  }

  .kit-provider-brand-mark img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
