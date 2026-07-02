<script lang="ts">
  import StatusBar from "../../lib/components/StatusBar.svelte";
  import { dismissable } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let synced = $state(true);
  let budgetOpen = $state(false);
  let budgetAnchor = $state<HTMLElement>();
  let budgetTrigger = $state<HTMLButtonElement>();

  $effect(() => {
    if (!budgetOpen) return;
    return dismissable({
      owners: () => [budgetAnchor],
      dismiss: () => (budgetOpen = false),
      escapeFocus: () => budgetTrigger,
    });
  });
</script>

<DemoSection
  title="Left and right regions"
  description="Fixed-height bottom bar (var(--status-bar-height)) with a top border and muted 2xs text. Content comes in via left/center/right snippets; separators and colors are up to the app."
  code={`<StatusBar>
  {#snippet left()}
    <span>12 PRs</span><span class="sep">·</span><span>4 issues</span>
  {/snippet}
  {#snippet right()}
    <span class="ok">synced 2m ago</span><span class="sep">·</span><span>v1.4.2</span>
  {/snippet}
</StatusBar>`}
>
  <div class="bar-host">
    <div class="fake-app">app content</div>
    <StatusBar>
      {#snippet left()}
        <span>12 PRs</span>
        <span class="sep">&middot;</span>
        <span>4 issues</span>
        <span class="sep">&middot;</span>
        <span>3 repos</span>
      {/snippet}
      {#snippet right()}
        <button class="bar-btn" type="button" onclick={() => (synced = !synced)}>
          {synced ? "synced 2m ago" : "sync now"}
        </button>
        <span class="sep">&middot;</span>
        <span class="mono">v1.4.2</span>
      {/snippet}
    </StatusBar>
  </div>
</DemoSection>

<DemoSection
  title="With a center region"
  description="The optional center snippet stays centered; left and right flex around it."
  code={`<StatusBar>
  {#snippet left()}…{/snippet}
  {#snippet center()}<span>3,412 sessions</span>{/snippet}
  {#snippet right()}…{/snippet}
</StatusBar>`}
>
  <div class="bar-host bar-host--short">
    <StatusBar>
      {#snippet left()}
        <span>main</span>
      {/snippet}
      {#snippet center()}
        <span class="ok">3,412 sessions indexed</span>
      {/snippet}
      {#snippet right()}
        <span>UTF-8</span>
      {/snippet}
    </StatusBar>
  </div>
</DemoSection>

<DemoSection
  title="Anchored popover"
  description="Sections clip their content by default (long text truncates inside the 24px bar), which also clips popovers. Set the overflow prop to visible and anchor the popover in a position:relative wrapper — bottom-anchored, dressed with kit-popover-card, dismissed via the dismissable util."
  code={`<StatusBar overflow="visible">
  {#snippet right()}
    <span class="anchor" bind:this={anchorEl}>
      <button onclick={() => (open = !open)} aria-haspopup="dialog" aria-expanded={open}>
        api budget
      </button>
      {#if open}
        <div class="popover kit-popover-card" role="dialog" aria-label="API budget">…</div>
      {/if}
    </span>
  {/snippet}
</StatusBar>

/* .anchor { position: relative; }
   .popover { position: absolute; bottom: calc(100% + 4px); right: 0;
              z-index: var(--z-popover); } */`}
>
  <div class="bar-host bar-host--open">
    <div class="fake-app">app content</div>
    <StatusBar overflow="visible">
      {#snippet left()}
        <span>main</span>
      {/snippet}
      {#snippet right()}
        <span class="popover-anchor" bind:this={budgetAnchor}>
          <button
            class="bar-btn"
            type="button"
            bind:this={budgetTrigger}
            aria-haspopup="dialog"
            aria-expanded={budgetOpen}
            onclick={() => (budgetOpen = !budgetOpen)}
          >
            api budget · 64%
          </button>
          {#if budgetOpen}
            <div class="budget-popover kit-popover-card" role="dialog" aria-label="API budget">
              <div class="budget-popover__title">API budget</div>
              <div class="budget-popover__row">
                <span>REST</span>
                <span class="mono">3,210 / 5,000</span>
              </div>
              <div class="budget-popover__row">
                <span>GraphQL</span>
                <span class="mono">1,480 / 2,000</span>
              </div>
            </div>
          {/if}
        </span>
      {/snippet}
    </StatusBar>
  </div>
</DemoSection>

<style>
  .bar-host {
    width: 100%;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .fake-app {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 96px;
    background: var(--bg-primary);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .bar-host--short {
    justify-content: flex-end;
    height: 56px;
    background: var(--bg-primary);
  }

  .sep {
    color: var(--border-default);
  }

  .ok {
    color: var(--accent-green);
  }

  .mono {
    font-family: var(--font-mono);
  }

  .bar-btn {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .bar-btn:hover {
    color: var(--text-primary);
  }

  /* The popover host must not clip either — no overflow:hidden here. */
  .bar-host--open {
    overflow: visible;
  }

  .popover-anchor {
    position: relative;
    display: flex;
    align-items: center;
  }

  .budget-popover {
    position: absolute;
    bottom: calc(100% + var(--space-2));
    right: 0;
    z-index: var(--z-popover);
    width: 200px;
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    white-space: normal;
  }

  .budget-popover__title {
    color: var(--text-primary);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .budget-popover__row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }
</style>
