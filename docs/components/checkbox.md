# Checkbox

middleman's `TreeCheckbox` recipe, consolidated: a 16px drawn box layered
over a real focusable `<input type="checkbox">`, accent-blue fill, and a
surface-colored SVG check (the solid-button ink discipline, so it clears
contrast in both modes). Unlike the original, the input is keyboard
focusable and carries the shared focus ring on the drawn box.

```svelte
<script lang="ts">
  import { Checkbox } from "@kenn-io/kit-ui";

  let subscribed = $state(false);
</script>

<Checkbox bind:checked={subscribed} label="Subscribe to run alerts" />
```

## Props

- `checked` — bindable boolean.
- `indeterminate` — draws the tri-state dash for "some children selected"
  parents. Purely visual on top of `checked`; the consumer owns the state
  (toggling the parent resolves it), mirroring TreeCheckbox's controlled
  tri-state.
- `label` — plain-text label after the box; `children` renders rich label
  content instead (both live in the wrapping `<label>`, so the whole row
  toggles). Don't put links or buttons in the label — nested interactive
  content inside a `<label>` is invalid.
- Form contract: `name`, `value` (submitted when checked, native default
  "on"), `required` (native constraint validation), `id` — the underlying
  element is a real `<input type="checkbox">`, so submission, validation,
  and form association via the surrounding `<form>` behave natively.
- `disabled`, `ariaLabel` (for boxes with no visible label),
  `ariaDescribedby` (hint/error text), `onchange(checked)`, `class`.

## Focus

The input is invisible, so keyboard focus is delegated: the drawn box
carries `outline: var(--focus-ring)`, and under high contrast the ring
widens to 3px/2px offset to mirror the global `:focus-visible` rule.

## Theming

The box follows the identity tokens: radius is `min(var(--radius-sm), 5px)`
(capped so pebble's 10px corners can't blob a 16px box; zero in
terminal/zine), edge is `max(1.5px, var(--border-width))`, the check stroke
follows `--icon-stroke`, and the fill/press/motion use the shared accent,
`--press-transform`, and easing tokens.

## Related

`Toggle` (on/off switch) for boolean settings; `FilterDropdown` for
multi-select option lists (it draws its own row checks).
