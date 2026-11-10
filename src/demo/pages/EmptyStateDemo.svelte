<script lang="ts">
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import InboxIcon from "@lucide/svelte/icons/inbox";
  import PinIcon from "@lucide/svelte/icons/pin";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import ServerOffIcon from "@lucide/svelte/icons/server-off";
  import { Button, EmptyState, PageHeader, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Centered in a pane"
  description="The default. It centers itself in a flex parent. Children render under the text as actions."
  code={`<EmptyState
  title="No sessions yet"
  description="Connect a repository to start tracking agent sessions."
>
  {#snippet icon()}<InboxIcon size="24" aria-hidden="true" />{/snippet}
  <Button label="Add repository" surface="solid" tone="info" onclick={add} />
</EmptyState>`}
>
  <div class="empty-host" data-testid="empty-state-centered">
    <EmptyState
      title="No sessions yet"
      description="Connect a repository to start tracking agent sessions across your fleet."
    >
      {#snippet icon()}
        <InboxIcon size="24" aria-hidden="true" />
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
  title="Under a page header"
  description="align=&quot;top&quot; sits 48px below the top of its container, so every empty page shows it in the same place."
  code={`<PageHeader title="Pinned" />
<EmptyState
  align="top"
  title="No pinned messages"
  description="Pin a message in any session to keep it here."
>
  {#snippet icon()}<PinIcon size="24" aria-hidden="true" />{/snippet}
</EmptyState>`}
>
  <div class="page-frame" data-testid="empty-state-page">
    <PageHeader title="Pinned" />
    <EmptyState
      align="top"
      title="No pinned messages"
      description="Pin a message in any session to keep it here, so you can find it again without searching."
    >
      {#snippet icon()}
        <PinIcon size="24" aria-hidden="true" />
      {/snippet}
    </EmptyState>
  </div>
</DemoSection>

<DemoSection
  title="Page with an action"
  code={`<EmptyState
  align="top"
  title="Setup needed"
  description="Prepare past sessions for search by meaning."
>
  {#snippet icon()}<BookOpenIcon size="24" aria-hidden="true" />{/snippet}
  <Button label="Build now" surface="solid" tone="info" onclick={build} />
</EmptyState>`}
>
  <div class="page-frame">
    <PageHeader title="Recall" />
    <EmptyState
      align="top"
      title="Setup needed"
      description="Prepare past sessions for search by meaning."
    >
      {#snippet icon()}
        <BookOpenIcon size="24" aria-hidden="true" />
      {/snippet}
      <Button
        label="Build now"
        surface="solid"
        tone="info"
        onclick={() => showFlash("Would prepare search")}
      />
    </EmptyState>
  </div>
</DemoSection>

<DemoSection
  title="Unavailable and filtered out"
  description="Use role=&quot;status&quot; when it replaces loading content, so screen readers announce the result."
  code={`<EmptyState role="status" title="No matches" description="Try a broader filter." />`}
>
  <div class="pair">
    <div class="empty-host empty-host--short">
      <EmptyState
        title="Trash is not available"
        description="This server does not keep deleted sessions."
      >
        {#snippet icon()}
          <ServerOffIcon size="24" aria-hidden="true" />
        {/snippet}
      </EmptyState>
    </div>
    <div class="empty-host empty-host--short">
      <EmptyState role="status" title="No matches" description="Try a broader filter.">
        {#snippet icon()}
          <SearchXIcon size="24" aria-hidden="true" />
        {/snippet}
      </EmptyState>
    </div>
  </div>
</DemoSection>

<DemoSection title="Title only" code={'<EmptyState title="Nothing selected" />'}>
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
    min-height: 160px;
  }

  .page-frame {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 240px;
    padding: var(--space-6);
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-6);
    width: 100%;
  }
</style>
