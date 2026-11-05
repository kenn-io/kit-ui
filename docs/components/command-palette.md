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
  name must not be pressed. Shifted symbols are normalized narrowly (US
  layout pairs): `"shift+/"` matches the `?` the browser actually
  reports, and combos naming a shifted-output character (`"mod+plus"`)
  tolerate the `shiftKey` a layout needs to produce it. Base symbols stay
  strict — plain `"/"` never matches while Shift is held, so it can't
  shadow `"shift+/"`. Non-US layouts beyond these pairs match on the
  produced character only.
- **Validation**: malformed combos (`"mod+"`, unknown modifiers) throw at
  parse/registration time, so typos fail fast instead of silently never
  firing. Write the literal `+` key as `"plus"`.
- **Conflicts**: within a scope, the **first registration wins** —
  `handleKeydown` fires the first match and stops. Registering a combo
  that resolves to the same physical keys as one already in the scope
  logs a `console.warn` — compared after alias, platform, and
  shifted-symbol resolution, so `cmd+k` vs `meta+k`, `option+up` vs
  `alt+arrowup`, `mod+k` vs `ctrl+k`-on-PC, and `shift+/` vs `?` are all
  caught.
- **Inputs**: plain-key shortcuts don't fire while an
  input/textarea/select/contenteditable has focus; modifier combos do.
  Opt a plain key back in with `allowInInput: true` (e.g. `escape`).
- **Scopes**: `appShortcuts.pushScope("my-modal")` suspends everything
  except shortcuts registered with `{ scope: "my-modal" }`; the returned
  function pops it (out-of-order pops are safe). Modal-like components
  should push a scope while open — CommandPalette does.
- **Display**: `formatShortcutKeys("mod+k")` → `["⌘", "K"]` / `["Ctrl",
  "K"]` for [KbdBadge](kbd-badge.md), with each key in its own cap.
- `createShortcutManager()` builds an isolated manager (embedded surfaces,
  tests); `appShortcuts` is the app-level singleton `initShortcuts()`
  wires to `window`. `initShortcuts()` is idempotent — repeat calls while
  wired return a no-op detach instead of stacking listeners.
- Importable from the root export or the `@kenn-io/kit-ui/utils/shortcuts`
  subpath (same granular pattern as the other utils).
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

| Prop            | Type                                               | Default                  | Notes                                                                                    |
| --------------- | -------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `open`          | `boolean` (bindable)                               | `false`                  |                                                                                          |
| `commands`      | `PaletteCommand[]`                                 | required                 | `{ id, label, section?, keywords?, combo?, disabled?, icon?, children?: PaletteLeaf[] }` |
| `onrun`         | `(command: PaletteCommand, query: string) => void` | required                 | Palette closes, then runs the leaf command                                               |
| `initialQuery`  | `string`                                           | `""`                     | Seeds the search on every open; typing stays local                                       |
| `fallbacks`     | `(query: string) => PaletteLeaf[]`                 |                          | Receives the trimmed, non-empty query                                                    |
| `recentIds`     | `string[]`                                         | `[]`                     | Shown under `recentLabel` while the query is empty (app owns recency)                    |
| `placeholder`   | `string`                                           | `"Type a command…"`      |                                                                                          |
| `emptyLabel`    | `string`                                           | `"No matching commands"` |                                                                                          |
| `recentLabel`   | `string`                                           | `"Recent"`               |                                                                                          |
| `navigateLabel` | `string`                                           | `"navigate"`             | Footer navigation label                                                                  |
| `runLabel`      | `string`                                           | `"run"`                  | Footer run label                                                                         |
| `closeLabel`    | `string`                                           | `"close"`                | Footer close label                                                                       |
| `ariaLabel`     | `string`                                           | `"Command palette"`      | Dialog + listbox label                                                                   |
| `class`         | `string`                                           | `""`                     |                                                                                          |

### Behavior

- Commands accept an `icon` component, such as a Lucide icon, rendered at 16px.
  Every row reserves the 16px icon column.
- The borderless search row is 48px tall, command rows are at least 36px tall,
  and only the results list scrolls. Shortcut badges stay right-aligned.
  The search field shows no focus ring inside the palette.
  A 32px footer shows ↑↓ navigate, ↵ run, and esc close.
  Assistive technology ignores the footer. Coarse pointers hide it alongside key badges.
- Filtering ranks label **prefix** over label **substring** over
  **keyword** matches. Each section then appears **once**, ordered by its
  best-ranked match, with ranking preserved within the section — a
  section never repeats across rank buckets.
- Running a parent opens its children and keeps the palette open without calling `onrun`.
  Its label stays visible in a truncated chip and becomes the listbox name. The search placeholder is empty while the group is open.
  Clicking or tapping the chip returns to the root; it stays out of the tab order.
  Entering or leaving a child list scrolls the list to the top.
  Root search and `recentIds` also reach children, with the group label before the child label, such as "Group by… › Source". Use bare dimensions as child labels: "account", "Source", and "Date". Inside the group, rows show only the child label. Searching "source" at the root finds both "Sources" and "Group by… › Source" in the demo. A child without its own section
  takes its parent's section in root results and in the child list. A disabled parent
  also disables its children, including in root search and Recent. Command ids
  must be globally unique. Reopening starts at the root.
- Matched label characters are bold. Keyword-only matches stay plain.
- Fallback rows appear only at the root and follow all matches, grouped by their own sections. A fallback
  section that repeats a command section shows its header again after the matches.
  Fallbacks share keyboard navigation and disabled handling, stay plain, and skip
  ids already listed among the matches or earlier fallback rows. The first row for
  each id wins. Apps must keep fallback rows out of Recent.
- `initialQuery` seeds the search on every open. `onrun` receives the trimmed
  search text as its second argument.
- ↑/↓ move (skipping disabled), Enter runs, pointer movement highlights,
  click runs. On every open and when results change, the highlight lands on the **first
  enabled** command (disabled leading results are skipped so Enter always
  has a runnable target). Escape follows SearchInput semantics: clears
  the query first, returns to the root from a child list, then closes.
  Backspace in an empty search returns from a child list to the root and keeps focus in the search field.
- While open it pushes an `appShortcuts` scope, so page-level shortcuts
  are suspended (registry-driven ones — its own keys are DOM handlers).
- Overlay + `trapFocus` + `aria-modal`; the query field autofocuses.
- `combo` values render as platform-correct KbdBadges via
  `formatShortcutKeys`, with each key in its own cap. The app registers
  the shortcuts.
- The palette closes **before** `onrun` fires; exceptions thrown by
  `onrun` propagate to the caller (the palette stays closed).
- Recents are app-owned (`recentIds` in, updated by your `onrun`) — the
  palette persists nothing itself, so what's stored and where is a
  consumer privacy decision.

### Accessibility pattern

The query field is wired as a **combobox**: `role="combobox"` with
`aria-controls` pointing at the results listbox and
`aria-activedescendant` following the highlighted `role="option"` row, so
arrow navigation is announced while focus stays in the input. Disabled
commands use `aria-disabled` (perceivable, not focusable-skipped) and
activation is guarded in code. Acceptance (automated coverage tracked
under the browser test infra work): open announces the dialog and field;
typing filters and re-announces the active option; ↑/↓ announce; Enter
runs only enabled commands; Escape clears then closes; all-disabled and
empty result sets leave Enter inert.
