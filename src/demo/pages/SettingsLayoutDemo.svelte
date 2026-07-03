<script lang="ts">
  import SettingsLayout, {
    type SettingsCategory,
  } from "../../lib/components/SettingsLayout.svelte";
  import SettingsSection from "../../lib/components/SettingsSection.svelte";
  import { Button, SearchInput, SegmentedControl, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const categories: SettingsCategory[] = [
    { id: "general", label: "General", group: "Account", summary: "Profile and identity" },
    {
      id: "notifications",
      label: "Notifications",
      group: "Account",
      summary: "Desktop alert behavior",
    },
    { id: "appearance", label: "Appearance", group: "Workspace", summary: "Theme and density" },
    { id: "sync", label: "Sync", group: "Workspace", summary: "Background refresh" },
  ];

  let active = $state("general");
  let query = $state("");
  const visibleCategories = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => `${c.label} ${c.group} ${c.summary}`.toLowerCase().includes(q));
  });
  let displayName = $state("Ada Lovelace");
  let autoSync = $state(true);
  let hideBots = $state(false);
  let theme = $state("system");
  let compactLists = $state(false);
</script>

<DemoSection
  title="Categorized settings panel"
  description="Sidebar of categories on the left, scrollable SettingsSections on the right, optional pinned footer. Categories can carry a group (heading rendered between runs) and a summary line; the sidebarHeader snippet hosts app chrome like a settings search. bind:active tracks the selected category; the panel snippet receives its id. Below 760px the sidebar collapses to a top strip (labels only)."
  code={`const categories: SettingsCategory[] = [
  { id: "general", label: "General", group: "Account", summary: "Profile and identity" },
  { id: "appearance", label: "Appearance", group: "Workspace", summary: "Theme and density" },
];

<SettingsLayout categories={visibleCategories} bind:active title="Settings">
  {#snippet sidebarHeader()}
    <SearchInput bind:value={query} size="sm" block placeholder="Search settings…" />
  {/snippet}
  {#snippet panel(id)}
    {#if id === "general"}
      <SettingsSection title="Profile" description="How you appear to others.">
        …rows…
      </SettingsSection>
    {:else if id === "appearance"}
      …
    {/if}
  {/snippet}
  {#snippet footer()}
    <Button label="Save changes" surface="solid" tone="info" onclick={save} />
  {/snippet}
</SettingsLayout>`}
>
  <div class="settings-host">
    <SettingsLayout categories={visibleCategories} bind:active>
      {#snippet sidebarHeader()}
        <SearchInput bind:value={query} size="sm" block placeholder="Search settings…" />
        {#if visibleCategories.length === 0}
          <p class="empty-nav">No matching settings</p>
        {/if}
      {/snippet}
      {#snippet panel(id)}
        {#if id === "general"}
          <SettingsSection
            title="Profile"
            description="How you appear to other people on this server."
          >
            <label class="row">
              <span class="row__text">
                <span class="row__label">Display name</span>
                <span class="row__hint">Shown next to your activity.</span>
              </span>
              <input class="row__input" type="text" bind:value={displayName} />
            </label>
          </SettingsSection>
        {:else if id === "notifications"}
          <SettingsSection title="Notifications" description="Desktop alert behavior.">
            <label class="row">
              <span class="row__text">
                <span class="row__label">Desktop notifications</span>
              </span>
              <input type="checkbox" checked />
            </label>
          </SettingsSection>
        {:else if id === "sync"}
          <SettingsSection title="Sync" description="Background refresh behavior.">
            <label class="row">
              <span class="row__text">
                <span class="row__label">Auto-sync</span>
                <span class="row__hint">Poll providers every few minutes.</span>
              </span>
              <input type="checkbox" bind:checked={autoSync} />
            </label>
            <label class="row">
              <span class="row__text">
                <span class="row__label">Hide bot activity</span>
                <span class="row__hint">Filter [bot] authors from feeds.</span>
              </span>
              <input type="checkbox" bind:checked={hideBots} />
            </label>
          </SettingsSection>
        {:else if id === "appearance"}
          <SettingsSection title="Theme" description="Colors follow the kit-ui theme tokens.">
            <div class="row">
              <span class="row__text">
                <span class="row__label">Color scheme</span>
              </span>
              <SegmentedControl
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
                value={theme}
                onchange={(value) => (theme = value)}
                ariaLabel="Color scheme"
              />
            </div>
          </SettingsSection>
          <SettingsSection title="Density">
            <label class="row">
              <span class="row__text">
                <span class="row__label">Compact lists</span>
                <span class="row__hint">Tighter rows in tables and feeds.</span>
              </span>
              <input type="checkbox" bind:checked={compactLists} />
            </label>
          </SettingsSection>
        {/if}
      {/snippet}
      {#snippet footer()}
        <Button
          label="Save changes"
          surface="solid"
          tone="info"
          onclick={() => showFlash("Settings saved (not really)")}
        />
      {/snippet}
    </SettingsLayout>
  </div>
</DemoSection>

<DemoSection
  title="SettingsSection on its own"
  description="A bordered card: title header, optional muted description, and a column of rows. Usable outside SettingsLayout too (e.g. a one-off preferences modal)."
  code={`<SettingsSection title="Sync" description="Background refresh behavior.">
  <label>…row…</label>
</SettingsSection>`}
>
  <div class="section-host">
    <SettingsSection
      title="Notifications"
      description="Standalone section without the surrounding layout."
    >
      <label class="row">
        <span class="row__text">
          <span class="row__label">Desktop notifications</span>
        </span>
        <input type="checkbox" checked />
      </label>
    </SettingsSection>
  </div>
</DemoSection>

<style>
  .settings-host {
    width: 100%;
    height: 460px;
    display: flex;
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .empty-nav {
    margin: 0;
    padding: 0 var(--space-4);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .section-host {
    width: 100%;
    max-width: 480px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
  }

  .row__text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .row__label {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .row__hint {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .row__input {
    width: 180px;
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-inset);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
  }
</style>
