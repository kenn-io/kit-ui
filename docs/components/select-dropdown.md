# SelectDropdown

Accessible single-select combobox (ARIA `combobox` + `listbox`) with full
keyboard navigation: arrows move the highlight, Enter/Space selects, Escape
closes and refocuses the trigger. Extracted from middleman.

```svelte
<script lang="ts">
  import { SelectDropdown, type SelectDropdownOption } from "@kenn-io/kit-ui";

  let sort = $state("updated");
  const options: SelectDropdownOption[] = [
    { value: "updated", label: "Recently updated" },
    { value: "created", label: "Newest" },
    { value: "rebase", label: "Rebase and merge", triggerLabel: "Rebase", disabled: true },
  ];
</script>

<SelectDropdown value={sort} {options} title="Sort" onchange={(v) => (sort = v)} />
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | required | Selected option value |
| `options` | `SelectDropdownOption[]` | required | |
| `onchange` | `(value: string) => void` | required | |
| `title` | `string` | — | Prefix for the accessible trigger label ("Sort: Newest") and tooltip |
| `disabled` | `boolean` | `false` | |
| `align` | `"start" \| "end"` | `"start"` | Menu edge aligned with the trigger. Keep `start` — the menu already clamps to the viewport and flips above when out of room; use `end` only for triggers hugging the right screen edge |
| `class` | `string` | `""` | |

The menu is `position: fixed` and positioned per open (and on scroll/resize),
so it is never clipped by an overflow-hidden ancestor.

## Option shape

```ts
interface SelectDropdownOption {
  value: string;
  label: string;
  triggerLabel?: string; // shorter label for the closed trigger
  disabled?: boolean;
}
```

**Gotcha:** unlike a native `<select>`, an unmatched `value` does not render
blank — the trigger falls back to the first option. If you feed `options` from
a filtered/async list, keep `value` consistent with the visible options.
