# AppSidebar

A responsive application sidebar. `CollapsibleSidebar` is a layout for any sidebar content, and its parent owns the collapse state and the persisted width. `AppSidebar` instead renders its own navigation from `groups` and collapses itself to a rail or a drawer as the window narrows. People can also collapse it to the rail, or expand it, with a button at the foot of the sidebar or with Mod+B. Until they do, the window width picks the layout:

| Window width       | Layout                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| 900px and narrower | A top bar with a menu button. The button opens the sidebar in a native modal `<dialog>` drawer.     |
| 901–1439px         | A 3.5rem icon rail. Hovering or focusing an icon opens a flyout with the section's title and views. |
| 1440px and wider   | The full 15rem sidebar. The current section shows its views inline.                                 |

```svelte
<script lang="ts">
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import HouseIcon from "@lucide/svelte/icons/house";
  import { AppSidebar, ThemeToggle, type SidebarGroup } from "@kenn-io/kit-ui";

  const groups: SidebarGroup[] = [
    {
      label: null,
      sections: [{ id: "home", label: "Home", href: "/", icon: HouseIcon, viewRuns: [] }],
    },
    {
      label: "Workspace",
      sections: [
        {
          id: "reports",
          label: "Reports",
          href: "/reports",
          icon: FileTextIcon,
          viewRuns: [
            {
              heading: null,
              views: [
                { id: "overview", label: "Overview", href: "/reports" },
                { id: "history", label: "History", href: "/reports/history" },
              ],
            },
          ],
        },
      ],
    },
  ];
</script>

<div class="app">
  <AppSidebar
    {groups}
    location={{ section: "reports", view: "overview" }}
    page="/reports"
    storageKey="acme-sidebar"
  >
    {#snippet brand({ rail })}<a href="/">{rail ? "A" : "Acme"}</a>{/snippet}
    {#snippet narrowBar()}<span>Reports</span>{/snippet}
    {#snippet footer({ rail })}<ThemeToggle size={rail ? "md" : "sm"} />{/snippet}
  </AppSidebar>
  <main>…</main>
</div>

<style>
  .app {
    display: flex;
    min-height: 100vh;
  }

  .app > main {
    flex: 1;
    min-width: 0;
  }

  @media (max-width: 900px) {
    .app {
      flex-direction: column;
    }
  }
</style>
```

Sections and views are plain links. The component does not route: update `location` and `page` when your router navigates.

## Props

| Prop                | Type                                            | Default              | Notes                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groups`            | `SidebarGroup[]`                                | required             | Sections in order, grouped under optional labels                                                                                                                                                                      |
| `location`          | `SidebarLocation`                               | required             | The current section and view ids; either can be `null`                                                                                                                                                                |
| `page`              | `string`                                        | required             | The page address without its fragment, such as `pathname + search`. A change closes any open flyout                                                                                                                   |
| `storageKey`        | `string`                                        | required             | localStorage key that remembers whether someone collapsed or expanded the sidebar                                                                                                                                     |
| `collapsed`         | `boolean \| null`                               | `null`               | A saved collapse choice from the host, for a host whose localStorage does not last, such as a throwaway browser session. It wins over `storageKey`; `null` means none                                                 |
| `oncollapsedchange` | `(collapsed: boolean) => void`                  | —                    | Called with the new state when someone collapses or expands the sidebar, so the host can save it                                                                                                                      |
| `brand`             | `Snippet<[{ rail: boolean }]>`                  | required             | Brand area at the top of the panel; `rail` is true in the icon-only rail                                                                                                                                              |
| `narrowBar`         | `Snippet`                                       | required             | Everything after the menu button in the narrow top bar                                                                                                                                                                |
| `footer`            | `Snippet<[{ rail: boolean; drawer: boolean }]>` | —                    | Optional. Without it, the footer region holds only the collapse button, and the drawer has no footer region. `drawer` is true inside the narrow drawer. The component adds its own collapse button outside the drawer |
| `label`             | `string`                                        | `"Main navigation"`  | Accessible name of the navigation landmark                                                                                                                                                                            |
| `menuLabel`         | `string`                                        | `"Open navigation"`  | Accessible name of the narrow bar's menu button                                                                                                                                                                       |
| `drawerLabel`       | `string`                                        | `"Navigation"`       | Accessible name of the narrow drawer dialog                                                                                                                                                                           |
| `expandLabel`       | `string`                                        | `"Expand sidebar"`   | Accessible name of the collapse button while collapsed                                                                                                                                                                |
| `collapseLabel`     | `string`                                        | `"Collapse sidebar"` | Accessible name of the collapse button while expanded                                                                                                                                                                 |

## Types

- `SidebarGroup`: `{ label: string | null; sections: SidebarSection[]; end?: boolean }`. A `null` label renders no group heading. The rail hides group headings. An `end` group sits at the bottom of the panel, just above the footer, apart from the groups before it, in the full sidebar, the rail and the drawer. Use it for a group that belongs to the device or the account rather than the product, such as local settings. List end groups last; when the panel is too short to separate them, they follow the other groups and the panel scrolls.
- `SidebarSection`: `{ id; label; href; icon: Component; viewRuns: SidebarViewRun[] }`. The icon renders at size 16, so any `@lucide/svelte` icon works. `viewRuns` is empty when the section has no views.
- `SidebarViewRun`: `{ heading: string | null; views: SidebarView[] }`. A run of views under an optional heading.
- `SidebarView`: `{ id; label; href }`.
- `SidebarLocation`: `{ section: string | null; view: string | null }`.

## Behavior

- Landmark: the whole panel (brand, sections and footer) is one navigation landmark named by `label`. At 900px and narrower, the landmark sits inside the drawer dialog, so the page has no navigation landmark, brand or footer until the drawer opens. The top bar is a `<header>`, so it is the page's banner unless the host places it inside a sectioning element.
- Current marks: a section link gets `aria-current="page"` when the section is current and none of its views is, and `aria-current="true"` when one of its views is current. The current view gets `aria-current="page"`. The full sidebar and the drawer list views inline for the current section only. In forced-colors mode, current rows take the system's selection colors.
- Flyouts (rail only):
  - Pointer hover or focus on a section opens its flyout beside the icon, with the section's title and views. The pointer leaving closes it, unless keyboard focus is on the section or inside its flyout. The close waits 250ms, so the pointer can cross other icons on its way to the flyout; an icon it still rests on when the wait ends opens its own flyout. Moving focus out of the section and its flyout closes it. A flyout with keyboard focus on its section or inside it also stays open while the pointer crosses other icons.
  - Escape closes an open flyout, however it was opened. When focus is on the section or inside its flyout, the flyout claims the key and focus returns to the section icon. A flyout opened by hover closes without claiming the key, so another layer, such as a panel or popover, closes on the same press. An Escape that another layer already claimed leaves the flyout open.
  - The flyout stays inside the window, and a flyout taller than the window scrolls. A page scroll keeps the flyout beside its icon.
  - When the rail scrolls, an open flyout closes, unless keyboard focus is on the section or inside its flyout. Then it stays open and moves with its icon.
  - A change to `page` closes the flyout. A change that only touches the fragment (`#details`) leaves `page` as it was, so the flyout stays.
  - A section without views shows a title-only flyout that assistive technology does not see; the section link carries the name.
  - When a flyout link navigates, the flyout closes. Focus then falls to the page unless the host's router moves it.
