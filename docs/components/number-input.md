# NumberInput

A numeric field built on `TextInput`, so it has the same sizes, border,
sunken fill, focus ring, and invalid and disabled states. The bound value
is a `number`, or `null` while the field is empty; it is never a string.

```svelte
<script lang="ts">
  import { NumberInput } from "@kenn-io/kit-ui";

  let timeout = $state<number | null>(30);
  let ratio = $state<number | null>(0.5);
</script>

<label for="timeout">Timeout in seconds</label>
<NumberInput id="timeout" bind:value={timeout} min={1} max={3600} invalid={timeout === null}>
  {#snippet suffix()}sec{/snippet}
</NumberInput>

<NumberInput bind:value={ratio} min={0} max={1} step={0.1} ariaLabel="Ratio" />
```

## Props

| Prop                                 | Type                              | Default             | Notes                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`                              | `number \| null` (bindable)       | `null`              | `null` while the field holds no digits                                                                                                                                                                 |
| `min` / `max`                        | `number`                          | —                   | Arrow keys stay inside the range; leaving the field clamps a typed value into it. A `min` of 0 or more blocks the minus key                                                                            |
| `step`                               | `number`                          | `1`                 | Arrow-key increment and the grid it snaps to, anchored at `min`. Must be positive                                                                                                                      |
| `placeholder`                        | `string`                          | —                   |                                                                                                                                                                                                        |
| `size`                               | `"sm" \| "md" \| "lg"`            | `"md"`              | Same heights as TextInput                                                                                                                                                                              |
| `invalid`                            | `boolean`                         | `false`             | Red border + `aria-invalid`. The field does not set it on its own: the consumer decides what is invalid                                                                                                |
| `disabled` / `readonly` / `required` | `boolean`                         | `false`             | A read-only field ignores the arrow keys and keeps its value as given, even out of range. A required field also fails form validation while it holds text that is not a number yet, such as a lone `-` |
| `requiredMessage`                    | `string`                          | `"Enter a number."` | Validation message for that case. An empty required field uses the browser's own message                                                                                                               |
| `block`                              | `boolean`                         | `false`             | Stretch to container width                                                                                                                                                                             |
| `id` / `name`                        | `string`                          | —                   | For `<label for>` / forms                                                                                                                                                                              |
| `ariaLabel` / `ariaDescribedby`      | `string`                          | —                   | Name the unit in the label: the `suffix` text is not part of the accessible name                                                                                                                       |
| `autofocus`                          | `boolean`                         | `false`             | Focus on mount                                                                                                                                                                                         |
| `oninput`                            | `(value: number \| null) => void` | —                   | Each time typing or an arrow key changes the number (not on keystrokes that leave it unchanged, such as a trailing `.`)                                                                                |
| `onchange`                           | `(value: number \| null) => void` | —                   | When a change is committed: each arrow step that changes the number, and blur or Enter when the number differs from the one on focus                                                                   |
| `onkeydown`                          | `(event: KeyboardEvent) => void`  | —                   | Runs first; calling `preventDefault()` skips the field's own arrow and Enter handling                                                                                                                  |
| `onblur`                             | `() => void`                      | —                   | After the blur commit                                                                                                                                                                                  |
| `prefix` / `suffix`                  | `Snippet`                         | —                   | TextInput's adornments, e.g. a unit such as `sec` or `px` in `suffix`                                                                                                                                  |
| `inputEl`                            | `HTMLInputElement` (bindable)     | —                   | The underlying input, for focus management                                                                                                                                                             |
| `class`                              | `string`                          | `""`                | Added to the wrapper beside `kit-number-input`                                                                                                                                                         |

## Behavior

- **Typing.** The field accepts digits, one leading minus sign when the
  range reaches below 0 (no `min`, or a negative one), and one decimal
  point when `step`, `min` or `max` has decimal places. The default `step` of 1
  takes integers only. Whitespace around a pasted number is dropped. Any
  other edit, including a paste such as `1,000` or `1 2`, is rejected
  whole. Numbers beyond `Number.MAX_SAFE_INTEGER` are refused, since past
  it the value would no longer match the digits typed; a larger value set
  from outside can still be shortened with Backspace. The decimal
  separator is `.` in every locale.
- **Arrow Up / Arrow Down** step by `step`. A value between grid points
  snaps to the next point in that direction, as native number inputs do.
  An empty field starts at `min` going up and `max` going down (0 when
  that bound is unset). The grid math is exact in decimal, so 0.1 steps
  land on 0.2 and 0.3, even on a grid anchored far from the value. Stepping stays within `Number.MAX_SAFE_INTEGER` in either
  direction, an empty field included; a larger value set from outside
  moves to that limit on the first press toward zero.
- **Leaving the field** (blur, or Enter) clamps the number into
  `min`..`max` and rewrites in-progress text in its canonical form:
  `1.` becomes `1`, `007` becomes `7`, and a lone `-` empties the field.
  Very small and very large values are written out in full (`0.0000001`,
  never `1e-7`), so they stay editable. A value the app sets while the
  field has focus replaces in-progress text the same way.
- **The wheel does nothing**, unlike a native number input that changes
  under a scrolling pointer.

## Implementation notes

The control is `<input type="text" role="spinbutton">` with
`aria-valuenow`, `aria-valuemin` and `aria-valuemax`, not
`type="number"`. A text input has no spinner buttons in any engine, keeps
the typed text readable so the filter can run before an edit lands, and
sizes exactly like TextInput. `inputmode` asks touch keyboards for digits
(`numeric`, or `decimal` when decimals are allowed). A field that takes
negatives uses the full keyboard, since iOS digit keypads have no minus
key.

`kit-ui-check` flags native `type="number"` inputs
(`hand-rolled-number-input`) and points at this component.
