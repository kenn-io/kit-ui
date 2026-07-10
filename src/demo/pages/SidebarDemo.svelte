<script lang="ts">
  import { Checkbox, CollapsibleSidebar, SidebarToggle } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let collapsed = $state(false);
  let width = $state(220);
  let overlayForced = $state(false);
  let overlayCollapsed = $state(false);
</script>

<DemoSection
  title="Collapsible, resizable sidebar"
  description="Drag the divider (or focus it and use arrow keys) to resize within min/max; collapse to a thin strip with an expand toggle. The committed width comes back through onSidebarResize so the app can persist it."
  code={`<CollapsibleSidebar
  isCollapsed={collapsed}
  showCollapsedStrip
  sidebarWidth={width}
  minSidebarWidth={160}
  maxSidebarWidth={360}
  onSidebarResize={(w) => (width = w)}
  onExpand={() => (collapsed = false)}
>
  {#snippet sidebar()}…{/snippet}
  <main>…</main>
</CollapsibleSidebar>`}
>
  <div class="sidebar-host">
    <CollapsibleSidebar
      isCollapsed={collapsed}
      showCollapsedStrip
      sidebarWidth={width}
      minSidebarWidth={160}
      maxSidebarWidth={360}
      onSidebarResize={(w) => (width = w)}
      onExpand={() => (collapsed = false)}
    >
      {#snippet sidebar()}
        <div class="pane pane--sidebar">
          <div class="pane-header">
            <span>Sessions</span>
            <SidebarToggle
              state="expanded"
              onclick={() => (collapsed = true)}
              class="kit-sidebar-toggle--push"
            />
          </div>
          <ul class="fake-list">
            <li>middleman #1204</li>
            <li>agentsview #88</li>
            <li>kit-ui #3</li>
          </ul>
        </div>
      {/snippet}
      <div class="pane pane--main">
        <p>Main content · sidebar width: <code>{width}px</code></p>
      </div>
    </CollapsibleSidebar>
  </div>
</DemoSection>

<DemoSection
  title="Host-driven overlay"
  description="overlayOnNarrow keys the floating overlay on the viewport (below 900px). When the app's narrow signal is a measured container width instead — embedded panes, split-pane hosts — pass the overlay prop and kit applies the same kit-sidebar-layout--overlay presentation; no app-side CSS copy."
  code={`<CollapsibleSidebar overlay={containerWidth < 500} isCollapsed={collapsed} …>
  {#snippet sidebar()}…{/snippet}
  <main>…</main>
</CollapsibleSidebar>`}
>
  <div class="overlay-switch">
    <Checkbox bind:checked={overlayForced}>
      Force <code>overlay</code> (host signal says narrow)
    </Checkbox>
  </div>
  <div class="sidebar-host sidebar-host--overlay">
    <CollapsibleSidebar
      isCollapsed={overlayCollapsed}
      showCollapsedStrip
      overlay={overlayForced || undefined}
      sidebarWidth={200}
      minSidebarWidth={160}
      maxSidebarWidth={360}
      onExpand={() => (overlayCollapsed = false)}
    >
      {#snippet sidebar()}
        <div class="pane pane--sidebar">
          <div class="pane-header">
            <span>Sessions</span>
            <SidebarToggle
              state="expanded"
              onclick={() => (overlayCollapsed = true)}
              class="kit-sidebar-toggle--push"
            />
          </div>
          <ul class="fake-list">
            <li>middleman #1204</li>
            <li>agentsview #88</li>
            <li>kit-ui #3</li>
          </ul>
        </div>
      {/snippet}
      <div class="pane pane--main">
        <p>overlay: <code>{overlayForced ? "true" : "undefined"}</code></p>
      </div>
    </CollapsibleSidebar>
  </div>
</DemoSection>

<DemoSection
  title="SidebarToggle"
  description="The standalone toggle button, also usable in app headers."
  code={`<SidebarToggle state={collapsed ? "collapsed" : "expanded"} onclick={toggle} />`}
>
  <SidebarToggle
    state={collapsed ? "collapsed" : "expanded"}
    onclick={() => (collapsed = !collapsed)}
  />
  <span>collapsed: <code>{collapsed}</code></span>
</DemoSection>

<style>
  .sidebar-host {
    width: 100%;
    height: 220px;
    display: flex;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .sidebar-host--overlay {
    height: 180px;
  }

  .overlay-switch {
    margin-bottom: var(--space-4);
  }

  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  .pane-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-muted);
  }

  .fake-list {
    list-style: none;
    margin: 0;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .fake-list li {
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .fake-list li:hover {
    background: var(--bg-surface-hover);
  }

  .pane--main {
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }
</style>
