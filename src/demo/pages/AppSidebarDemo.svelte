<script lang="ts">
  import DemoSection from "../DemoSection.svelte";

  // Each iframe loads this demo app with ?app-sidebar-frame, which renders
  // AppSidebarFrame.svelte, so the frame's width picks the sidebar's band.
  const frameSrc = `${location.pathname}?app-sidebar-frame=reports/overview`;
</script>

<DemoSection
  title="Three width bands"
  description="At 900px and narrower a top bar's menu button opens the sidebar in a modal drawer. From 901 to 1439px the sidebar is an icon rail: hover or focus an icon for its flyout, and the pin button expands the rail and remembers the choice. Drag the sidebar's right edge to resize it; it stops at the narrowest width that shows all the text. Double-click the edge or press Enter on it to collapse. The rail's edge does not move; expand the rail with the pin button. Touch screens start with the rail pinned open. At 1440px and wider the full sidebar shows the current section's views."
  code={`<AppSidebar {groups} location={{ section: "reports", view: "overview" }} {page} storageKey="acme-sidebar">
  {#snippet brand({ rail })}<a href="/">{rail ? "A" : "Acme"}</a>{/snippet}
  {#snippet narrowBar()}<span>Reports</span>{/snippet}
  {#snippet footer({ rail })}<ThemeToggle size={rail ? "md" : "sm"} />{/snippet}
</AppSidebar>`}
>
  <div class="frames">
    <figure class="frame">
      <iframe
        class="frame__window frame__window--narrow"
        src={frameSrc}
        title="AppSidebar at 720px: top bar and drawer"
      ></iframe>
      <figcaption>720px: top bar and drawer</figcaption>
    </figure>
    <figure class="frame">
      <iframe
        class="frame__window frame__window--rail"
        src={frameSrc}
        title="AppSidebar at 920px: icon rail"
      ></iframe>
      <figcaption>920px: icon rail</figcaption>
    </figure>
  </div>
  <p class="note">
    <a href={frameSrc} target="_blank" rel="noreferrer">Open the sample app in its own tab</a>
    at 1440px or wider to see the full sidebar.
  </p>
</DemoSection>

<style>
  .frames {
    display: grid;
    gap: var(--space-7);
    overflow-x: auto;
  }

  .frame {
    display: grid;
    gap: var(--space-3);
    margin: 0;
  }

  .frame__window {
    height: 480px;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
  }

  .frame__window--narrow {
    width: 720px;
  }

  .frame__window--rail {
    width: 920px;
  }

  figcaption,
  .note {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
</style>
