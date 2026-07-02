# Typeahead

Filterable select: the closed state is a trigger button; clicking it swaps in a
search input with a match-highlighted option list. Arrow keys navigate, Enter
selects, Escape closes. Extracted from agentsview's `OptionTypeahead`.

```svelte
<script lang="ts">
  import { Typeahead, type TypeaheadOption } from "@kenn-io/kit-ui";

  let repo = $state("");
  const repos: TypeaheadOption[] = [
    { name: "kenn-io/middleman", label: "kenn-io/middleman", displayLabel: "middleman" },
    { name: "kenn-io/agentsview", label: "kenn-io/agentsview", displayLabel: "agentsview" },
  ];
</script>

<Typeahead
  options={repos}
  value={repo}
  fallbackLabel="All repositories"
  placeholder="Filter repositories…"
  onselect={(v) => (repo = v)}
/>
```

## Props

| Prop            | Type                     | Default        | Notes                                                  |
| --------------- | ------------------------ | -------------- | ------------------------------------------------------ |
| `options`       | `TypeaheadOption[]`      | required       |                                                        |
| `value`         | `string`                 | required       | Matches `option.name`; unmatched shows `fallbackLabel` |
| `fallbackLabel` | `string`                 | required       | Trigger text when nothing is selected                  |
| `placeholder`   | `string`                 | required       | Search input placeholder + aria-label                  |
| `onselect`      | `(name: string) => void` | required       |                                                        |
| `title`         | `string`                 | —              | Trigger tooltip                                        |
| `emptyLabel`    | `string`                 | `"No matches"` |                                                        |
| `disabled`      | `boolean`                | `false`        |                                                        |

## Option shape

```ts
interface TypeaheadOption {
  name: string; // stable value
  label: string; // shown + searched in the list
  displayLabel?: string; // shorter text for the closed trigger
  count?: number;
}
```

## CSS knobs

`--typeahead-min-width` (180px), `--typeahead-max-width` (300px),
`--typeahead-control-height` (26px), `--typeahead-control-padding` (0 8px),
`--typeahead-control-font-size` (var(--font-size-xs)).

## Positioning

The option list is `position: fixed` via `floatingPopoverStyle` (shared
popover contract): it escapes overflow-hidden ancestors, repositions on
scroll/resize/filter changes, and flips above the trigger near the viewport
bottom. Its width pins to the trigger width so long labels truncate instead
of widening the menu — the old `--typeahead-list-min-width` knob is retired
(size the trigger instead).
