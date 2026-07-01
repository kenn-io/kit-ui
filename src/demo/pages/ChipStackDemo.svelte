<script lang="ts">
  import { Button, Chip, ChipStack, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const labels = [
    { name: "bug", tone: "danger" },
    { name: "frontend", tone: "info" },
    { name: "backend", tone: "merged" },
    { name: "needs-triage", tone: "warning" },
    { name: "good-first-issue", tone: "success" },
    { name: "docs", tone: "neutral" },
    { name: "perf", tone: "workspace" },
    { name: "blocked", tone: "danger" },
  ] as const;

  let expanded = $state(false);

  const actions = [
    { label: "Approve", tone: "success" },
    { label: "Comment", tone: "neutral" },
    { label: "Request changes", tone: "danger" },
    { label: "Merge", tone: "success" },
    { label: "Rebase", tone: "neutral" },
    { label: "Close", tone: "danger" },
  ] as const;
</script>

<DemoSection
  title="Collapsing chip row"
  description="Renders items through a snippet; anything past maxVisible collapses behind a +N chip that toggles expansion. This formalizes the ad-hoc slice(0, n) truncation middleman's compact label rows and mobile views do — but reversible."
  code={`<ChipStack items={labels} maxVisible={4} key={(l) => l.name} ariaLabel="Labels">
  {#snippet chip(label)}
    <Chip tone={label.tone} size="sm">{label.name}</Chip>
  {/snippet}
</ChipStack>`}
>
  <ChipStack items={[...labels]} maxVisible={4} key={(l) => l.name} size="sm" ariaLabel="Labels">
    {#snippet chip(label)}
      <Chip tone={label.tone} size="sm">{label.name}</Chip>
    {/snippet}
  </ChipStack>
</DemoSection>

<DemoSection
  title="Button group with overflow"
  description="The item snippet renders whatever fits a row — small buttons work too. bind:expanded lets a panel react to (or drive) the expansion."
  code={`<ChipStack items={actions} maxVisible={3} bind:expanded key={(a) => a.label} gap={3}>
  {#snippet chip(action)}
    <Button size="sm" tone={action.tone} surface="soft" label={action.label} onclick={run} />
  {/snippet}
</ChipStack>`}
>
  <div class="stack-host">
    <ChipStack
      items={[...actions]}
      maxVisible={3}
      bind:expanded
      key={(a) => a.label}
      gap={3}
      ariaLabel="PR actions"
    >
      {#snippet chip(action)}
        <Button
          size="sm"
          tone={action.tone}
          surface="soft"
          label={action.label}
          onclick={() => showFlash(action.label)}
        />
      {/snippet}
    </ChipStack>
    <span>expanded: <code>{expanded}</code></span>
  </div>
</DemoSection>

<DemoSection
  title="Custom overflow labels"
  code={`<ChipStack items={labels} maxVisible={2}
  moreLabel={(n) => \`+\${n} labels\`} lessLabel="collapse" … />`}
>
  <ChipStack
    items={[...labels]}
    maxVisible={2}
    key={(l) => l.name}
    size="sm"
    moreLabel={(n) => `+${n} labels`}
    lessLabel="collapse"
  >
    {#snippet chip(label)}
      <Chip tone={label.tone} size="sm">{label.name}</Chip>
    {/snippet}
  </ChipStack>
</DemoSection>

<style>
  .stack-host {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    flex-wrap: wrap;
  }
</style>
