# ColorInput

Color field with three ways in: a well that opens the platform color picker,
a hex text field, and optional quick-pick swatches. Use it wherever users
choose a color, instead of a bare `<input type="color">`, which renders
unthemed platform chrome and offers no hex entry (`kit-ui-check` flags it as
`hand-rolled-color-input`).

```svelte
<script lang="ts">
  import { ColorInput } from "@kenn-io/kit-ui";

  let accent = $state("#0072b2");
  const swatches = [
    { value: "#0072b2", label: "Blue" },
    { value: "#e69f00", label: "Orange" },
  ];
</script>

<ColorInput bind:value={accent} ariaLabel="Accent color" {swatches} />
```

## Props

| Prop              | Type                          | Default               | Notes                                                                                           |
| ----------------- | ----------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `value`           | `string`                      | `"#000000"`           | Bindable. Read as any hex; written back as lowercase `#rrggbb`                                  |
| `onchange`        | `(value: string) => void`     | —                     | Every pick: live while the native picker is open, on a swatch click, and on a committed hex     |
| `swatches`        | `readonly ColorInputSwatch[]` | `[]`                  | `{ value, label }` quick picks; `label` is the swatch's accessible name and tooltip             |
| `ariaLabel`       | `string`                      | —                     | Names the whole control (`role="group"`)                                                        |
| `pickerLabel`     | `string`                      | `"Open color picker"` | Accessible name of the well                                                                     |
| `hexLabel`        | `string`                      | `"Hex color"`         | Accessible name of the hex field; when `id` is set, the external `<label for>` names it instead |
| `invalid`         | `boolean`                     | `false`               | Red field border and `aria-invalid`, for app-side problems such as low contrast                 |
| `ariaDescribedby` | `string`                      | —                     | Points the well and the field at the app's explanation                                          |
| `size`            | `"sm" \| "md"`                | `"md"`                | 24px or 28px tall, matching TextInput                                                           |
| `disabled`        | `boolean`                     | `false`               |                                                                                                 |
| `id`              | `string`                      | —                     | id of the hex field, for an external `<label for>`                                              |
| `class`           | `string`                      | —                     | Passthrough                                                                                     |

## Behavior

- The hex field accepts 3 or 6 digits with or without `#`. It commits on
  Enter or blur. Text that is not a hex color marks the field invalid and
  leaves `value` unchanged until the user types again.
- A new `value` from the parent, such as a reset, replaces any text the user
  was typing.
- The current swatch carries `aria-pressed="true"` and a ring, so the state
  reads without color vision.

## Contrast is the app's call

ColorInput does not judge colors, because only the app knows the surface a
color will sit on. Measure the pick with the
[contrast helpers](../utilities.md#color-contrast), then pass `invalid` and an
`ariaDescribedby` that explains the problem:

```svelte
<script lang="ts">
  import { ColorInput, contrastRatio, WCAG_AA_TEXT } from "@kenn-io/kit-ui";

  let ink = $state("#f0e442");
  const ratio = $derived(contrastRatio(ink, "#ffffff"));
</script>

<ColorInput bind:value={ink} invalid={ratio < WCAG_AA_TEXT} ariaDescribedby="ink-hint" />
<p id="ink-hint">{ratio.toFixed(1)}:1 on white</p>
```
