# Tabs

A tab list for switching between views of one subject, such as a pull
request's conversation, commits, and files. Forge hand-rolls this as
`role="tablist"` markup in its detail views and repo browser.

```svelte
<script lang="ts">
  import { Tabs, type TabItem } from "@kenn-io/kit-ui";

  const tabs: TabItem[] = [
    { id: "conversation", label: "Conversation", count: 4 },
    { id: "files", label: "Files changed", count: 38 },
  ];
  let value = $state("conversation");
</script>

<Tabs {tabs} bind:value ariaLabel="Pull request detail">
  {#snippet children(id)}
    {#if id === "files"}<FileList />{:else}<Conversation />{/if}
  {/snippet}
</Tabs>
```

## Behavior

- **Keyboard.** Arrow keys move between enabled tabs and wrap at the ends;
  Home and End jump to the first and last enabled tab. Only the selected
  tab is in the Tab order, and Tab moves on into the panel.
- **Activation.** With `automatic` (default), focusing a tab selects it.
  With `manual`, arrows only move focus and Enter or Space selects. Use
  `manual` when showing a panel is slow, so arrowing past a tab does not
  load it.
- **Panel.** The `children` snippet receives the selected id and renders in
  one `role="tabpanel"`, labelled by the selected tab, which points to it
  with `aria-controls`. Without `children`, Tabs renders the tab list alone,
  for layouts that place the content elsewhere.
- **Overflow.** A tab list wider than its container scrolls horizontally
  without a visible scrollbar. Focusing a tab scrolls it into view.

Use Tabs to switch views of one subject. To filter one list, use
`SegmentedControl`; to navigate between pages, use links.

## Props

| Prop         | Type                          | Default       | Notes                                                                     |
| ------------ | ----------------------------- | ------------- | ------------------------------------------------------------------------- |
| `tabs`       | `TabItem[]`                   | required      | `{ id, label, disabled?, count? }`. `count` renders muted after the label |
| `value`      | `string`                      | required      | Selected tab id; bindable                                                 |
| `onchange`   | `(id: string) => void`        | —             | Called when the user selects another tab                                  |
| `ariaLabel`  | `string`                      | —             | Accessible name for the tab list                                          |
| `activation` | `"automatic" \| "manual"`     | `"automatic"` | See above                                                                 |
| `tab`        | `Snippet<[TabItem, boolean]>` | —             | Custom tab content (icons, badges); `label` stays the accessible name     |
| `children`   | `Snippet<[string]>`           | —             | The selected tab's panel                                                  |
| `class`      | `string`                      | `""`          |                                                                           |

## Checker

`hand-rolled-tabs` flags `role="tablist"` markup in consumer code.
