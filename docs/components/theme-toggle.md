# ThemeToggle

Ready-made control over the [theme store](../theming.md#theme-store): call
`initTheme()` once at startup and drop a ThemeToggle anywhere. Two variants:

- **`cycle`** (default) — one `IconButton` cycling light → dark → system,
  icon showing the current mode (sun/moon/monitor). For header chrome.
- **`segmented`** — a three-way `SegmentedControl`. For settings pages.

Every instance reads the store reactively, so multiple toggles (header +
settings) stay in sync, and the mode persists via the store's localStorage
key.

```svelte
<script lang="ts">
  import { initTheme, ThemeToggle } from "@kenn-io/kit-ui";
  initTheme(); // once, at app startup
</script>

<ThemeToggle />                       <!-- header icon button -->
<ThemeToggle variant="segmented" />   <!-- settings selector -->
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"cycle" \| "segmented"` | `"cycle"` | |
| `size` | `"sm" \| "md"` | `"md"` | Cycle variant's IconButton size |
| `lightLabel` / `darkLabel` / `systemLabel` | `string` | `"Light"` / `"Dark"` / `"System"` | Segment labels + the `{mode}` value in `cycleLabel` |
| `cycleLabel` | `string` | `"Theme: {mode}"` | aria-label template for the cycle button |
| `block` | `boolean` | `false` | Segmented variant stretches to the container |
| `class` | `string` | `""` | |

## Notes

- The component only *sets the mode* — high-contrast is a separate,
  orthogonal flag (`setHighContrast`); expose it as its own switch in
  settings UIs.
- Without `initTheme()` the store still works for the session but nothing
  persists or restores.
