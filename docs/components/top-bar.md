# TopBar

App header bar: reserved left/right regions, an optional centered search
slot, and primary-nav tab buttons that **auto-collapse into a
`SelectDropdown` by measurement** — a hidden probe always renders the full
tab row, and the tabs collapse the moment that row would no longer fit next
to the side regions. No app-specific breakpoints. Snippets may legitimately
shrink when `collapsed` flips (hide labels, etc.); the bar records the width
the expanded content needed at the moment it collapsed and only re-expands
once the bar actually reaches it, so adaptive snippets can't set up a
collapse/expand loop.

Consolidated from middleman's `AppHeader` (centered tab group, tabs →
dropdown when narrow) and agentsview's `AppHeader` (nav next to the brand,
centered ⌘K search trigger, icon-button cluster on the right).

```svelte
<script lang="ts">
  import { TopBar, type TopBarTab } from "@kenn-io/kit-ui";

  const tabs: TopBarTab[] = [
    { id: "activity", label: "Activity" },
    { id: "pulls", label: "Pulls" },
    { id: "issues", label: "Issues" },
  ];
  let active = $state("activity");
</script>

<TopBar {tabs} bind:active onchange={(id) => navigate(id)}>
  {#snippet left()}
    <Brand />
    <SelectDropdown value={repo} options={repoOptions} onchange={setRepo} />
  {/snippet}
  {#snippet search()}
    <button class="search-hint" onclick={openPalette}>
      <SearchIcon size="12" /> Search <KbdBadge keys={["⌘", "K"]} />
    </button>
  {/snippet}
  {#snippet right()}
    <SyncButton /> <ThemeToggle /> <SettingsButton />
  {/snippet}
</TopBar>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tabs` | `TopBarTab[]` | `[]` | `{ id, label, disabled? }`; omit for a tabless bar |
| `active` | `string` (bindable) | `""` | Active tab id. Unset/unknown values render as the first **enabled** tab in both expanded and collapsed modes |
| `onchange` | `(id: string) => void` | — | Fires on tab/dropdown selection |
| `collapsed` | `boolean` (bindable) | `false` | True while tabs are collapsed — read it to adapt snippets (e.g. hide the search label) |
| `centerTabs` | `boolean` | `false` | Center the expanded tab group **in the free space between the reserved regions** (middleman style; not viewport-centered). Ignored when a `search` snippet is present — search owns the flexible middle. The collapsed dropdown always packs after `left` |
| `ariaLabel` | `string` | `"Primary"` | Label for the nav / collapsed dropdown |
| `left` | `Snippet` | — | Reserved leading region: brand, sidebar toggle, context pickers |
| `search` | `Snippet` | — | Centered flexible slot, e.g. a command-palette trigger |
| `right` | `Snippet` | — | Reserved trailing region: actions, theme, settings |
| `class` | `string` | `""` | |

## Layout contract

- The bar is `height: var(--header-height)` (44px) with a bottom border on
  `--bg-surface`.
- **The side regions never shrink** (`flex-shrink: 0`) — when space runs
  out, the tabs collapse first, so whatever the app reserves left/right
  keeps its footprint. Keep those regions lean at small widths (icon
  buttons); use `bind:collapsed` to drop labels when the bar is tight.
- Exactly one region owns the flexible middle: the `search` slot when
  present (`margin-inline: auto`), otherwise the tab group when
  `centerTabs` is set. Combining both would fight over the slack, so
  `centerTabs` is ignored while a `search` snippet exists.

## Accessibility

The tab row is a `<nav aria-label>` of buttons with `aria-current="page"`
on the active one (these are page-nav tabs, not `role="tablist"` panels).
When collapsed, navigation goes through `SelectDropdown`'s combobox
semantics under the same label.
