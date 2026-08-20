<script lang="ts">
  import { Chip, StructuredList, StructuredListRow } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const targets = [
    {
      name: "Package registry",
      identity: "example-project",
      description: "1.4.2 is current",
      state: "Current",
      tone: "success",
      detail: "Last checked 2 minutes ago",
    },
    {
      name: "Archive mirror",
      identity: "stable/example-project",
      description: "Publishing 1.4.2",
      state: "Publishing",
      tone: "neutral",
      detail: "The mirror is inside its expected settlement window.",
    },
    {
      name: "System package",
      identity: "formula:example-project",
      description: "1.4.1 is one release behind",
      state: "Behind",
      tone: "danger",
      detail: "The upstream package declaration still points to 1.4.1.",
    },
  ] as const;
</script>

<DemoSection
  title="Expandable status rows"
  description="A compact, aligned list for structured records. Rows can reveal supporting evidence without turning the collapsed view into a wall of text."
  code={`<StructuredList ariaLabel="Publishing targets" primaryLabel="Target" …>
  <StructuredListRow {primary} {secondary} {description} {status} {detail} />
</StructuredList>`}
>
  <div class="demo-list">
    <StructuredList
      ariaLabel="Publishing targets"
      primaryLabel="Target"
      secondaryLabel="Identity"
      descriptionLabel="Observation"
      statusLabel="Status"
    >
      {#each targets as target (target.name)}
        <StructuredListRow ariaLabel={`Show details for ${target.name}`}>
          {#snippet primary()}{target.name}{/snippet}
          {#snippet secondary()}<code>{target.identity}</code>{/snippet}
          {#snippet description()}{target.description}{/snippet}
          {#snippet status()}
            <Chip size="sm" tone={target.tone} uppercase={false}>{target.state}</Chip>
          {/snippet}
          {#snippet detail()}<p>{target.detail}</p>{/snippet}
        </StructuredListRow>
      {/each}
    </StructuredList>
  </div>
</DemoSection>

<style>
  .demo-list {
    width: 100%;
  }

  code {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
  }

  p {
    margin: 0;
  }
</style>
