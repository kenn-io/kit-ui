# SegmentedControl

Inline value selector (the "All / PRs / Issues" pattern middleman repeated as
`segmented-control`/`seg-btn` markup in ActivityFeed, ActivitySettings, and the
repo browser). Radio-group semantics: arrow keys move the selection with roving
focus.

```svelte
<script lang="ts">
  import { SegmentedControl } from "@kenn-io/kit-ui";

  let filter = $state("all");
</script>

<SegmentedControl
  options={[
    { value: "all", label: "All" },
    { value: "prs", label: "PRs" },
    { value: "issues", label: "Issues" },
  ]}
  value={filter}
  onchange={(v) => (filter = v)}
  ariaLabel="Item filter"
/>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `options` | `SegmentedControlOption[]` | required | `{ value, label, title?, disabled? }` |
| `value` | `string` | required | Selected option value |
| `onchange` | `(value: string) => void` | required | Not called when the active segment is re-clicked |
| `ariaLabel` | `string` | — | Group label for screen readers |
| `block` | `boolean` | `false` | Fill the container, segments share space equally (use for compact/mobile toolbars) |
| `disabled` | `boolean` | `false` | Disables the whole group |
| `class` | `string` | `""` | |

Use SegmentedControl for 2–5 mutually exclusive views; for longer lists use
`SelectDropdown`.
