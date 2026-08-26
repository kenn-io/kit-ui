# Menu component research

Date: 2026-08-26

## Recommendation

Build a compositional menu family for action menus, and keep form-like floating panels out of it.

The useful first release is `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuRadioItem`, and `MenuSeparator`. These components should own the native trigger, menu, and item elements. Consumers should own the content inside them through Svelte 5 snippets. This is the same broad split used by Radix UI, React Aria, Ariakit, and Bits UI: the library owns interaction semantics, while the application composes labels, icons, descriptions, and status marks.

Do not turn every floating panel into an ARIA menu. A menu is a composite widget whose children are menu items. A panel containing text fields, checkboxes, or secondary buttons needs normal Tab navigation and is better represented as a non-modal popover or dialog. The WAI-ARIA Authoring Practices define a menu as a list of choices with focus moved among `menuitem`, `menuitemcheckbox`, or `menuitemradio` children. Tab leaves the menu rather than moving among its items. [APG Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)

That distinction fits Kata PR 311:

- `MoveIssueDialog`'s first "Task actions" view is an action menu.
- `KataDaemonSwitcher` is a single-choice menu and maps to radio items.
- `LinkFilterMenu` contains real checkbox controls. It is a popover form, not a menu.
- `ColumnPicker` contains checkboxes and a "Show all" button. It is also a popover form.
- `MoveIssueDialog`'s searchable destination view contains a text field and action buttons. Its existing `role="dialog"` is a better model than `role="menu"`.

## The accessibility baseline

The APG menu button pattern requires a button with `aria-haspopup="menu"`, an `aria-expanded` state, and a popup with `role="menu"`. Enter and Space open the menu and place focus on its first item. Arrow Down and Arrow Up may open it at the first and last item respectively. [APG Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)

Once open, a vertical menu needs the following behavior:

- Arrow Down and Arrow Up move focus between items, with optional wrapping.
- Home and End move to the first and last item when wrapping is not supported.
- Printable characters may provide typeahead.
- Enter activates an item and usually closes the menu.
- Escape closes the menu and returns focus to the trigger.
- Tab and Shift+Tab close the menu and move focus out. They do not walk its items.
- Disabled menu items remain focusable but cannot be activated.
- Separators do not receive focus.

The APG permits either roving DOM focus or `aria-activedescendant`. For this library, roving focus is the better fit. It needs less indirection, matches the native-button item DOM already used in Kata, and lets focus-visible styling work on the actual item. [APG Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)

Menu items must not contain other interactive elements. React Aria's menu documentation calls this out directly because nested buttons or fields break keyboard and screen-reader navigation. [React Aria Menu, "Text slots"](https://react-spectrum.adobe.com/react-aria/Menu.html#text-slots)

## Framework comparison

### Radix UI DropdownMenu

