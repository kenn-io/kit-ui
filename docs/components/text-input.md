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
| `prefix` / `suffix` | `Snippet` | — | Adornments inside the border (icon, unit, kbd, button). Interactive suffix actions must handle `disabled` themselves — the wrapper only dims |
| `inputEl` | `HTMLInputElement` (bindable) | — | The underlying input, for focus management |
| `class` | `string` | `""` | |

Focus renders as an `--accent-blue` border on the wrapper
(`:focus-within`), invalid as `--accent-red`; both follow the FindBar card
convention. The native webkit search-cancel button is suppressed — the
wrapper owns the clear affordance.

## SearchInput props

Forwarded from TextInput: `value`, `placeholder`, `size`, `invalid`,
`disabled`, `readonly`, `block`, `autofocus`, `id`, `name`, `ariaLabel`
(default `"Search"`), `oninput`, `onchange`, `onkeydown`. (`type`,
`prefix`, and `suffix` are owned by SearchInput.) Plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `keys` | `string[]` | — | Shortcut hint (`KbdBadge`) shown while empty, e.g. `["⌘", "K"]` |
| `onclear` | `() => void` | — | After the clear button or Escape empties the field |
| `clearLabel` | `string` | `"Clear search"` | Clear button label |

Clearing behavior: the clear button only renders with content on an
enabled, non-readonly field (disabled fields can't be mutated through it),
and clearing — by click or Escape — returns focus to the input so keyboard
users aren't dropped when the button unmounts. Escape with content clears
and **stops propagation** — a search-in-modal clears before the modal's
Escape-to-close fires; a second Escape reaches the modal.

## Where NOT to use it

- `FindBar`, `Typeahead`, `SelectDropdown` keep their own inputs — they're
  comboboxes/cards with their own ARIA wiring and chrome ownership.
- `RangePicker`'s custom tab uses native `type="date"` inputs (native
  pickers beat styled text fields for dates).
- `FilterDropdown`'s search box uses `SearchInput` internally (`size="sm"
  block`).
