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

| Prop                                  | Type                      | Default       | Notes                                                                                                              |
| ------------------------------------- | ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `sidebar`                             | `Snippet`                 | required      | Sidebar content                                                                                                    |
| `children`                            | `Snippet`                 | —             | Main-area content                                                                                                  |
| `trailing`                            | `Snippet`                 | —             | Rendered after the main area (right rail)                                                                          |
| `isCollapsed`                         | `boolean`                 | `false`       |                                                                                                                    |
| `hideSidebar`                         | `boolean`                 | `false`       | Remove entirely (no strip)                                                                                         |
| `showCollapsedStrip`                  | `boolean`                 | `false`       | Thin strip with expand toggle when collapsed                                                                       |
| `sidebarWidth`                        | `number`                  | `340`         | Committed width; drags call back through `onSidebarResize`                                                         |
| `minSidebarWidth` / `maxSidebarWidth` | `number`                  | `200` / `600` | Drag clamps                                                                                                        |
| `sidebarOnly`                         | `boolean`                 | `false`       | Sidebar fills the layout                                                                                           |
| `hasMain`                             | `boolean`                 | `true`        |                                                                                                                    |
| `mainEmpty`                           | `boolean`                 | `false`       | Center placeholder content                                                                                         |
| `mainOverflow`                        | `"auto" \| "hidden"`      | `"auto"`      |                                                                                                                    |
| `overlayOnNarrow`                     | `boolean`                 | `false`       | Below the shared `wide` breakpoint (900px), the expanded sidebar floats over the main area instead of squeezing it |
| `overlay`                             | `boolean \| undefined`    | `undefined`   | Host-driven overlay override; when set it wins over `overlayOnNarrow`'s media query (see below)                    |
| `onSidebarResize`                     | `(width: number) => void` | —             | Fires on drag end / arrow-key resize; persist this                                                                 |
| `onExpand`                            | `() => void`              | —             | Collapsed-strip toggle clicked                                                                                     |

### Overlay drivers

The floating-overlay presentation (expanded sidebar absolutely positioned over
the main area, `min(100%, 390px)` wide, elevated with `--shadow-lg`) has two
drivers:

- **Viewport (default):** `overlayOnNarrow` emits `kit-sidebar-layout--overlay-narrow`,
  whose styles sit behind a pure `@media (max-width: 900px)` query (the shared
  `wide` breakpoint) — no JS involved, so it applies before hydration.
- **Host signal:** pass `overlay` when the app's narrow signal is something
  other than the viewport — e.g. a measured container width in an embedded
  pane or split-pane layout. `overlay={true}` emits `kit-sidebar-layout--overlay`
  (same presentation, any viewport width), `overlay={false}` suppresses the
  overlay entirely (including `overlayOnNarrow`'s media query), and
  `undefined` leaves the media query in charge. Do not re-implement the
  overlay styles app-side against kit's BEM classes; derive a boolean and
  pass it in.

```svelte
<CollapsibleSidebar overlay={containerWidth < 500} isCollapsed={collapsed} …></CollapsibleSidebar>
```

While overlaying, the resize handle is hidden: the overlay forces the sidebar
to `min(100%, 390px)`, so dragging could change only the persisted width,
invisibly. The overlay also only engages when there is a main area to float
over — with `sidebarOnly` or `hasMain={false}` the sidebar fills the layout
and both drivers are ignored.

## SidebarToggle props

| Prop      | Type                          | Default      | Notes                                                                                        |
| --------- | ----------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `state`   | `"expanded" \| "collapsed"`   | `"expanded"` | Picks icon + accessible label ("Collapse sidebar" / "Expand sidebar")                        |
| `label`   | `string`                      | `"sidebar"`  | The thing being toggled                                                                      |
| `onclick` | `(event: MouseEvent) => void` | —            |                                                                                              |
| `class`   | `ClassValue`                  | —            | Helpers: `kit-sidebar-toggle--compact` (22px), `kit-sidebar-toggle--push` (margin-left auto) |
