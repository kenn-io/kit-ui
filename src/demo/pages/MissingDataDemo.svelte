<script lang="ts">
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import PinIcon from "@lucide/svelte/icons/pin";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import ServerOffIcon from "@lucide/svelte/icons/server-off";
  import { Button, MissingData, PageHeader, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Nothing saved yet"
  description="The state for a page or panel with nothing to show. No frame or fill, so it never reads as an alert; it sits a fixed step below the page header, so every page shows it in the same place. Title in primary ink, the explanation in muted ink, the icon at 24px."
  code={`<PageHeader title="Pinned" />
<MissingData
  title="No pinned messages"
  description="Pin a message in any session to keep it here."
>
  {#snippet icon()}<PinIcon size="24" aria-hidden="true" />{/snippet}
</MissingData>`}
>
  <div class="page-frame" data-testid="missing-data-pinned">
    <PageHeader title="Pinned" />
    <MissingData
      title="No pinned messages"
      description="Pin a message in any session to keep it here, so you can find it again without searching."
    >
      {#snippet icon()}
        <PinIcon size="24" aria-hidden="true" />
      {/snippet}
    </MissingData>
  </div>
</DemoSection>

<DemoSection
  title="With an action"
  description="The action snippet holds the controls that fill the gap, such as Build now or Retry."
  code={`<MissingData
  title="Setup needed"
  description="Prepare past sessions for search by meaning."
>
  {#snippet icon()}<BookOpenIcon size="24" aria-hidden="true" />{/snippet}
  {#snippet action()}
    <Button label="Build now" surface="solid" tone="info" onclick={build} />
  {/snippet}
</MissingData>`}
>
  <div class="page-frame">
    <PageHeader title="Recall" />
    <MissingData title="Setup needed" description="Prepare past sessions for search by meaning.">
      {#snippet icon()}
        <BookOpenIcon size="24" aria-hidden="true" />
      {/snippet}
      {#snippet action()}
        <Button
          label="Build now"
          surface="solid"
          tone="info"
          onclick={() => showFlash("Would prepare search")}
        />
      {/snippet}
    </MissingData>
  </div>
</DemoSection>

<DemoSection
  title="Unavailable and filtered out"
  description="The same state covers a feature this server does not offer and a filter that matches nothing. Use role=&quot;status&quot; when it replaces content that was loading, so screen readers announce it."
  code={`<MissingData role="status" title="No matches" description="Try a broader filter." />`}
>
  <div class="pair">
    <div class="page-frame">
      <MissingData
        title="Trash is not available"
        description="This server does not keep deleted sessions."
      >
        {#snippet icon()}
          <ServerOffIcon size="24" aria-hidden="true" />
        {/snippet}
      </MissingData>
    </div>
    <div class="page-frame">
      <MissingData role="status" title="No matches" description="Try a broader filter.">
        {#snippet icon()}
          <SearchXIcon size="24" aria-hidden="true" />
        {/snippet}
      </MissingData>
    </div>
  </div>
</DemoSection>

<style>
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
