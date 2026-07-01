# IconButton

Square ghost button for a lone icon — the toolbar/header workhorse both apps
kept hand-rolling (`.icon-btn`). Transparent at rest, surface tint on hover,
`aria-label` required because an icon has no accessible name of its own.

```svelte
<script lang="ts">
  import { IconButton } from "@kenn-io/kit-ui";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
</script>

<IconButton ariaLabel="Sync" onclick={sync}>
  <RefreshCwIcon size="14" strokeWidth="2" aria-hidden="true" />
</IconButton>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `ariaLabel` | `string` | required | Accessible name; also the native `title` unless overridden |
| `title` | `string` | `ariaLabel` | Native title — **mouse-hover only** (no keyboard/touch affordance). Wrap in [Tooltip](tooltip.md) or use visible text when the icon's meaning isn't conventional |
| `size` | `"sm" \| "md"` | `"md"` | 24px / 28px square (a size-13/14 icon fits both) |
| `tone` | `"neutral" \| "success" \| "danger" \| "info" \| "workflow"` | `"neutral"` | Accent applied on hover + pressed; rest state stays muted |
| `disabled` | `boolean` | `false` | |
| `ariaExpanded` | `boolean` | — | Expanded state for menu/popover triggers |
| `ariaHaspopup` | `"menu" \| "listbox" \| "dialog" \| "grid" \| "tree" \| boolean` | — | Popup kind for menu/popover triggers |
| `ariaControls` | `string` | — | id of the controlled element (pairs with `ariaExpanded`) |
| `ariaPressed` | `boolean` | — | For toggles; `true` renders the inset pressed look |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | |
| `onclick` | `(event: MouseEvent) => void` | — | |
| `children` | `Snippet` | required | The icon (mark it `aria-hidden="true"`) |
| `class` | `string` | `""` | |

## Notes

- Use `Button` (with a `label`) when the action has text; IconButton is only
  for icon-only affordances where space is constrained and the meaning is
  conventional (settings gear, close X, sync arrows).
- Focus is a 2px `--accent-blue` outline on `:focus-visible` only.
- For a labelled action that degrades to icon-only under pressure, prefer
  [FitStages](fit-stages.md) with a `Button` stage and an `IconButton`
  stage.

Checker: `hand-rolled-icon-button` flags `icon-btn` / `icon-button` class
names in consuming projects.
