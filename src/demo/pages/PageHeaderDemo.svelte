<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { Button, Chip, Table, TableHeaderCell, showFlash } from "../../lib/index.js";
  import PageHeader from "../../lib/components/PageHeader.svelte";
  import DemoSection from "../DemoSection.svelte";

  const releases = [
    { version: "2.4.0", channel: "Stable", published: "Mar 3" },
    { version: "2.5.0-rc.1", channel: "Preview", published: "Mar 9" },
  ];

  let stepTitle = $state<HTMLHeadingElement>();
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

<DemoSection
  title="Status beside the title"
  description="The trailing snippet sits on the title's line, for a status chip or label. Use a smaller size for a record page whose title shares its row with details."
  code={`<PageHeader title="build-host-a" size="medium">
  {#snippet trailing()}<Chip tone="success">Online</Chip>{/snippet}
  {#snippet actions()}<Button label="Restart" size="sm" surface="soft" />{/snippet}
</PageHeader>`}
>
  <div class="page-host" data-testid="page-with-status">
    <PageHeader
      title="build-host-a"
      size="medium"
      description="Linux arm64, last seen 2 minutes ago."
    >
      {#snippet trailing()}
        <Chip tone="success" uppercase={false}>Online</Chip>
      {/snippet}
      {#snippet actions()}
        <Button
          label="Restart"
          size="sm"
          surface="soft"
          onclick={() => showFlash("Would restart the host")}
        />
      {/snippet}
    </PageHeader>
  </div>
</DemoSection>

<DemoSection
  title="Title with markup"
  description="Pass title or description as a snippet when the text needs inline code, a monospace ID, or a field. Keep a snippet title to phrasing content; the heading element stays the component's."
  code={`<PageHeader>
  {#snippet title()}Run <code>a1b2c3d</code>{/snippet}
  {#snippet description()}Started by <code>release.yml</code> on main.{/snippet}
</PageHeader>`}
>
  <div class="page-host" data-testid="page-with-markup">
    <PageHeader>
      {#snippet title()}Run <code>a1b2c3d</code>{/snippet}
      {#snippet description()}Started by <code>release.yml</code> on main.{/snippet}
    </PageHeader>
  </div>
</DemoSection>

<DemoSection
  title="Moving focus to the title"
  description="Set focusable and bind titleElement to move keyboard focus to the title after a step or view change, so a screen reader announces the new view."
  code={`<PageHeader title="Choose repositories" focusable bind:titleElement={heading} />
<Button label="Next step" onclick={() => heading?.focus()} />`}
>
  <div class="page-host" data-testid="page-with-focus">
    <PageHeader title="Choose repositories" focusable bind:titleElement={stepTitle} />
    <div>
      <Button label="Next step" surface="soft" onclick={() => stepTitle?.focus()} />
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Sizes"
  description="Size is separate from the heading level. Large is the page title; medium and small suit record pages and panes."
  code={`<PageHeader title="Large" />
<PageHeader title="Medium" size="medium" />
<PageHeader title="Small" size="small" />`}
>
  <div class="page-host" data-testid="page-sizes">
    <PageHeader title="Large" />
    <PageHeader level={2} title="Medium" size="medium" />
    <PageHeader level={3} title="Small" size="small" />
  </div>
</DemoSection>

<style>
  .page-host {
    display: grid;
    flex: 1 1 auto;
    gap: var(--space-7);
    min-width: 0;
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
