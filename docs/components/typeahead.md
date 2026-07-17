# Typeahead

Filterable select: the closed state is a trigger button; clicking it swaps in a
search input with a match-highlighted option list. Arrow keys navigate, Enter
selects, Escape closes. Extracted from agentsview's `OptionTypeahead`;
extended with middleman's `TypeaheadTrigger` features (clear row, custom
values, veto, meta text) and grouped options.

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
  onselect={(v) => {
    repo = v;
  }}
/>
```

## Props

| Prop            | Type                                                            | Default         | Notes                                                                                                   |
| --------------- | --------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `options`       | `TypeaheadOption[]`                                             | required        |                                                                                                         |
| `value`         | `string`                                                        | required        | Matches `option.name`; unmatched shows `fallbackLabel`                                                  |
| `fallbackLabel` | `string`                                                        | required        | Trigger text when nothing is selected                                                                   |
| `placeholder`   | `string`                                                        | required        | Search input placeholder + aria-label                                                                   |
| `onselect`      | `(name: string) => void \| boolean \| Promise<void \| boolean>` | required        | Return `false` (or throw) to veto: the list stays open                                                  |
| `title`         | `string`                                                        | —               | Trigger tooltip                                                                                         |
| `emptyLabel`    | `string`                                                        | `"No matches"`  |                                                                                                         |
| `disabled`      | `boolean`                                                       | `false`         |                                                                                                         |
| `allowClear`    | `boolean`                                                       | `false`         | Prepends a row that selects `""`                                                                        |
| `clearLabel`    | `string`                                                        | `"None"`        | Label of the clear row                                                                                  |
| `allowCustom`   | `boolean`                                                       | `false`         | Offers a trimmed non-empty query that is not an exact option name, including when partial matches exist |
| `customLabel`   | `string`                                                        | `Use "{query}"` | Label of the custom-value row; `{query}` is replaced with the trimmed query                             |
| `placement`     | `"auto" \| "top" \| "bottom"`                                   | `"auto"`        | Force the list above/below; auto flips near the viewport bottom                                         |
| `triggerPrefix` | `string`                                                        | —               | Dim text before the value on the closed trigger                                                         |
| `loading`       | `boolean`                                                       | `false`         | Replaces option rows with `loadingLabel` (async sources)                                                |
| `loadingLabel`  | `string`                                                        | `"Loading…"`    |                                                                                                         |
| `error`         | `string`                                                        | —               | Error row above the options, which stay selectable (clear it in `onselect`)                             |
| `header`        | `Snippet`                                                       | —               | Rendered inside the popover above the options (e.g. a Branches/Tags tab switcher)                       |

## Option shape

```ts
interface TypeaheadOption {
  name: string; // stable value; must be unique across the whole tree
  label: string; // shown + searched in the list
  displayLabel?: string; // shorter text for the closed trigger
  count?: number;
  meta?: string; // secondary text: searched, rendered dim at the row's end
  children?: TypeaheadOption[]; // makes this a non-selectable expand/collapse group
  expanded?: boolean; // initial expansion for a group (default true)
}
```

## Grouped options

Give an option `children` to render it as a group row. Groups expand and
collapse instead of selecting: Enter and click toggle them, ArrowRight
expands, ArrowLeft collapses (or, on a leaf, jumps to the parent row). While
filtering, groups are forced open and shown only when they or a descendant
match; a group whose own label matches keeps all its descendants. When any
option has children the list uses `role="tree"` semantics
(`treeitem`/`aria-expanded`/`aria-level`) instead of a flat listbox.

## Veto and error rows

`onselect` may return `false` (or a promise of `false`), or throw, to keep
the list open — use this to reject a value and surface a message through the
`error` prop without losing the user's query. The error renders as a
`role="alert"` row _above_ the options, which stay visible and selectable —
the user's retry is what lets you clear the error. `error` is caller-owned:
the component never sets or clears it, so clear it yourself on the next
attempt (the demo resets it at the top of `onselect`) to avoid a menu stuck
on a stale error row. `loading` covers async option sources (e.g. refetching
after a `header` tab switch).

While a `loading` status row is showing it stands in for the options: arrow
keys and Enter are inert (Escape still closes), and `aria-activedescendant`
is dropped so nothing hidden is announced as active.

Escape closes the list from any focused descendant — the input or a
focusable `header` control — consuming the event so a parent overlay does
not also close (a header control that already handled Escape, e.g. a
SearchInput clearing its text, wins). Keyboard-driven closes (Escape,
selection) return focus to the trigger; closes caused by focus leaving the
component do not steal focus back.

Enter always commits exactly the row `aria-activedescendant` names — the
clear row clears even while filtering, and a custom value (`allowCustom`)
appears as a real "Use \"query\"" row whenever the query is not an exact option
name, including alongside partial matches, instead of being hidden Enter
behavior. Screen-reader users are therefore never told one row is active while
Enter selects another. Concurrent async `onselect` calls are
ordered: only the latest attempt may close the list, so a slow earlier
selection can't dismiss a newer veto/error.

## CSS knobs

`--typeahead-min-width` (180px), `--typeahead-max-width` (300px),
`--typeahead-control-height` (26px), `--typeahead-control-padding` (0 8px),
`--typeahead-control-font-size` (var(--font-size-xs)).

## Positioning

The option list is `position: fixed` via `floatingPopoverStyle` (shared
popover contract): it escapes overflow-hidden ancestors, repositions on
scroll/resize/filter changes, and flips above the trigger near the viewport
bottom (override with `placement`). Its width pins to the trigger width so
long labels truncate instead of widening the menu — the old
`--typeahead-list-min-width` knob is retired (size the trigger instead).
