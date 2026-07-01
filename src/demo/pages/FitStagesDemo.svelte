<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import { Button, FitStages, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let paneWidth = $state(880);
  let paneStage = $state(0);

  const stageNames = ["full labels", "short labels", "icons only"];

  function act(what: string): void {
    showFlash(what);
  }
</script>

{#snippet fullActions()}
  <div class="actions">
    <Button tone="success" label="Approve" onclick={() => act("Approved")}>
      <CheckIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button label="Request changes" onclick={() => act("Changes requested")}>
      <MessageSquareIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button label="Copy branch name" onclick={() => act("Copied")}>
      <CopyIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button tone="info" surface="solid" label="Merge pull request" onclick={() => act("Merged")}>
      <GitMergeIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
  </div>
{/snippet}

{#snippet shortActions()}
  <div class="actions">
    <Button tone="success" label="Approve" onclick={() => act("Approved")}>
      <CheckIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button label="Changes" title="Request changes" onclick={() => act("Changes requested")}>
      <MessageSquareIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button label="Copy" title="Copy branch name" onclick={() => act("Copied")}>
      <CopyIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button tone="info" surface="solid" label="Merge" onclick={() => act("Merged")}>
      <GitMergeIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
  </div>
{/snippet}

{#snippet iconActions()}
  <div class="actions">
    <Button tone="success" title="Approve" ariaLabel="Approve" onclick={() => act("Approved")}>
      <CheckIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button title="Request changes" ariaLabel="Request changes" onclick={() => act("Changes requested")}>
      <MessageSquareIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button title="Copy branch name" ariaLabel="Copy branch name" onclick={() => act("Copied")}>
      <CopyIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
    <Button tone="info" surface="solid" title="Merge pull request" ariaLabel="Merge pull request" onclick={() => act("Merged")}>
      <GitMergeIcon size="13" strokeWidth="2.2" aria-hidden="true" />
    </Button>
  </div>
{/snippet}

<DemoSection
  title="PR action pane: three stages by measurement"
  description="Every stage renders as a hidden probe, so the visible one is always the richest that fits — no breakpoints, no oscillation (probes never change with the active stage). Drag the slider."
  code={`<FitStages bind:stage stages={[fullActions, shortActions, iconActions]} />

{#snippet fullActions()}
  <Button tone="success" label="Approve"><CheckIcon /></Button>
  <Button label="Request changes"><MessageSquareIcon /></Button>
  …
{/snippet}
{#snippet iconActions()}
  <Button tone="success" ariaLabel="Approve" title="Approve"><CheckIcon /></Button>
  …
{/snippet}`}
>
  <div class="controls">
    <label class="control">
      Width {paneWidth}px
      <input type="range" min="330" max="920" bind:value={paneWidth} />
    </label>
    <span class="control-note">stage: <code>{paneStage}</code> ({stageNames[paneStage]})</span>
  </div>
  <div class="pane" style:width="{paneWidth}px">
    <div class="pane__meta">
      <span class="pane__title">Add FitStages primitive</span>
      <span class="pane__branch">feature/fit-stages → main</span>
    </div>
    <FitStages
      bind:stage={paneStage}
      stages={[fullActions, shortActions, iconActions]}
    />
  </div>
</DemoSection>

<DemoSection
  title="Where to reach for it"
  description="TopBar composes with FitStages for its search slot (see the TopBar page's agentsview example) — TopBar owns the tabs-into-dropdown breakpoint, FitStages owns the search field-into-icon one. Any toolbar/button pane that gets squeezed by a resizable sidebar or drawer is a candidate."
  code={`/* The host must get its width from the container, not its content: */
.toolbar :global(.kit-fit-stages) { flex: 1 1 0; min-width: 0; }`}
>
  <p class="note">
    Stages are ordered richest → most compact; the last stage is the
    unconditional fallback. Flexible stage content (e.g. a full-width input)
    should declare its floor with <code>min-width</code> — that's what the
    probe measures.
  </p>
</DemoSection>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
    width: 100%;
  }

  .control {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .control input[type="range"] {
    width: 220px;
  }

  .control-note {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .pane {
    box-sizing: border-box;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
  }

  .pane__meta {
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    min-width: 70px;
  }

  .pane__title {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pane__branch {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* The host takes all remaining pane width (flex-basis 0, NOT auto) so its
   * measured width never depends on which stage is showing. */
  .pane :global(.kit-fit-stages) {
    flex: 1 1 0;
    min-width: 0;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    white-space: nowrap;
  }

  .note {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    max-width: 60ch;
  }
</style>
