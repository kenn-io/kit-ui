# KbdBadge

Keyboard-shortcut badge. Hidden automatically on touch devices
(`@media (pointer: coarse)`). Simplified from Forge's keyspec-bound
version — it takes plain glyph strings.

`KbdBadge` defaults to `joiner="keys"` for separate keycaps; `joiner="compact"` joins the glyphs in one cap.

```svelte
<KbdBadge keys={["⌘", "K"]} />
<KbdBadge keys={["Ctrl", "⇧", "P"]} />
<KbdBadge keys={["⌘", "K"]} joiner="compact" />
<KbdBadge keys={["Ctrl", "Shift", "P"]} joiner="plus" />
<KbdBadge keys={["g", "i"]} joiner="plus" ariaLabel="g then i" />
```

## Props

| Prop        | Type                            | Default                               | Notes                                                                                                                                     |
| ----------- | ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `keys`      | `string[]`                      | required                              | Key glyphs in press order                                                                                                                 |
| `joiner`    | `"keys" \| "compact" \| "plus"` | `"keys"`                              | keys gives each key its own cap with a 4px gap; compact runs glyphs together ("⌘K", sans font); plus joins with "+" ("Ctrl+K", mono font) |
| `ariaLabel` | `string`                        | readable key names joined with spaces | Screen-reader label, for example "Command K" for `["⌘", "K"]`                                                                             |