Radix uses a compositional part API: `Root`, `Trigger`, `Portal`, `Content`, `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Sub`, `Separator`, and related parts. Each part owns its default DOM, while `asChild` lets the consumer replace that element and merge Radix behavior into it. `Content` positions against `Trigger`; `Portal` moves the popup to `document.body` by default. [Radix Dropdown Menu anatomy and API](https://www.radix-ui.com/primitives/docs/components/dropdown-menu)

Its public contract includes managed focus, keyboard navigation, typeahead, submenus, check and radio items, collision-aware positioning, and controlled or uncontrolled open state. `Root` is modal by default. `Content` exposes Escape, pointer-outside, focus-outside, and close-autofocus hooks. A normal item's `onSelect` closes the menu unless the handler calls `preventDefault()`. Disabled items prevent interaction. [Radix Dropdown Menu API](https://www.radix-ui.com/primitives/docs/components/dropdown-menu)

Radix is a useful model for component boundaries and selection variants. Its full positioning and layering API is larger than kit-ui needs for a first release.

### React Aria Menu

React Aria composes `MenuTrigger`, a pressable trigger, `Popover`, `Menu`, `MenuItem`, `MenuSection`, `SubmenuTrigger`, and `Separator`. `MenuItem` owns its interactive DOM and may render a link when given `href`. The trigger may be any React Aria pressable, or a custom component that forwards the supplied ref and DOM props. [React Aria Menu](https://react-spectrum.adobe.com/react-aria/Menu.html)

React Aria supports both static children and dynamic collections supplied through `items` plus a render function. It models checked state as selection: a whole menu or an individual section can use single or multiple selection, controlled with `selectedKeys`. Items use `isDisabled`, and ordinary actions use `onAction`. [React Aria Menu, "Content" and "Selection"](https://react-spectrum.adobe.com/react-aria/Menu.html#content)

This is the strongest example of supporting data-driven convenience without making the underlying menu data-driven. The compositional components come first. A wrapper can later map an item array onto them.

### Ariakit Menu

Ariakit puts state in a menu store or `MenuProvider`, then composes `MenuButton`, `Menu`, and `MenuItem`. The default elements are a button for `MenuButton` and divs with the appropriate roles for `Menu` and `MenuItem`; its `render` prop allows element replacement. [Ariakit MenuButton source](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-button.tsx) [Ariakit Menu source](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu.tsx)

The implementation records whether the trigger opened by keyboard or pointer. Arrow Down and Arrow Up choose the initial first or last item. On show, it resolves an enabled initial item and manages final focus back to the disclosure or anchor. Menus are non-modal by default, `hideOnEscape` defaults to true, and normal menu items hide the menu on click by default. [Ariakit MenuButton source](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-button.tsx) [Ariakit Menu source](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu.tsx) [Ariakit MenuItem source](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-item.tsx)

Ariakit has distinct checkbox and radio item components. Both default `hideOnClick` to false, which suits menu options that users may toggle repeatedly. [Ariakit MenuItemCheckbox source](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-item-checkbox.tsx) [Ariakit MenuItemRadio source](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-item-radio.tsx)

Ariakit is a good model for a context-backed implementation and for distinguishing normal action dismissal from check and radio selection.

### Bits UI DropdownMenu

Bits UI is the closest Svelte 5 comparison. It exposes `Root`, `Trigger`, `Portal`, `Content`, `Group`, `GroupHeading`, `Item`, `CheckboxItem`, `CheckboxGroup`, `RadioGroup`, `RadioItem`, `Sub`, `SubTrigger`, `SubContent`, `Separator`, and `Arrow`. Open state uses Svelte function binding or `bind:open`. Consumers compose rich child content with snippets. [Bits UI Dropdown Menu](https://bits-ui.com/docs/components/dropdown-menu)

Bits documents a small data-driven wrapper as an application-level layer over the compositional parts. It also supports a custom positioning anchor, nested menus, controlled checkbox and radio state, and `forceMount` plus a child snippet for Svelte transitions. [Bits UI Dropdown Menu source documentation](https://github.com/huntabyte/bits-ui/blob/d9cc7ccd804e781596c68ca755d0ebb373d0776b/docs/content/components/dropdown-menu.md)

Bits confirms that a part-based menu API works naturally with Svelte 5. Kit-ui should borrow the shape, not its entire feature set.

## What kit-ui already has

The current utilities cover much of the popup shell but not menu semantics:

- `dismissable` closes on outside `mousedown` and Escape. Escape optionally restores trigger focus. It also calls `preventDefault()`, so an inner popover consumes one Escape before an enclosing overlay closes. See `src/lib/utils/popover.ts`.
- `autoReposition` observes trigger and panel size, window resize, and ancestor scrolling, then coalesces layout work into animation frames. See `src/lib/utils/popover.ts`.
- `floatingPopoverStyle` aligns, clamps, and flips a fixed-position popup. See `src/lib/components/floatingPosition.ts`.
- `trapFocus` moves focus into a surface, cycles Tab, locks body scrolling, and restores previous focus. Its own documentation limits it to modal surfaces. A normal menu should not use it. See `src/lib/utils/focus-trap.ts`.
- `backdropCloses` and `escapeCloses` are for full-screen overlays. A menu should reuse the one-layer Escape convention, but it does not need overlay wiring. See `src/lib/utils/overlay.ts`.

Existing components contain useful but separate interaction models:

- `SelectDropdown` is a listbox. It keeps focus on its combobox trigger and uses `aria-activedescendant`; it already has wrapping arrow navigation, disabled-option skipping, scroll-into-view, outside dismissal, and fixed positioning. See `src/lib/components/SelectDropdown.svelte`.
- `FilterDropdown` is data-driven and supports sections, search, bulk controls, toggle-like items, and per-item `closeOnSelect`. Because the panel can contain an input and several buttons, it is not an ARIA menu. See `src/lib/components/FilterDropdown.svelte`.
- `CommandPalette` is a modal dialog containing a combobox and listbox. It uses `trapFocus` and leaves DOM focus in the search field. It should remain separate from menus. See `src/lib/components/CommandPalette.svelte`.

The menu implementation should reuse positioning and outside-dismiss code. It still needs its own item registry, roving focus, typeahead, activation, Tab handling, and selection roles.

## Evidence from Kata PR 311

### MoveIssueDialog

The action view has a correctly labelled `role="menu"` and `role="menuitem"` children, but its behavior is pointer-first. Clicking the trigger only changes `menuOpen`; opening does not focus an item. The action view has no Arrow, Home, End, typeahead, Tab, or Escape handling. The component manually adds a capturing window `pointerdown` listener for outside dismissal. Escape handling exists only in the later searchable move dialog. See `web/src/components/MoveIssueDialog.svelte` in the Kata PR 311 worktree.

This should use `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem`, and `MenuSeparator`. Selecting "Move to another project" can close the menu and open the existing dialog-like picker. The picker should not become a submenu because it contains `SearchInput`.

### KataDaemonSwitcher

The switcher already uses `role="menu"` and `role="menuitemradio"`, and it exposes selection with `aria-checked`. It has no keyboard navigation, outside dismissal, Escape handling, focus restoration, viewport collision handling, or shared popover card class. Its `disabled` prop guards selection and disables rows, but it does not disable or guard the trigger, so the menu still opens while the switcher is disabled. See `web/src/components/KataDaemonSwitcher.svelte` in the Kata PR 311 worktree.

This maps directly to `MenuRadioGroup` and `MenuRadioItem`. The item needs rich snippet content for the health dot, daemon name, status, check mark, and hint. Choosing a daemon should opt into closing after radio selection.

### LinkFilterMenu

The panel contains two fieldsets and kit-ui `Checkbox` components, uses `role="group"`, and relies on normal focusable controls. It already reuses `dismissable`, `autoReposition`, `floatingPopoverStyle`, and `kit-popover-card`. See `web/src/components/LinkFilterMenu.svelte` in the Kata PR 311 worktree.

This is evidence for a reusable `Popover` shell, not for more menu item variants. Converting the checkboxes to menu items would replace familiar form navigation with composite-menu navigation for no product benefit.

### ColumnPicker

The column panel contains several kit-ui `Checkbox` components plus a separate "Show all" button. It also repeats the same open state, dismissal, positioning, and fixed panel setup as `LinkFilterMenu`. See `web/src/components/ColumnPicker.svelte` in the Kata PR 311 worktree.

This should share the same future `Popover` shell as `LinkFilterMenu`. It should not use `MenuContent`, because Tab needs to move through its checkboxes and reset button.

## Proposed kit-ui API

The public API should be compositional:

```svelte
<Menu bind:open align="end">
  <MenuTrigger ariaLabel="More actions">
    <MoreHorizontalIcon size={14} aria-hidden="true" />
  </MenuTrigger>

  <MenuContent ariaLabel="Task actions">
    <MenuItem onselect={openMovePicker}>Move to another project</MenuItem>
    <MenuItem onselect={addChecklist}>Add checklist</MenuItem>
    <MenuSeparator />
    <MenuItem tone="danger" onselect={openDeleteDialog}>Delete issue</MenuItem>
  </MenuContent>
</Menu>
```

An existing trigger component can opt into the same behavior without adding a second button:

```svelte
<MenuTrigger>
  {#snippet child({ attachment })}
    <IconButton ariaLabel="More actions" {@attach attachment}>
      <MoreHorizontalIcon size={14} aria-hidden="true" />
    </IconButton>
  {/snippet}
</MenuTrigger>
```

For the daemon switcher:

```svelte
<Menu bind:open>
  <MenuTrigger ariaLabel={`Switch Kata daemon: ${displayId}`}>
    <!-- rich trigger content -->
  </MenuTrigger>

  <MenuContent ariaLabel="Configured Kata daemons">
    <MenuRadioGroup value={activeId} onchange={onSelect}>
      {#each daemons as daemon (daemon.id)}
        <MenuRadioItem
          value={daemon.id}
          disabled={daemon.health === "upgrade_required"}
          closeOnSelect
          textValue={daemon.id}
        >
          <!-- health dot, name, status, and hint -->
        </MenuRadioItem>
      {/each}
    </MenuRadioGroup>
  </MenuContent>
</Menu>
```

The components should follow these ownership rules:

- `Menu` owns bindable open state, generated IDs, refs, item registration, and shared context. It may render only a layout-neutral wrapper.
- `MenuTrigger` owns a native button by default and all trigger ARIA and key handlers. An optional `child` snippet can receive a trigger attachment when an existing component such as `IconButton` must own the button DOM.
- `MenuContent` owns the `role="menu"` element, fixed positioning, item navigation, outside dismissal, Escape restoration, and focus-on-open behavior.
- Item components own the interactive item element and roles. Child snippets may contain text and decorative content, but no buttons, inputs, links, or other controls.
- `MenuSeparator` owns a non-focusable `role="separator"` element.

Use callback props such as `onselect` and `onchange`, bindable state with `$bindable`, generated IDs from `$props.id()`, context for registration, and snippets for rich content. These choices match the repository's current Svelte 5 conventions.

Svelte 5 attachments make the custom-trigger case possible without cloning an element. An attachment placed on a component becomes a symbol-keyed prop; a wrapper component forwards it by collecting rest props and spreading them onto its native element. Attachments are available from Svelte 5.29, which matches this package's peer dependency floor. `IconButton` would need to forward rest props before it could accept this path. [Svelte attachment documentation](https://svelte.dev/docs/svelte/@attach#Passing-attachments-to-components)

The first version does not need submenus, portals, custom anchors, long press, context menus, modal mode, or dynamic-collection helpers. Those are real features in the surveyed libraries, but neither Kata example needs them.

## Interaction decisions for the first version

- Use roving DOM focus among item elements.
- Open with Enter or Space at the first item, Arrow Down at the first item, and Arrow Up at the last item.
- Support Arrow Up, Arrow Down, Home, End, and prefix typeahead while open.
- Escape closes and restores trigger focus. Outside pointer press closes without forcing focus back to the trigger.
- Tab closes and allows the browser to move focus normally.
- Normal items close after selection by default.
- Checkbox and radio items stay open by default. `closeOnSelect` overrides this, which the daemon switcher needs.
- Represent unavailable menu items with `aria-disabled="true"` and guard pointer and keyboard activation. Do not use native `disabled`, because the APG expects disabled menu items to remain focusable.
- Do not use `trapFocus` or lock body scrolling. This is a non-modal popup.
- Reuse `dismissable`, `autoReposition`, `floatingPopoverStyle`, and `kit-popover-card`.

## Styling consequence of Svelte component ownership

The library should own the menu wrapper and item chrome. Svelte scopes a component's CSS by adding a component-specific hash class to elements in that component, so a class passed to a child does not make the parent's scoped selector apply to DOM created inside the child. Rich snippet descendants still belong to the consumer and can use the consumer's scoped styles, but styling the `MenuItem` element itself requires library variants, CSS custom properties, or an explicit global selector. [Svelte scoped styles](https://svelte.dev/docs/svelte/scoped-styles)

That argues for a small stable style contract:

- base classes such as `.kit-menu`, `.kit-menu__content`, and `.kit-menu__item`
- `tone="danger"` for destructive items
- data attributes for highlighted, checked, and disabled state
- CSS variables for content width and item grid layout when needed
- `kit-control-states` on the native trigger and item elements

Avoid a React-style `asChild` clone for the first version. A default library-owned trigger keeps the button semantics and keyboard wiring in one place. Where an existing button component must own the DOM, use the Svelte attachment path described above and require that component to forward attachments to its native button.

## Sources

All external sources below are primary documentation or upstream source code, accessed 2026-08-26.

- W3C WAI-ARIA Authoring Practices, [Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- W3C WAI-ARIA Authoring Practices, [Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- Radix UI, [Dropdown Menu documentation](https://www.radix-ui.com/primitives/docs/components/dropdown-menu)
- React Aria, [Menu documentation](https://react-spectrum.adobe.com/react-aria/Menu.html)
- Adobe React Spectrum source, [React Aria Menu documentation source](https://github.com/adobe/react-spectrum/blob/dabbd0dd43fe9de132ef47bdddb47330f0e755c2/packages/dev/s2-docs/pages/react-aria/Menu.mdx)
- Ariakit source, [MenuButton](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-button.tsx), [Menu](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu.tsx), [MenuItem](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-item.tsx), [MenuItemCheckbox](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-item-checkbox.tsx), and [MenuItemRadio](https://github.com/ariakit/ariakit/blob/8fc2f9a51245929312820b80bcd1df5e117a7227/packages/ariakit-react-components/src/menu/menu-item-radio.tsx)
- Bits UI, [Dropdown Menu documentation](https://bits-ui.com/docs/components/dropdown-menu) and [documentation source](https://github.com/huntabyte/bits-ui/blob/d9cc7ccd804e781596c68ca755d0ebb373d0776b/docs/content/components/dropdown-menu.md)
- Svelte, [Scoped styles](https://svelte.dev/docs/svelte/scoped-styles), [Snippets](https://svelte.dev/docs/svelte/snippet), and [Attachments](https://svelte.dev/docs/svelte/@attach)
