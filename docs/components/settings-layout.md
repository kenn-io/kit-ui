# SettingsLayout

Categorized settings shell: a sidebar of categories on the left and a
scrollable content pane on the right, with an optional footer pinned below the
content (save/cancel actions). Generalizes middleman's `SettingsPage` —
category rendering is left to the `panel` snippet, which receives the active
category id. Below 760px the sidebar collapses to a horizontal strip above the
content (labels only: group headings and summaries are hidden there).

Categories may carry a `group` — a muted heading is rendered above each run of
categories sharing one, so the array order stays the display order — and a
`summary` line shown under the label. The `sidebarHeader` snippet renders
between the title and the nav for app chrome such as a settings search box or
a back-to-app button (the host owns filtering: derive a filtered `categories`
array and render any empty-state notice inside `sidebarHeader`).

Pairs with [SettingsSection](#settingssection) for the content cards.

```svelte
<script lang="ts">
  import { Button, SettingsLayout, SettingsSection } from "@kenn-io/kit-ui";

  const categories = [
    { id: "general", label: "General", group: "Account", summary: "Profile and identity" },
    { id: "appearance", label: "Appearance", group: "Workspace", summary: "Theme and density" },
  ];
  let active = $state("general");
  let query = $state("");
</script>

<SettingsLayout {categories} bind:active>
  {#snippet sidebarHeader()}
    <SearchInput bind:value={query} size="sm" block placeholder="Search settings…" />
  {/snippet}
  {#snippet panel(id)}
    {#if id === "general"}
      <SettingsSection title="Profile" description="How you appear to others.">
        <!-- rows -->
      </SettingsSection>
    {:else if id === "appearance"}
      <SettingsSection title="Theme"><!-- rows --></SettingsSection>
    {/if}
  {/snippet}
  {#snippet footer()}
    <Button label="Save changes" surface="solid" tone="info" onclick={save} />
  {/snippet}
</SettingsLayout>
```

The layout fills its flex parent (`flex: 1; min-height: 0`) — give the host a
bounded height.

## Props

| Prop            | Type                 | Default           | Notes                                                        |
| --------------- | -------------------- | ----------------- | ------------------------------------------------------------ |
| `categories`    | `SettingsCategory[]` | —                 | `{ id, label, group?, summary? }` per category               |
| `active`        | `string` (bindable)  | first category id | Selected category                                            |
| `panel`         | `Snippet<[string]>`  | —                 | Content for the active category; receives its id             |
| `title`         | `string`             | `"Settings"`      | Sidebar heading; pass `""` to hide                           |
| `sidebarHeader` | `Snippet`            | —                 | Above the nav: settings search, back-to-app button, and such |
| `footer`        | `Snippet`            | —                 | Pinned action row below the scrollable content               |

`SettingsCategory` is exported from the package root.

# SettingsSection

One bordered settings card: title header, optional muted description, and a
column of rows (12px gap). Ported from middleman's `SettingsSection`.

```svelte
<SettingsSection title="Sync" description="Background refresh behavior.">
  <label class="row">…</label>
  <label class="row">…</label>
</SettingsSection>
```

## Props

| Prop          | Type      | Default | Notes                             |
| ------------- | --------- | ------- | --------------------------------- |
| `title`       | `string`  | —       | Card header                       |
| `description` | `string`  | —       | Muted helper text under the title |
| `children`    | `Snippet` | —       | The setting rows                  |
