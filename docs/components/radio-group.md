# RadioGroup

A short list of mutually exclusive choices for forms and dialogs: a
`<fieldset>` whose `<legend>` names the group, then one option per line.
Each option is a real `<input type="radio">` under a drawn mark that
follows [Checkbox](checkbox.md)'s recipe (16px, same edge, fill, hover,
press, focus ring, and disabled dimming), drawn round with a
surface-colored centre dot when chosen.

```svelte
<script lang="ts">
  import { RadioGroup } from "@kenn-io/kit-ui";

  let channel = $state("stable");
</script>

<RadioGroup
  legend="Update channel"
  options={[
    { value: "stable", label: "Stable" },
    { value: "beta", label: "Beta" },
    { value: "nightly", label: "Nightly" },
  ]}
  bind:value={channel}
/>
```

## Props

| Prop              | Type                      | Default     | Notes                                                                                  |
| ----------------- | ------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `options`         | `RadioGroupOption[]`      | required    | `{ value, label, disabled? }`                                                          |
| `legend`          | `string`                  | required    | The group's visible name, rendered as the legend                                       |
| `value`           | `string \| undefined`     | `undefined` | Bindable. `undefined` leaves every option unchosen                                     |
| `onchange`        | `(value: string) => void` | —           | Called with the newly chosen value; choosing the current option again does not call it |
| `name`            | `string`                  | unique id   | Shared input name. Set it when the group submits with a `<form>`                       |
| `required`        | `boolean`                 | `false`     | Native constraint validation: the form won't submit with no choice                     |
| `disabled`        | `boolean`                 | `false`     | Disables the whole group (the native `fieldset` attribute) and dims the legend with it |
| `id`              | `string`                  | —           | Id of the fieldset                                                                     |
| `ariaDescribedby` | `string`                  | —           | Points the fieldset at hint or error text                                              |
| `class`           | `string`                  | `""`        |                                                                                        |

`option.disabled` disables one option and dims it.

## Keyboard

The inputs are native radios sharing one `name`, so the browser supplies
the keyboard model: Tab enters the group at the chosen option (or the
first one when nothing is chosen), the arrow keys move the choice and
skip disabled options, and Space chooses the focused option.

The invisible input is stretched over the whole label as the hit target,
so the label text, the mark, and test drivers' clicks all land on it.

## Focus

As in Checkbox, the drawn mark carries `outline: var(--focus-ring)`, and
under high contrast the ring widens to 3px with a 2px offset to mirror the
global `:focus-visible` rule.

## When to use

Use RadioGroup for 2–4 exclusive choices inside a form or dialog, where
each option deserves its own line. For a compact inline view switcher use
[SegmentedControl](segmented-control.md); for longer lists use
[SelectDropdown](select-dropdown.md); for a single on/off choice use
[Checkbox](checkbox.md) or [Toggle](toggle.md).
