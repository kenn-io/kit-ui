# KbdBadge

Keyboard-shortcut badge. Hidden automatically on touch devices
(`@media (pointer: coarse)`). Simplified from middleman's keyspec-bound
version — it takes plain glyph strings.

```svelte
<KbdBadge keys={["⌘", "K"]} />
<KbdBadge keys={["Ctrl", "Shift", "P"]} joiner="plus" />
<KbdBadge keys={["g", "i"]} joiner="plus" ariaLabel="g then i" />
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `keys` | `string[]` | required | Key glyphs in press order |
| `joiner` | `"compact" \| "plus"` | `"compact"` | compact runs glyphs together ("⌘K", sans font); plus joins with "+" ("Ctrl+K", mono font) |
| `ariaLabel` | `string` | keys joined with spaces | Screen-reader label |
