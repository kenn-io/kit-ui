<script lang="ts">
  import InboxIcon from "@lucide/svelte/icons/inbox";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import EmptyState from "../../lib/components/EmptyState.svelte";
  import { Button, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Icon, description, and actions"
  description="Centered muted placeholder for empty panes. The children snippet holds action buttons."
  code={`<EmptyState
  title="No sessions yet"
  description="Connect a repository to start tracking agent sessions."
>
  {#snippet icon()}<InboxIcon size="28" strokeWidth="1.5" />{/snippet}
  <Button label="Add repository" surface="solid" tone="info" onclick={add} />
</EmptyState>`}
>
  <div class="empty-host">
    <EmptyState
      title="No sessions yet"
      description="Connect a repository to start tracking agent sessions across your fleet."
    >
      {#snippet icon()}
        <InboxIcon size="28" strokeWidth="1.5" aria-hidden="true" />
      {/snippet}
      <Button
        label="Add repository"
        surface="solid"
        tone="info"
        onclick={() => showFlash("Would open the add-repo flow")}
      />
      <Button label="Import" onclick={() => showFlash("Would import")} />
    </EmptyState>
  </div>
</DemoSection>

<DemoSection
  title="Filter miss"
  description="Title-only (or title + description) variants for search and filter results."
  code={`<EmptyState title="No matches" description="Try a broader filter.">
  {#snippet icon()}<SearchXIcon size="24" strokeWidth="1.5" />{/snippet}
</EmptyState>`}
>
  <div class="empty-host empty-host--short">
    <EmptyState title="No matches" description="Try a broader filter.">
      {#snippet icon()}
        <SearchXIcon size="24" strokeWidth="1.5" aria-hidden="true" />
      {/snippet}
    </EmptyState>
  </div>
</DemoSection>

<DemoSection
  title="Title only"
  description="The minimal form."
  code={'<EmptyState title="Nothing selected" />'}
>
  <div class="empty-host empty-host--short">
    <EmptyState title="Nothing selected" />
  </div>
</DemoSection>

<style>
  .empty-host {
    display: flex;
    width: 100%;
    min-height: 220px;
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
  }

  .empty-host--short {
    min-height: 140px;
  }
</style>
