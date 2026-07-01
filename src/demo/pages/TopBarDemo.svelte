<script lang="ts">
  import MenuIcon from "@lucide/svelte/icons/menu";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import {
    KbdBadge,
    SelectDropdown,
    showFlash,
    TopBar,
    type TopBarTab,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const middlemanTabs: TopBarTab[] = [
    { id: "activity", label: "Activity" },
    { id: "repos", label: "Repos" },
    { id: "pulls", label: "Pulls" },
    { id: "issues", label: "Issues" },
    { id: "reviews", label: "Reviews" },
    { id: "workspaces", label: "Workspaces" },
  ];

  const agentsviewTabs: TopBarTab[] = [
    { id: "sessions", label: "Sessions" },
    { id: "usage", label: "Usage" },
    { id: "activity", label: "Activity" },
    { id: "trends", label: "Trends" },
    { id: "insights", label: "Insights" },
  ];

  let mmActive = $state("activity");
  let mmCollapsed = $state(false);
  let mmWidth = $state(920);
  let repo = $state("all");

  let avActive = $state("sessions");
  let avCollapsed = $state(false);
  let avWidth = $state(920);
</script>

<DemoSection
  title="middleman-style: brand + centered tabs + actions"
  description="Reserved left/right regions never shrink; the tab group collapses into a SelectDropdown the moment the full row stops fitting (measured, not a breakpoint). Drag the slider."
  code={`<TopBar tabs={TABS} bind:active bind:collapsed centerTabs>
  {#snippet left()}<span class="brand">middleman</span><SelectDropdown … />{/snippet}
  {#snippet right()}<button …><Search /></button><button …><Moon /></button>{/snippet}
</TopBar>`}
>
  <div class="controls">
    <label class="control">
      Width {mmWidth}px
      <input type="range" min="360" max="920" bind:value={mmWidth} />
    </label>
    <span class="control-note">collapsed: <code>{mmCollapsed}</code>, active: <code>{mmActive}</code></span>
  </div>
  <div class="bar-host" style:width="{mmWidth}px">
    <TopBar
      tabs={middlemanTabs}
      bind:active={mmActive}
      bind:collapsed={mmCollapsed}
      centerTabs
      ariaLabel="middleman pages"
    >
      {#snippet left()}
        <span class="brand">
          <span class="brand-dot"></span>
          middleman
        </span>
        <SelectDropdown
          value={repo}
          options={[
            { value: "all", label: "All repos" },
            { value: "kit-ui", label: "kenn-io/kit-ui" },
            { value: "middleman", label: "kenn-io/middleman" },
          ]}
          onchange={(v) => (repo = v)}
          title="Repository"
        />
      {/snippet}
      {#snippet right()}
        <button class="icon-btn" title="Search" aria-label="Search" onclick={() => showFlash("Palette would open")}>
          <SearchIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
        <button class="icon-btn" title="Sync" aria-label="Sync" onclick={() => showFlash("Syncing…", 1500)}>
          <RefreshCwIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
        <button class="icon-btn" title="Theme" aria-label="Toggle theme">
          <MoonIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
        <button class="icon-btn" title="Settings" aria-label="Settings">
          <SettingsIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
      {/snippet}
    </TopBar>
  </div>
</DemoSection>

<DemoSection
  title="agentsview-style: nav tabs + centered search + actions"
  description="The search snippet takes the flexible middle. Tab collapse frees enough room that the search trigger and the reserved right region survive narrow widths."
  code={`<TopBar tabs={TABS} bind:active>
  {#snippet left()}<button class="hamburger" …/><span class="brand">AgentsView</span>{/snippet}
  {#snippet search()}
    <button class="search-hint" onclick={openPalette}>
      <SearchIcon size="12" /> Search sessions <KbdBadge keys={["⌘", "K"]} />
    </button>
  {/snippet}
  {#snippet right()}…icon buttons…{/snippet}
</TopBar>`}
>
  <div class="controls">
    <label class="control">
      Width {avWidth}px
      <input type="range" min="360" max="920" bind:value={avWidth} />
    </label>
    <span class="control-note">collapsed: <code>{avCollapsed}</code>, active: <code>{avActive}</code></span>
  </div>
  <div class="bar-host" style:width="{avWidth}px">
    <TopBar
      tabs={agentsviewTabs}
      bind:active={avActive}
      bind:collapsed={avCollapsed}
      ariaLabel="AgentsView pages"
    >
      {#snippet left()}
        <button class="icon-btn" title="Toggle sidebar" aria-label="Toggle sidebar">
          <MenuIcon size="16" strokeWidth="2" aria-hidden="true" />
        </button>
        <span class="brand">
          <span class="brand-dot brand-dot--blue"></span>
          AgentsView
        </span>
      {/snippet}
      {#snippet search()}
        <button
          class="search-hint"
          onclick={() => showFlash("Command palette would open")}
        >
          <SearchIcon size="12" strokeWidth="2" aria-hidden="true" />
          {#if !avCollapsed}<span>Search sessions</span>{/if}
          <KbdBadge keys={["⌘", "K"]} />
        </button>
      {/snippet}
      {#snippet right()}
        <button class="icon-btn" title="Sync" aria-label="Sync" onclick={() => showFlash("Syncing…", 1500)}>
          <RefreshCwIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
        <span class="divider"></span>
        <button class="icon-btn" title="Theme" aria-label="Toggle theme">
          <MoonIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
        <button class="icon-btn" title="Settings" aria-label="Settings">
          <SettingsIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
      {/snippet}
    </TopBar>
  </div>
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

  .bar-host {
    max-width: 100%;
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .brand-dot {
    width: 14px;
    height: 14px;
    border-radius: var(--radius-sm);
    background: var(--accent-purple);
    flex-shrink: 0;
  }

  .brand-dot--blue {
    background: var(--accent-blue);
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 0.12s,
      color 0.12s;
  }

  .icon-btn:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .search-hint {
    height: 26px;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 10px;
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-family: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .search-hint:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-sm);
  }

  .divider {
    width: 1px;
    height: 14px;
    background: var(--border-muted);
    margin: 0 var(--space-1);
    flex-shrink: 0;
  }
</style>
