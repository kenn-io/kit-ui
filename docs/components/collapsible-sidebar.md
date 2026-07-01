# CollapsibleSidebar + SidebarToggle

Sidebar-plus-main layout from middleman: resizable via a `SplitResizeHandle`
divider, collapsible to a thin strip with an expand toggle. The parent owns the
collapse state and the persisted width.

```svelte
<script lang="ts">
  import { CollapsibleSidebar, SidebarToggle } from "@kenn-io/kit-ui";

  let collapsed = $state(false);
  let width = $state(340);
</script>

<CollapsibleSidebar
  isCollapsed={collapsed}
  showCollapsedStrip
  sidebarWidth={width}
  onSidebarResize={(w) => (width = w)}
  onExpand={() => (collapsed = false)}
>
  {#snippet sidebar()}
    <header>
      Sessions
      <SidebarToggle onclick={() => (collapsed = true)} class="kit-sidebar-toggle--push" />
    </header>
    <SessionList />
  {/snippet}
  <MainContent />
</CollapsibleSidebar>
```

## CollapsibleSidebar props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `sidebar` | `Snippet` | required | Sidebar content |
| `children` | `Snippet` | — | Main-area content |
| `trailing` | `Snippet` | — | Rendered after the main area (right rail) |
| `isCollapsed` | `boolean` | `false` | |
| `hideSidebar` | `boolean` | `false` | Remove entirely (no strip) |
| `showCollapsedStrip` | `boolean` | `false` | Thin strip with expand toggle when collapsed |
| `sidebarWidth` | `number` | `340` | Committed width; drags call back through `onSidebarResize` |
| `minSidebarWidth` / `maxSidebarWidth` | `number` | `200` / `600` | Drag clamps |
| `sidebarOnly` | `boolean` | `false` | Sidebar fills the layout |
| `hasMain` | `boolean` | `true` | |
| `mainEmpty` | `boolean` | `false` | Center placeholder content |
| `mainOverflow` | `"auto" \| "hidden"` | `"auto"` | |
| `overlayOnNarrow` | `boolean` | `false` | Below the shared `wide` breakpoint (900px), the expanded sidebar floats over the main area instead of squeezing it |
| `onSidebarResize` | `(width: number) => void` | — | Fires on drag end / arrow-key resize; persist this |
| `onExpand` | `() => void` | — | Collapsed-strip toggle clicked |

## SidebarToggle props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `state` | `"expanded" \| "collapsed"` | `"expanded"` | Picks icon + accessible label ("Collapse sidebar" / "Expand sidebar") |
| `label` | `string` | `"sidebar"` | The thing being toggled |
| `onclick` | `(event: MouseEvent) => void` | — | |
| `class` | `ClassValue` | — | Helpers: `kit-sidebar-toggle--compact` (22px), `kit-sidebar-toggle--push` (margin-left auto) |
