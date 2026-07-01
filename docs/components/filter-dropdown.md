# FilterDropdown

Sectioned filter/sort/menu popover with an active badge, optional search,
per-item counts, bulk actions, and a reset row. Consolidated from middleman's
`FilterDropdown` (sections, floating positioning, reset) and agentsview's
(search, select all/deselect all, counts).

The panel uses viewport-aware fixed positioning (`floatingPopoverStyle`), so it
flips above the trigger near the bottom edge and clamps to the viewport.

```svelte
<script lang="ts">
  import { FilterDropdown } from "@kenn-io/kit-ui";

  let states = $state(new Set(["open"]));
</script>

<FilterDropdown
  label="State"
  badgeCount={states.size}
  sections={[{
    title: "PR state",
    items: options.map((o) => ({
      id: o.id,
      label: o.label,
      color: o.color,
      active: states.has(o.id),
      onSelect: () => toggle(o.id),
    })),
  }]}
  resetLabel="Clear filters"
  onReset={() => (states = new Set())}
/>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | required | Trigger text + aria-label |
| `sections` | `FilterDropdownSection[]` | required | `{ title?, items }` |
| `detail` | `string` | — | Secondary trigger text |
| `active` | `boolean` | `false` | Force the active trigger style |
| `badgeCount` | `number` | `0` | Count badge; also activates the trigger |
| `showBadge` | `boolean` | `true` | |
| `disabled` | `boolean` | `false` | |
| `resetLabel` / `onReset` | | — | Reset row (both required to show) |
| `searchable` | `boolean` | `false` | Text input filtering items across sections |
| `searchPlaceholder` | `string` | `"Search…"` | |
| `onSelectAll` / `onDeselectAll` | `() => void` | — | Bulk action row (either shows it) |
| `selectAllLabel` / `deselectAllLabel` | `string` | `"Select all"` / `"Deselect all"` | |
| `emptyLabel` | `string` | `"No matches"` | Shown when search filters everything out |
| `minWidth` | `string` | `"200px"` | Panel min-width |
| `align` | `"start" \| "end"` | `"start"` | Panel alignment relative to trigger |
| `icon` | `"filter" \| "sort" \| "more"` | `"filter"` | Trigger icon |

## Item shape

```ts
interface FilterDropdownItem {
  id: string;
  label: string;
  active: boolean;        // checked state — you own the selection model
  onSelect: () => void;   // toggle in your state
  description?: string;   // tooltip + aria-describedby
  color?: string;         // dot color when active
  count?: number;         // right-aligned count
  disabled?: boolean;
  closeOnSelect?: boolean; // e.g. sort menus
}
```
