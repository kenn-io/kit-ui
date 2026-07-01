# CommandPalette + keyboard shortcuts

Two pieces that compose: a **shortcut system** (combo parsing, platform
`mod` resolution, scope stacking) and a **CommandPalette** overlay driven
by app-provided commands. Either is usable without the other.

## Shortcut system (`utils/shortcuts`)

```ts
import { appShortcuts, initShortcuts } from "@kenn-io/kit-ui";

initShortcuts(); // once, at app startup (like initTheme) — SSR-safe

const off = appShortcuts.register("mod+k", openPalette, {
  description: "Open command palette",
});
```

- **Combo syntax**: `"mod+k"`, `"shift+/"`, `"g"`, `"escape"`,
  `"mod+shift+p"`. `mod` = ⌘ on Apple platforms, Ctrl elsewhere; `ctrl` is
  always Ctrl. Aliases: `esc`, `space`, `up/down/left/right`, `plus`,
  `option`, `cmd`. Matching is **strict** — modifiers the combo doesn't
  name must not be pressed.
- **Inputs**: plain-key shortcuts don't fire while an
  input/textarea/select/contenteditable has focus; modifier combos do.
  Opt a plain key back in with `allowInInput: true` (e.g. `escape`).
- **Scopes**: `appShortcuts.pushScope("my-modal")` suspends everything
  except shortcuts registered with `{ scope: "my-modal" }`; the returned
  function pops it (out-of-order pops are safe). Modal-like components
  should push a scope while open — CommandPalette does.
- **Display**: `formatShortcutKeys("mod+k")` → `["⌘", "K"]` / `["Ctrl",
  "K"]` for [KbdBadge](kbd-badge.md).
- `createShortcutManager()` builds an isolated manager (embedded surfaces,
  tests); `appShortcuts` is the app-level singleton `initShortcuts()`
  wires to `window`.
- Parsing/matching/scoping are pure and unit-tested
  (`checks/shortcuts.test.ts`).

## CommandPalette

```svelte
<script lang="ts">
  import { appShortcuts, CommandPalette, type PaletteCommand } from "@kenn-io/kit-ui";

  let open = $state(false);
  appShortcuts.register("mod+k", () => (open = true));

  const commands: PaletteCommand[] = [
    { id: "new", label: "New session", section: "Sessions", combo: "mod+n" },
    { id: "theme", label: "Toggle theme", section: "View", keywords: "dark light" },
  ];
</script>

<CommandPalette bind:open {commands} recentIds={recent} onrun={(c) => run(c)} />
```

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` | `boolean` (bindable) | `false` | |
| `commands` | `PaletteCommand[]` | required | `{ id, label, section?, keywords?, combo?, disabled? }` |
| `onrun` | `(command: PaletteCommand) => void` | required | Palette closes, then runs |
| `recentIds` | `string[]` | `[]` | Shown under `recentLabel` while the query is empty (app owns recency) |
| `placeholder` | `string` | `"Type a command…"` | |
| `emptyLabel` | `string` | `"No matching commands"` | |
| `recentLabel` | `string` | `"Recent"` | |
| `ariaLabel` | `string` | `"Command palette"` | Dialog + listbox label |
| `class` | `string` | `""` | |

### Behavior

- Filtering ranks label **prefix** over label **substring** over
  **keyword** matches; sections keep first-seen order.
- ↑/↓ move (skipping disabled), Enter runs, pointer hover highlights,
  click runs. Escape follows SearchInput semantics: clears the query
  first, closes when already empty.
- While open it pushes an `appShortcuts` scope, so page-level shortcuts
  are suspended (registry-driven ones — its own keys are DOM handlers).
- Overlay + `trapFocus` + `aria-modal`; the query field autofocuses.
- `combo` values render as platform-correct KbdBadges via
  `formatShortcutKeys` — the palette does **not** register them; the app
  owns actual shortcut registration.
