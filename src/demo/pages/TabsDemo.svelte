<script lang="ts">
  import FileIcon from "@lucide/svelte/icons/file";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import { Tabs, type TabItem } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const detailTabs: TabItem[] = [
    { id: "conversation", label: "Conversation", count: 4 },
    { id: "commits", label: "Commits", count: 12 },
    { id: "files", label: "Files changed", count: 38 },
    { id: "checks", label: "Checks", disabled: true },
  ];
  let detail = $state("conversation");
  let changes = $state(0);

  const viewTabs: TabItem[] = [
    { id: "chat", label: "Chat" },
    { id: "files", label: "Files" },
  ];
  let view = $state("chat");

  let manual = $state("conversation");

  const panels: Record<string, string> = {
    conversation: "Ana: The retry loop now backs off after the third failure.",
    commits: "Back off after repeated failures",
    files: "src/sync/retry.ts  +42 −7",
  };
</script>

<DemoSection
  title="With a panel"
  description="Arrow keys select enabled tabs; Home and End jump to the first and last. The children snippet supplies the panel, labelled by the selected tab."
  code={`<Tabs tabs={tabs} bind:value ariaLabel="Pull request detail">
  {#snippet children(id)}
    {#if id === "files"}<FileList />{:else}<Conversation />{/if}
  {/snippet}
</Tabs>`}
>
  <div class="tabs-demo" data-testid="tabs-detail">
    <Tabs
      tabs={detailTabs}
      bind:value={detail}
      onchange={() => (changes += 1)}
      ariaLabel="Pull request detail"
    >
      {#snippet children(id)}
        <p class="tabs-demo__panel">{panels[id]}</p>
      {/snippet}
    </Tabs>
    <p class="tabs-demo__readout">
      Selection changes: <span data-testid="tabs-changes">{changes}</span>
    </p>
    <span class="tabs-demo__hidden" data-testid="tabs-value">{detail}</span>
  </div>
</DemoSection>

<DemoSection
  title="Icon-only tabs"
  description="The tab snippet renders custom content, such as an icon, in place of the label. The label stays the accessible name."
  code={`<Tabs {tabs} bind:value ariaLabel="Workspace view">
  {#snippet tab(item)}<Icon id={item.id} />{/snippet}
</Tabs>`}
>
  <div class="tabs-demo" data-testid="tabs-icons">
    <Tabs tabs={viewTabs} bind:value={view} ariaLabel="Workspace view">
      {#snippet tab(item)}
        {#if item.id === "chat"}<MessageSquareIcon size={16} />{:else}<FileIcon size={16} />{/if}
      {/snippet}
    </Tabs>
  </div>
</DemoSection>

<DemoSection
  title="Manual activation"
  description="With activation=&quot;manual&quot;, arrow keys only move focus; Enter or Space selects. Use it when showing a panel is slow. Without a children snippet, Tabs renders the tab list alone."
  code={`<Tabs {tabs} bind:value activation="manual" ariaLabel="Detail" />`}
>
  <div class="tabs-demo" data-testid="tabs-manual">
    <Tabs tabs={detailTabs} bind:value={manual} activation="manual" ariaLabel="Detail (manual)" />
    <span class="tabs-demo__hidden" data-testid="tabs-manual-value">{manual}</span>
  </div>
</DemoSection>

<style>
  .tabs-demo {
    display: grid;
    gap: var(--space-3);
    width: min(100%, 640px);
  }

  .tabs-demo p {
    margin: 0;
  }

  .tabs-demo__panel {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .tabs-demo__hidden {
    display: none;
  }

  .tabs-demo__readout {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }
</style>