- Collapse (wider than 900px): the button at the foot of the sidebar switches between the rail and the full sidebar, with no animation. Mod+B (⌘B on Apple platforms, Ctrl+B elsewhere) does the same, except while focus is in a text field or another handler already claimed the key; the button's tooltip and `aria-keyshortcuts` name it. The component stores `"collapsed"` or `"expanded"` under `storageKey`, and that choice applies at every width above 900px, in every window of the same origin and after a reload; any other stored value reads as collapsed. With nothing stored, the width decides: the rail at 901–1439px and the full sidebar from 1440px. A touch screen (`MEDIA.touch`: no hover, or a coarse pointer; see [Breakpoints](../theming.md#breakpoints)) starts with the full sidebar at every width, so every view is reachable without hover. When storage is blocked, the choice lasts until the page reloads. When collapsing removes the link that has focus, such as a current view's link, focus moves to its section's link.
- Drawer (900px and narrower): Escape, a click that starts and ends on the backdrop, or a click on a link inside closes it, and focus returns to the menu button. A drag that starts in the drawer and ends on the backdrop, or the reverse, such as a text selection, leaves it open. A click on a link with Ctrl, Meta, Shift or Alt held leaves it open. Focus stays inside while it is open. The menu button carries `aria-expanded` and `aria-haspopup="dialog"`. The `footer` snippet renders with `drawer: true` only while the drawer is open, which is how a host can tell that the drawer is open. To close it from host code, call `close()` on the drawer's `dialog` element, for example `event.currentTarget.closest("dialog")?.close()` in a handler inside `footer`.
- Touch: on touch screens, section and view rows are at least 44px tall, and the menu button and the collapse button are 44px square.

## Layout

The full sidebar and the rail are `position: sticky` and `100dvh` tall, so give their parent a flex row and let the main column take the remaining width (`min-width: 0`). At 900px and narrower the component renders a sticky top bar instead, so stack the bar above the main column (`flex-direction: column`), as in the example.

The brand row at the top of the panel is `--header-height` tall and centers the brand, so the brand lines up with a `TopBar` at the top of the main column. A brand taller than the row makes the row taller.

## Stacking

The sidebar and the narrow bar sit just below kit-ui's overlay layer (`--z-overlay`). `Modal`, `DetailDrawer`, `CommandPalette` and `FlashBanner` cover them, whatever their DOM order. See Stacking in the [theming guide](../theming.md#identity-tokens) for the z tokens.

## Theming

| Property                     | Default                     | Use                              |
| ---------------------------- | --------------------------- | -------------------------------- |
| `--kit-sidebar-accent`       | `var(--accent-blue)`        | The current view's indicator     |
| `--kit-sidebar-current-icon` | `var(--kit-sidebar-accent)` | The current section's icon color |

Set them on an ancestor of the sidebar, such as the app wrapper or `:root`.

The full sidebar and the rail read `--shadow-raised`, so they stand raised under a theme with depth tokens (see [Theming](../theming.md#identity-tokens)). The narrow bar and the drawer stay flat.
