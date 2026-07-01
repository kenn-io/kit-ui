<script lang="ts">
  import StatusBar from "../../lib/components/StatusBar.svelte";
  import DemoSection from "../DemoSection.svelte";

  let synced = $state(true);
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
</style>
