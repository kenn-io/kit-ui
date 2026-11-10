# FilterDropdown

Sectioned filter/sort/menu popover with an active badge, optional search,
per-item counts, bulk actions, and a reset row. Consolidated from Forge's
`FilterDropdown` (sections, floating positioning, reset) and agentsview's
(search, select all/deselect all, counts).

The panel uses viewport-aware fixed positioning (`floatingPopoverStyle`), so it
flips above the trigger near the bottom edge and clamps to the viewport.

The trigger exposes `aria-expanded`: `true` while the panel is open, `false`
otherwise.

```svelte
<script lang="ts">
  import { FilterDropdown } from "@kenn-io/kit-ui";

  let states = $state(new Set(["open"]));
</script>

<FilterDropdown
  label="State"
  badgeCount={states.size}
  sections={[
    {
      title: "PR state",
      items: options.map((o) => ({
        id: o.id,
        label: o.label,
        color: o.color,
        active: states.has(o.id),
        onSelect: () => toggle(o.id),
      })),
    },
  ]}
  resetLabel="Clear filters"
  onReset={() => (states = new Set())}
/>
```

## Props

| Prop                                  | Type                           | Default                           | Notes                                      |
| ------------------------------------- | ------------------------------ | --------------------------------- | ------------------------------------------ |
| `label`                               | `string`                       | required                          | Trigger text + aria-label                  |
| `sections`                            | `FilterDropdownSection[]`      | required                          | `{ title?, items }`                        |
| `detail`                              | `string`                       | —                                 | Secondary trigger text                     |
| `active`                              | `boolean`                      | `false`                           | Force the active trigger style             |
| `badgeCount`                          | `number`                       | `0`                               | Count badge; also activates the trigger    |
| `showBadge`                           | `boolean`                      | `true`                            |                                            |
| `disabled`                            | `boolean`                      | `false`                           |                                            |
| `resetLabel` / `onReset`              |                                | —                                 | Reset row (both required to show)          |
| `searchable`                          | `boolean`                      | `false`                           | Text input filtering items across sections |
| `searchPlaceholder`                   | `string`                       | `"Search…"`                       |                                            |
| `onSelectAll` / `onDeselectAll`       | `() => void`                   | —                                 | Bulk action row (either shows it)          |
| `selectAllLabel` / `deselectAllLabel` | `string`                       | `"Select all"` / `"Deselect all"` |                                            |
| `emptyLabel`                          | `string`                       | `"No matches"`                    | Shown when search filters everything out   |
| `excludedLabel`                       | `string`                       | `"excluded"`                      | Screen-reader text on an excluded row      |
| `minWidth`                            | `string`                       | `"200px"`                         | Panel min-width                            |
| `align`                               | `"start" \| "end"`             | `"start"`                         | Panel alignment relative to trigger        |
| `icon`                                | `"filter" \| "sort" \| "more"` | `"filter"`                        | Trigger icon                               |
| `onOpenChange`                        | `(open: boolean) => void`      | —                                 | Called when the panel opens or closes      |

## Item shape

```ts
interface FilterDropdownItem {
  id: string;
  label: string;
  active: boolean; // checked state — you own the selection model
  excluded?: boolean; // filters the option out: a red cross instead of the tick
  onSelect: () => void; // toggle in your state
  description?: string; // tooltip + aria-describedby
  color?: string; // dot color when active
  count?: number; // right-aligned count
  disabled?: boolean;
  closeOnSelect?: boolean; // e.g. sort menus
  detail?: string; // value summary at the row's end, e.g. "2 selected"
  submenu?: Snippet; // flyout content; the row opens it instead of calling onSelect
}
```

## Excluded rows

A row can filter its option out as well as in. Set `excluded` instead of
`active` and the row shows a red cross where an active row shows a tick, stays
undimmed, and appends `excludedLabel` to its accessible name. `aria-pressed` is
`true` for both active and excluded rows. The component stores no state: cycle
neutral, active, excluded in `onSelect`. Rows that never set `excluded` are
plain on/off toggles.

## Submenu rows

An item with `submenu` shows a chevron and opens its snippet in a flyout
beside the panel, right side first, flipping left when the viewport is too
narrow. The row exposes `aria-haspopup="dialog"` and `aria-expanded`; the
flyout is a `role="dialog"` named by the row label. Opening moves focus to the
flyout's first tabbable control. Clicking the row again, Escape, or ArrowLeft
outside a text field closes the flyout and returns focus to the row; a second
Escape closes the panel. ArrowRight on the row opens it. Clicks inside the
flyout count as inside the dropdown. Its `onSelect` is never called, so pass a
no-op. The snippet owns its own selection model.
