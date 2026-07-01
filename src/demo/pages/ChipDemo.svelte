<script lang="ts">
  import { Chip } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

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
