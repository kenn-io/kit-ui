<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { Button, Chip, Table, TableHeaderCell, showFlash } from "../../lib/index.js";
  import PageHeader from "../../lib/components/PageHeader.svelte";
  import DemoSection from "../DemoSection.svelte";

  const releases = [
    { version: "2.4.0", channel: "Stable", published: "Mar 3" },
    { version: "2.5.0-rc.1", channel: "Preview", published: "Mar 9" },
  ];
</script>

<DemoSection
  title="Page with a table"
  description="The header draws no line under itself. A table or panel that follows supplies the only edge, so the two never stack into a doubled border."
  code={`<PageHeader title="Releases" description="Published builds by channel.">
  {#snippet actions()}<Button label="New release" surface="solid" tone="info" />{/snippet}
</PageHeader>
<Table ariaLabel="Releases">…</Table>`}
>
  <div class="page-host" data-testid="page-with-table">
    <PageHeader title="Releases" description="Published builds by channel.">
      {#snippet actions()}
        <Button
          label="New release"
          surface="solid"
          tone="info"
          onclick={() => showFlash("Would start a release")}
        />
      {/snippet}
    </PageHeader>
    <Table ariaLabel="Releases" unsorted>
      {#snippet header()}
        <TableHeaderCell label="Version" />
        <TableHeaderCell label="Channel" />
        <TableHeaderCell label="Published" />
      {/snippet}
      {#each releases as release (release.version)}
        <tr>
          <td>{release.version}</td>
          <td><Chip size="sm" uppercase={false}>{release.channel}</Chip></td>
          <td>{release.published}</td>
        </tr>
      {/each}
    </Table>
  </div>
</DemoSection>

<DemoSection
  title="Back link and status"
  description="The before snippet sits above the title, for a back link or breadcrumbs. Actions hold controls or a status line; on narrow screens they wrap under the title."
  code={`<PageHeader title="Release 2.4.0">
  {#snippet before()}<a href="/releases"><ArrowLeftIcon size={14} />Releases</a>{/snippet}
  {#snippet actions()}<span>Updated 5 minutes ago</span>{/snippet}
</PageHeader>`}
>
  <div class="page-host" data-testid="page-with-back-link">
    <PageHeader title="Release 2.4.0">
      {#snippet before()}
        <a class="back-link" href="#page-header"
          ><ArrowLeftIcon size={14} aria-hidden="true" />Releases</a
        >
      {/snippet}
      {#snippet actions()}
        <span>Updated 5 minutes ago</span>
      {/snippet}
    </PageHeader>
  </div>
</DemoSection>

<DemoSection
  title="Inside a pane"
  description="Set level to 2 or 3 when the header titles a pane on a page that already has an h1."
  code={`<PageHeader level={2} title="Settings" description="Applies to this workspace." />`}
>
  <div class="page-host" data-testid="pane-header">
    <PageHeader level={2} title="Settings" description="Applies to this workspace." />
  </div>
</DemoSection>

<style>
  .page-host {
    display: grid;
    gap: var(--space-7);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: inherit;
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--text-primary);
  }
</style>
