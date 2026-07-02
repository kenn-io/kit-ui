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

| Prop        | Type                                         | Default   | Notes                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`   | `SegmentedControlOption[]`                   | required  | `{ value, label, title?, disabled?, tone? }`                                                                                                                                                                                                                                                                                                                                                                        |
| `value`     | `string`                                     | required  | Selected option value                                                                                                                                                                                                                                                                                                                                                                                               |
| `onchange`  | `(value: string) => void`                    | required  | Not called when the active segment is re-clicked                                                                                                                                                                                                                                                                                                                                                                    |
| `ariaLabel` | `string`                                     | —         | Group label for screen readers                                                                                                                                                                                                                                                                                                                                                                                      |
| `segment`   | `Snippet<[SegmentedControlOption, boolean]>` | —         | Custom segment content (icons, counts) rendered instead of the label text; receives the option and whether it is active. `option.label` becomes the button's `aria-label` so icon-only segments keep an accessible name                                                                                                                                                                                             |
| `block`     | `boolean`                                    | `false`   | Fill the container, segments share space equally (use for compact/mobile toolbars)                                                                                                                                                                                                                                                                                                                                  |
| `variant`   | `"boxed" \| "borderless"`                    | `"boxed"` | boxed = inset pad with a floating surface pill. borderless = flat strip (agentsview transcript-strip style): flush segments sharing hairline borders, active segment accent-tinted. Each segment draws its own border, so the selection's accent-tinted border applies to its stretch of the control's edge instead of a uniform grey outer line fighting the tinted pill — the same fixup as the Modal tone header |
| `disabled`  | `boolean`                                    | `false`   | Disables the whole group                                                                                                                                                                                                                                                                                                                                                                                            |
| `class`     | `string`                                     | `""`      |                                                                                                                                                                                                                                                                                                                                                                                                                     |

Use SegmentedControl for 2–5 mutually exclusive views; for longer lists use
`SelectDropdown`.

## Per-segment tones

`option.tone` (`"info" | "success" | "warning" | "danger"`,
`SegmentedControlTone`) gives a segment its own semantic accent — the
status-filter pattern where "Passing / Flaky / Failing" each carry their
color:

- **Borderless variant**: a toned segment tints its ink and border (30%
  tone mix) even while inactive; when active it takes the full band
  (12% background, 72%-mixed ink, 30%-mixed border — the Modal band
  recipes). Untoned segments stay grey and take the default accent when
  active.
- **Boxed variant**: tone tints the active pill's ink; the inset pad
  chrome is otherwise unchanged.

Shared-edge precedence in the flat strip: the **active** segment's border
wins both of its edges (it overlays its left neighbor's edge); between
two inactive segments the **leftmost** one's right border owns the shared
edge — so a toned segment's color reaches exactly to its right edge and
no further.

## Snippet segments

The `segment` snippet renders custom content — icons, counts, icon+text —
inside each button in place of the label text (both variants; buttons lay
out as flex with a small gap):

```svelte
<SegmentedControl options={viewOptions} value={view} onchange={(v) => (view = v)} ariaLabel="View">
  {#snippet segment(option, active)}
    {@const Icon = viewIcons[option.value]}
    <Icon size="12" strokeWidth="2" aria-hidden="true" />
    {option.label}
  {/snippet}
</SegmentedControl>
```

`option.label` stays required: with a snippet it is applied as the
button's `aria-label`, so icon-only segments keep an accessible name
(pair with `option.title` for a pointer tooltip). Mark decorative icons
`aria-hidden`.
