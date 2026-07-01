# TextInput / SearchInput

The bordered text-field primitives. `TextInput` is the base: a wrapper that
carries all chrome (border, focus, invalid state) around a chromeless input,
sized to the shared toolbar control heights. `SearchInput` is TextInput
preconfigured for filtering: search-icon prefix, a clear button that appears
with content, and an optional shortcut hint while empty.

```svelte
<script lang="ts">
  import { SearchInput, TextInput } from "@kenn-io/kit-ui";

  let name = $state("");
  let query = $state("");
</script>

<TextInput bind:value={name} placeholder="Display name" />
<SearchInput bind:value={query} keys={["⌘", "K"]} block />
```

## TextInput props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` (bindable) | `""` | |
| `type` | `"text" \| "search" \| "email" \| "url" \| "password" \| "tel"` | `"text"` | Text-like types only; date/checkbox/etc. keep native chrome elsewhere |
| `placeholder` | `string` | — | |
| `size` | `"sm" \| "md"` | `"md"` | 24px / 28px tall — matches Button/IconButton heights |
| `invalid` | `boolean` | `false` | Red border + `aria-invalid` |
| `disabled` / `readonly` | `boolean` | `false` | |
| `block` | `boolean` | `false` | Stretch to container width (default is a 180px inline field) |
| `id` / `name` | `string` | — | For `<label for>` / forms |
| `ariaLabel` | `string` | — | Required in spirit when no `<label>` is associated |
| `autofocus` | `boolean` | `false` | Focus on mount |
| `autocomplete` | `string` | — | |
| `oninput` / `onchange` | `(value: string) => void` | — | Called with the new value |
| `onkeydown` | `(event: KeyboardEvent) => void` | — | |
| `prefix` / `suffix` | `Snippet` | — | Adornments inside the border (icon, unit, kbd, button) |
| `class` | `string` | `""` | |

Focus renders as an `--accent-blue` border on the wrapper
(`:focus-within`), invalid as `--accent-red`; both follow the FindBar card
convention. The native webkit search-cancel button is suppressed — the
wrapper owns the clear affordance.

## SearchInput props

Everything sizing/state-related above, plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `keys` | `string[]` | — | Shortcut hint (`KbdBadge`) shown while empty, e.g. `["⌘", "K"]` |
| `onclear` | `() => void` | — | After the clear button or Escape empties the field |
| `clearLabel` | `string` | `"Clear search"` | Clear button label |

Escape with content clears the field and **stops propagation** — so a
search-in-modal clears before the modal's own Escape-to-close fires; a
second Escape reaches the modal.

## Where NOT to use it

- `FindBar`, `Typeahead`, `SelectDropdown` keep their own inputs — they're
  comboboxes/cards with their own ARIA wiring and chrome ownership.
- `RangePicker`'s custom tab uses native `type="date"` inputs (native
  pickers beat styled text fields for dates).
- `FilterDropdown`'s search box uses `SearchInput` internally (`size="sm"
  block`).
