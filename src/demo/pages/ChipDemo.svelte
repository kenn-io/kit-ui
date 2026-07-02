<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import { Chip } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let stateOpen = $state(false);

  const tones = [
    "muted",
    "neutral",
    "success",
    "warning",
    "danger",
    "info",
    "merged",
    "canceled",
    "workspace",
  ] as const;
</script>

<DemoSection
  title="Tones"
  description="Small status labels. Each tone maps to a theme accent."
  code={`<Chip tone="success">Open</Chip>
<Chip tone="merged">Merged</Chip>
<Chip tone="warning">Draft</Chip>`}
>
  {#each tones as tone (tone)}
    <Chip {tone}>{tone}</Chip>
  {/each}
</DemoSection>

<DemoSection
  title="Sizes and dot"
  code={`<Chip tone="info" size="xs">xs</Chip>
<Chip tone="info" size="sm">sm</Chip>
<Chip tone="info" size="md">md</Chip>
<Chip tone="success" dot>Running</Chip>`}
>
  <Chip tone="info" size="xs">xs</Chip>
  <Chip tone="info" size="sm">sm</Chip>
  <Chip tone="info" size="md">md</Chip>
  <Chip tone="success" dot>Running</Chip>
</DemoSection>

<DemoSection
  title="Interactive"
  description="Set interactive to render a button element. Pairs with expanded for popover triggers."
  code={`<Chip tone="info" interactive onclick={toggle}>Filter: open</Chip>
<Chip tone="muted" interactive disabled>Disabled</Chip>
<Chip tone="neutral" uppercase={false}>Plain case</Chip>`}
>
  <Chip tone="info" interactive onclick={() => {}}>Filter: open</Chip>
  <Chip tone="muted" interactive disabled>Disabled</Chip>
  <Chip tone="neutral" uppercase={false}>Plain case</Chip>
</DemoSection>

<DemoSection
  title="Icons"
  description="Icons inside the label center against the text. For dropdown indicators use the trailing snippet — it sits outside the label, so it centers exactly and stays visible when the label truncates."
  code={`<Chip tone="warning">
  <TriangleAlertIcon size={12} aria-hidden="true" /> Attention
</Chip>
<Chip tone="danger" interactive expanded={open} onclick={toggle}>
  Changes requested
  {#snippet trailing()}<ChevronDownIcon size={12} aria-hidden="true" />{/snippet}
</Chip>`}
>
  <Chip tone="warning" dataTestid="chip-label-icon">
    <TriangleAlertIcon size={12} aria-hidden="true" /> Attention
  </Chip>
  <Chip tone="success" size="sm" dataTestid="chip-label-icon-sm">
    <CheckIcon size={12} aria-hidden="true" /> Approved
  </Chip>
  <Chip
    tone="danger"
    interactive
    expanded={stateOpen}
    onclick={() => (stateOpen = !stateOpen)}
    dataTestid="chip-trailing"
  >
    Changes requested
    {#snippet trailing()}<ChevronDownIcon size={12} aria-hidden="true" />{/snippet}
  </Chip>
  <Chip
    tone="merged"
    style="max-width: 132px"
    title="Very long label that truncates"
    dataTestid="chip-truncated"
  >
    Very long label that truncates
    {#snippet trailing()}<ChevronDownIcon size={12} aria-hidden="true" />{/snippet}
  </Chip>
</DemoSection>
