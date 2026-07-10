# Toggle

The on/off switch from middleman's diff toolbar, consolidated: a 36×20
track with a 16px knob on a 2px inset and 16px of travel, accent-blue when
on. Built on a real `<input type="checkbox" role="switch">` so it carries
form semantics, `bind:checked`, and the shared focus ring (drawn on the
track).

```svelte
<script lang="ts">
  import { Toggle } from "@kenn-io/kit-ui";

  let notifications = $state(true);
</script>

<Toggle bind:checked={notifications} label="Desktop notifications" />
```

## Props

- `checked` — bindable boolean.
- `label` — plain-text label after the switch; `children` for rich content.
  For label-left settings rows (SettingsLayout), keep the row layout in the
  app and pass a bare `<Toggle ariaLabel="…">` on the right.
- Form contract: `name` + `value` submit natively when on (the element is
  a real checkbox input with `role="switch"`).
- `disabled`, `id`, `ariaLabel`, `ariaDescribedby`, `onchange(checked)`,
  `class`.

## States

Hover deepens the track (ink-mixed off, shaded accent on); pressing
stretches the knob along its travel (iOS-style); keyboard focus is
delegated to the drawn track (`--focus-ring`, widened under high
contrast); disabled dims via `--opacity-disabled`.

## Checkbox or Toggle?

Toggle for settings that take effect immediately (notifications on/off);
Checkbox for selections that are submitted or aggregated (include this
file, accept terms, tri-state parents).

## Theming

Track corners follow `--radius-toggle` (999px pill by default; square in
terminal/zine, 2px in graphite) and the knob follows `--radius-dot`, so
the switch squares up with the rest of a print/teletype identity. Motion
uses `--transition-fast` + `--transition-ease` — terminal's `steps(1)`
makes the knob jump, pebble's ease-out-expo makes it settle. The knob
stays white in both modes on purpose (it must read against the off-track
and every theme's accent); `--kit-toggle-knob` is the override hook.

## Related

`Checkbox` for submitted selections; `SegmentedControl` when the choice
has more than two values; `ThemeToggle` is the app-chrome theme switcher,
not a general control.
