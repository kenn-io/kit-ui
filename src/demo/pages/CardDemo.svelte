<script lang="ts">
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import { Button, Card, Chip, IconButton } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let clicks = $state(0);
  let plan = $state("pro");
</script>

<DemoSection
  title="Hierarchy levels"
  description="Three levels of surface emphasis: inset wells sit inside other surfaces, default carries lists and timeline cards, raised is the page-level panel. All three re-theme under every pluggable theme."
  code={`<Card level="inset">…</Card>
<Card level="default">…</Card>
<Card level="raised">…</Card>`}
>
  <div class="grid">
    <Card level="inset" title="Inset" meta="level 1">
      A recessed well: grouped settings, quoted context, code insets.
    </Card>
    <Card level="default" title="Default" meta="level 2">
      The everyday card: list tiles, timeline comments, option groups.
    </Card>
    <Card level="raised" title="Raised" meta="level 3">
      The page-level panel: summary cards, dashboards, standalone sections.
    </Card>
  </div>
</DemoSection>

<DemoSection
  title="Header anatomy"
  description="Structured header: toned eyebrow, title, right-aligned meta, and an actions snippet. The footer is divided by a muted rule."
  code={`<Card
  level="raised"
  eyebrow="review"
  eyebrowTone="merged"
  title="marius"
  meta="2h ago"
>
  {#snippet actions()}<IconButton ariaLabel="Edit">…</IconButton>{/snippet}
  Body content…
  {#snippet footer()}<Button size="sm" label="Reply" />{/snippet}
</Card>`}
>
  <Card level="raised" eyebrow="review" eyebrowTone="merged" title="marius" meta="2h ago">
    {#snippet actions()}
      <IconButton ariaLabel="Edit comment" size="sm">
        <PencilIcon size="13" aria-hidden="true" />
      </IconButton>
    {/snippet}
    Requested changes: the retry loop needs jitter, otherwise every client reconnects on the same tick.
    {#snippet footer()}
      <div class="footer-row">
        <Chip tone="danger" size="xs">changes requested</Chip>
        <Button size="sm" surface="soft" tone="info" label="Reply" />
      </div>
    {/snippet}
  </Card>
</DemoSection>

<DemoSection
  title="Clickable"
  description="href renders an anchor, onclick renders a button; both get the accent hover and the shared focus ring."
  code={`<Card level="default" title="Open session" onclick={...} />
<Card level="default" title="Docs" href="https://example.com" />`}
>
  <div class="grid">
    <Card
      level="default"
      title="Launch workspace"
      meta={`${clicks} clicks`}
      onclick={() => (clicks += 1)}
    >
      A button card: whole surface is the hit target.
    </Card>
    <Card level="default" title="Theming guide" meta="docs" href="#theme">
      An anchor card: navigates like a link.
    </Card>
  </div>
</DemoSection>

<DemoSection
  title="Choice cards"
  description="selected marks the active card in a set — aria-pressed plus the accent border and tint. The demo gallery's theme picker is built from these."
  code={`<Card level="default" selected={plan === "pro"} onclick={() => (plan = "pro")} … />`}
>
  <div class="grid" role="group" aria-label="Plan">
    {#each [{ id: "free", label: "Free", blurb: "One workspace, community support." }, { id: "pro", label: "Pro", blurb: "Unlimited workspaces, priority queue." }, { id: "team", label: "Team", blurb: "Shared sessions and audit log." }] as p (p.id)}
      <Card level="default" title={p.label} selected={plan === p.id} onclick={() => (plan = p.id)}>
        {p.blurb}
      </Card>
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Nesting"
  description="The levels compose: an inset well inside a raised panel reads as hierarchy, not decoration."
>
  <Card level="raised" title="Run summary" meta="3m 42s">
    Checks passed on the third attempt after two flaky retries.
    <Card level="inset" padding="sm">
      <code class="mono">bun test — 153 pass, 0 fail (86ms)</code>
    </Card>
  </Card>
</DemoSection>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-5);
    width: 100%;
  }

  .footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
</style>
