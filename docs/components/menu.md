# Menu

Compositional action and single-choice menus. `Menu` keeps open state and the
item registry behind one interface. The parts own button and menu semantics,
fixed positioning, outside dismissal, focus restoration, roving DOM focus,
Home/End, wrapping arrow navigation, and prefix typeahead.

```svelte
<script lang="ts">
  import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@kenn-io/kit-ui";
</script>

<Menu bind:open align="end">
  <MenuTrigger ariaLabel="Task actions">Actions</MenuTrigger>
  <MenuContent ariaLabel="Task actions">
    <MenuItem onselect={moveIssue}>Move issue</MenuItem>
    <MenuItem disabled onselect={archiveIssue}>Archive issue</MenuItem>
    <MenuSeparator />
    <MenuItem tone="danger" onselect={deleteIssue}>Delete issue</MenuItem>
  </MenuContent>
</Menu>
```

`MenuTrigger` opens at the first item with click, Enter, Space, or Arrow Down,
and at the last item with Arrow Up. While open, Arrow Up/Down wrap, Home/End
move to an edge, printable characters search item `textValue`, Escape closes
and restores trigger focus, and Tab closes without trapping focus. Selecting an
item also restores trigger focus before its `onselect` runs, so an action that
opens a dialog or focuses a field keeps that focus.

By default, `MenuTrigger` owns a native button. Use its `child` snippet when the
calling component needs to keep ownership of an existing button for scoped CSS,
`class:` directives, actions, or `bind:this`:

```svelte
<MenuTrigger ariaLabel="Task actions">
  {#snippet child({ attachment })}
    <button class="task-actions" type="button" {@attach attachment}>Actions</button>
  {/snippet}
</MenuTrigger>
```

The attachment adds the menu ARIA attributes, click and arrow-key handling,
disabled state, and `kit-control-states` to that button. Style open state with
`[aria-expanded="true"]`. Attachments require Svelte 5.29 or newer, which
matches kit-ui's peer dependency.

Disabled items use `aria-disabled="true"`. They remain in keyboard navigation
but cannot activate, matching the ARIA menu pattern. Ordinary `MenuItem`
selections close by default. Set `closeOnSelect={false}` when repeated actions
must leave the menu open.

## Context menus

A context menu has no trigger. Pass `anchor` with the pointer's viewport
coordinates to open the content there, and `returnFocus` with the element that
was right-clicked so Escape and item selection hand focus back to it:

```svelte
<script lang="ts">
  let open = $state(false);
  let anchor = $state<{ x: number; y: number }>();
  let row = $state<HTMLElement>();

  function openAt(event: MouseEvent): void {
    event.preventDefault();
    anchor = { x: event.clientX, y: event.clientY };
    open = true;
  }
</script>

<div role="button" tabindex="0" bind:this={row} oncontextmenu={openAt}>…</div>
<Menu bind:open {anchor} returnFocus={row}>
  <MenuContent ariaLabel="File actions">
    <MenuItem onselect={rename} keyshortcuts="F2">
      Rename
      {#snippet trailing()}F2{/snippet}
    </MenuItem>
  </MenuContent>
</Menu>
```

The content opens with its top-left corner at the point, stays inside the
viewport near its edges, and closes when the page scrolls. Keyboard behavior
matches a triggered menu.

`MenuItem`'s `trailing` snippet renders right-aligned muted text, such as a
count or a shortcut hint. Show a shortcut only for an action that really has
that binding. With a shortcut hint, also pass `keyshortcuts` in
`aria-keyshortcuts` form, such as `F2` or `Meta+1`. Screen readers then announce
the shortcut from that attribute, and the item's name stays just its label.

For single-choice menus, nest radio items in a group:

```svelte
<MenuRadioGroup value={daemon} onchange={(value) => (daemon = value)}>
  <MenuRadioItem value="local" closeOnSelect>Local</MenuRadioItem>
  <MenuRadioItem value="remote" closeOnSelect>Remote</MenuRadioItem>
</MenuRadioGroup>
```

Do not use `Menu` for panels containing inputs, native checkboxes, or secondary
buttons. Those need normal Tab navigation and belong in a popover or dialog.

## Interface

| Part             | Main props                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Menu`           | `bind:open`, `align="start" \| "end"`, `anchor`, `returnFocus`, `onopenchange`, `class`, `children`                         |
| `MenuTrigger`    | `ariaLabel`, `title`, `disabled`, `class`, `children`, `child`                                                              |
| `MenuContent`    | `ariaLabel`, `class`, `children`                                                                                            |
| `MenuItem`       | `onselect`, `disabled`, `closeOnSelect=true`, `tone="neutral" \| "danger"`, `textValue`, `icon`, `trailing`, `keyshortcuts` |
| `MenuRadioGroup` | `value`, `onchange`, `ariaLabel`, `children`                                                                                |
| `MenuRadioItem`  | `value`, `disabled`, `closeOnSelect=false`, `textValue`, `class`, `children`                                                |
| `MenuSeparator`  | none                                                                                                                        |

## Icon alignment

When any `MenuItem` in a menu passes an `icon` snippet, every item reserves the
icon column so labels share one left edge. A menu where no item passes an icon
shows no column. The slot is hidden from assistive technology. Set
`--menu-icon-width` to change its default 16px size.

```svelte
<MenuItem onselect={moveIssue}>
  {#snippet icon()}<ArrowRightIcon size={16} />{/snippet}
  Move issue
</MenuItem>
<MenuItem onselect={archiveIssue}>Archive issue</MenuItem>
```
