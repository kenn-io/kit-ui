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
- **Custom strips.** `variant="bare"` keeps all of the above and drops the
  tab look: padding, type styles, hover background, the list's bottom rule,
  and the selection bar. Style the tabs with a class from `tabAttributes`;
  the component's reset has zero specificity, so that class wins.

Use Tabs to switch views of one subject. To filter one list, use
`SegmentedControl`; to navigate between pages, use links.

## Props

| Prop             | Type                                                  | Default       | Notes                                                                     |
| ---------------- | ----------------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `tabs`           | `TabItem[]`                                           | required      | `{ id, label, disabled?, count? }`. `count` renders muted after the label |
| `value`          | `string`                                              | required      | Selected tab id; bindable                                                 |
| `onchange`       | `(id: string) => void`                                | —             | Called when the user selects another tab                                  |
| `ariaLabel`      | `string`                                              | —             | Accessible name for the tab list                                          |
| `activation`     | `"automatic" \| "manual"`                             | `"automatic"` | See above                                                                 |
| `tab`            | `Snippet<[TabItem, boolean]>`                         | —             | Custom tab content (icons, badges); `label` stays the accessible name     |
| `tabAttributes`  | `(item: TabItem, selected: boolean) => TabAttributes` | —             | Extra attributes and handlers for each tab button; see below              |
| `listAttributes` | `TabListAttributes`                                   | `{}`          | Extra attributes and handlers for the tab list; see below                 |
| `listElement`    | `HTMLDivElement`                                      | —             | Bindable tab list element, for measuring and scrolling it                 |
| `afterList`      | `Snippet`                                             | —             | Rendered after the tab list, outside `role="tablist"`, inside the root    |
| `variant`        | `"underline" \| "bare"`                               | `"underline"` | `bare` drops the tab look; see above                                      |
| `children`       | `Snippet<[string]>`                                   | —             | The selected tab's panel                                                  |
| `class`          | `string`                                              | `""`          |                                                                           |

## Browser-style strips

A strip of draggable, reorderable tabs that scrolls when crowded needs more
than the default tab look. `tabAttributes` returns extra attributes for each
tab button, `listAttributes` and `listElement` reach the scrolling list, and
`afterList` holds controls such as scroll buttons, which must not sit inside
`role="tablist"`.

```svelte
<div class="strip">
  <Tabs
    {tabs}
    bind:value
    variant="bare"
    ariaLabel="Open pages"
    bind:listElement={list}
    listAttributes={{ class: "strip-list", onscroll: measure }}
    tabAttributes={(item, selected) => ({
      class: "strip-tab",
      title: item.label,
      "data-selected": selected || undefined,
      draggable: true,
      ondragstart: () => (dragged = item.id),
      ondragover: (event) => event.preventDefault(),
      ondrop: () => move(dragged, item.id),
      oncontextmenu: (event) => openTabMenu(event, item.id),
    })}
  >
    {#snippet afterList()}
      {#if canScrollForward}
        <IconButton ariaLabel="Scroll tabs forward" onclick={() => list.scrollBy({ left: 200 })}>
          <ChevronRightIcon size={14} />
        </IconButton>
      {/if}
    {/snippet}
  </Tabs>
</div>
```

- **Tab attributes.** `TabAttributes` is every `<button>` attribute except
  the ones Tabs owns: `type`, `role`, `id`, `tabindex`, `disabled`,
  `aria-selected`, `aria-controls`, `aria-label`, and `data-tab-id`. `class`
  is added to the tab's own classes. `onclick` runs after Tabs selects the
  tab, so `value` is already updated. Keyboard handlers on a tab run before
  the list's arrow-key handling.
- **List attributes.** `TabListAttributes` is every `<div>` attribute
  except `role`, `aria-label`, `aria-orientation`, and `tabindex`. `class` is
  added to the list's own classes, and `style` can set custom properties.
  `onkeydown` and `onfocusout` run after Tabs' own keyboard and focus
  handling; check `event.defaultPrevented` to skip keys Tabs handled.
- **Overlay controls.** `afterList` renders between the list and the panel.
  To lay controls over the list's ends, position them against a wrapper
  with `position: relative`, as in the example.

## Checker

`hand-rolled-tabs` flags `role="tablist"` markup in consumer code.
