# kit-ui

Shared Svelte 5 component library for kenn-io frontends, consolidated from the
[middleman](../middleman) and [agentsview](../agentsview) apps. Plain CSS with
design tokens (no Tailwind), runes-mode Svelte, TypeScript strict.

## Install

The package is consumed as source (like `@middleman/ui`): add it as a
workspace/path dependency and make sure your bundler compiles Svelte from
`node_modules` (the `svelte` export condition points at `src/lib/index.ts`).

```jsonc
// package.json
"dependencies": {
  "@kenn-io/kit-ui": "workspace:*" // or a relative file: path
}
```

Peer dependencies: `svelte@^5` and `@lucide/svelte` (icons).

## Quick start

```svelte
<script lang="ts">
  import { Button, Chip, Modal, showFlash } from "@kenn-io/kit-ui";
  import "@kenn-io/kit-ui/theme.css"; // once, at the app entry

  let open = $state(false);
</script>

<Chip tone="success">Open</Chip>
<Button label="Save" tone="info" surface="solid" onclick={() => showFlash("Saved")} />
{#if open}
  <Modal title="Hello" onclose={() => (open = false)}>…</Modal>
{/if}
```

Dark mode: add the `dark` class to `<html>` (`document.documentElement.classList.add("dark")`).

## Components

| Component                                                    | Origin                              | Purpose                                                                                       |
| ------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| [Button](docs/components/button.md)                          | middleman `ActionButton`            | Action button with tone × surface × size variants                                             |
| [Calendar](docs/components/calendar.md)                      | new (DateRangePicker's month grid)  | Single-month date grid with range highlight and month paging                                  |
| [Chip](docs/components/chip.md)                              | middleman `Chip`                    | Status/label badge, optionally interactive                                                    |
| [ChipStack](docs/components/chip-stack.md)                   | new (middleman mobile-view pattern) | Collapsing chip/button row with "+N" expansion                                                |
| [CodeBlock](docs/components/code-block.md)                   | both (consolidated)                 | Standalone code card: shiki dual-theme highlighting, line numbers, wrap toggle, copy          |
| [CollapsibleSidebar](docs/components/collapsible-sidebar.md) | middleman                           | Resizable, collapsible sidebar + main layout (includes `SidebarToggle`)                       |
| [ColorLabel](docs/components/color-label.md)                 | middleman `GitHubLabels`            | Hex-colored pill with WCAG contrast-picked text                                               |
| [CommandPalette](docs/components/command-palette.md)         | new                                 | ⌘K overlay: filtered commands, sections, recents; pairs with the shortcut system              |
| [CopyButton](docs/components/copy-button.md)                 | agentsview                          | Copy-to-clipboard icon button with success feedback                                           |
| [DetailDrawer](docs/components/detail-drawer.md)             | middleman                           | Right-side slide-in detail panel over an overlay                                              |
| [DiffStats](docs/components/diff-stats.md)                   | middleman                           | `+added −removed` diff counters with compact formatting                                       |
| [EmptyState](docs/components/empty-state.md)                 | both (hand-rolled)                  | Centered muted placeholder: icon, title, description, action                                  |
| [FilterDropdown](docs/components/filter-dropdown.md)         | both (consolidated)                 | Sectioned multi-select filter menu with search, counts, bulk actions                          |
| [FindBar](docs/components/find-bar.md)                       | agentsview `SessionFindBar`         | In-content find bar with N-of-M counter and match navigation                                  |
| [FitStages](docs/components/fit-stages.md)                   | new (TopBar collapse pattern)       | Multi-breakpoint wrapper: renders the richest of N stage snippets that fits, by measurement   |
| [FlashBanner](docs/components/flash-banner.md)               | middleman                           | Transient toast banner driven by the `showFlash` store                                        |
| [IconButton](docs/components/icon-button.md)                 | both (hand-rolled `.icon-btn`)      | Square ghost button for a lone icon, required aria-label                                      |
| [KbdBadge](docs/components/kbd-badge.md)                     | middleman                           | Keyboard-shortcut badge, hidden on touch devices                                              |
| [Markdown](docs/components/code-block.md)                    | both (consolidated)                 | Sanitized GFM rendering with highlighted fences and app-extension hooks                       |
| [Modal](docs/components/modal.md)                            | both (consolidated)                 | Dialog primitive: overlay, header, body, footer snippet                                       |
| [DateRangePicker](docs/components/date-range-picker.md)      | agentsview                          | Relative / calendar / custom date-range popover with `resolveRange()`                         |
| [RefreshControl](docs/components/refresh-control.md)         | agentsview                          | Refresh button + "Updated Xm ago" label with auto-refresh                                     |
| [SearchInput](docs/components/text-input.md)                 | new (TextInput preset)              | Filter field: search icon, clear button, optional ⌘K hint                                     |
| [SegmentedControl](docs/components/segmented-control.md)     | middleman (inline pattern)          | "All / PRs / Issues" style value selector                                                     |
| [SelectDropdown](docs/components/select-dropdown.md)         | middleman                           | Accessible single-select combobox                                                             |
| [SettingsLayout](docs/components/settings-layout.md)         | middleman `SettingsPage`            | Categorized settings shell: category sidebar + panel + pinned footer                          |
| [SettingsSection](docs/components/settings-layout.md)        | middleman                           | Bordered settings card: title, optional description, rows                                     |
| [Spinner](docs/components/spinner.md)                        | agentsview                          | Loading spinner                                                                               |
| [SplitResizeHandle](docs/components/split-resize-handle.md)  | middleman                           | Keyboard-accessible pane divider                                                              |
| [StatusBar](docs/components/status-bar.md)                   | both (consolidated)                 | Fixed-height bottom bar with left/center/right regions                                        |
| [StatusDot](docs/components/status-dot.md)                   | agentsview                          | Session/presence indicator (working/waiting/stale/…)                                          |
| [Table](docs/components/table.md)                            | both (consolidated)                 | Table shell + sortable `TableHeaderCell` with aria-sort                                       |
| [TextInput](docs/components/text-input.md)                   | both (hand-rolled)                  | Bordered field primitive: sizes, invalid state, prefix/suffix snippets                        |
| [ThemeToggle](docs/components/theme-toggle.md)               | new (theme store control)           | Light/dark/system control: cycle icon-button or segmented variants                            |
| [Tooltip](docs/components/tooltip.md)                        | middleman `DiffSummaryChip` popover | Hover/focus tooltip with arrow, delays, viewport-aware flipping                               |
| [TopBar](docs/components/top-bar.md)                         | both `AppHeader` (consolidated)     | App header: reserved left/right regions, search slot, tabs that auto-collapse into a dropdown |
| [Typeahead](docs/components/typeahead.md)                    | agentsview `OptionTypeahead`        | Filterable select with match highlighting                                                     |
| [VirtualList](docs/components/virtual-list.md)               | new                                 | Windowed list for long datasets: fixed/measured row heights, container-owned keyboard nav     |

Also exported: the [keyboard shortcut system](docs/components/command-palette.md#shortcut-system-utilsshortcuts)
(`appShortcuts`/`initShortcuts`/`formatShortcutKeys` — combo parsing,
platform `mod`, scope stacking), the
[markdown pipeline](docs/components/code-block.md#pipeline-utilsmarkdown)
(`renderMarkdown`/`createMarkdownRenderer`/`highlightCode` — marked →
shiki → DOMPurify; peers `marked@^18`/`shiki@^4`/`dompurify@^3`),
[utilities](docs/utilities.md) (`copyToClipboard`,
`formatRelativeTime`, `formatTimestamp`, `truncate`, `createRefreshScheduler`,
`floatingPopoverStyle`, `formatDuration`/`formatTokenCount`/`formatCost`,
`debounce`, `hashColor`), the [theme store](docs/theming.md#theme-store)
(`initTheme`/`setThemeMode`/`setHighContrast`), shared breakpoints
(`BREAKPOINTS`/`MEDIA` — see the
[theming guide](docs/theming.md#breakpoints)), and the design tokens
([theming guide](docs/theming.md)).

## Enforcing usage in consuming projects

`kit-ui-check` scans a project for hand-rolled equivalents of these components
(custom modals, spinners, dropdowns, raw palette colors, ad-hoc breakpoints)
and fails CI until they're replaced or explicitly ignored:

```bash
bunx kit-ui-check              # scans ./src, exits 1 on findings
bunx kit-ui-check --warn       # adoption mode
```

See [docs/checking.md](docs/checking.md) for rules, suppression, and the
programmatic API, and [docs/migration.md](docs/migration.md) for the
step-by-step middleman/agentsview migration guide (component mappings, prop
deltas, gotchas).

## Demo gallery

```bash
bun install
bun run dev     # interactive gallery at http://localhost:5173
```

Every component has a live page with usage snippets and a light/dark toggle.

## Development

```bash
bun run check          # svelte-check (must stay at 0 errors/warnings)
bun run build          # builds the demo gallery
bun test               # unit tests (checker rules, windowing, shortcuts, markdown planner)
bun run test:browser   # Playwright suite against the gallery (docs/testing.md)
bun run svelte-mcp list-sections   # Svelte 5 docs lookup (see skills/)
```

Conventions live in [CLAUDE.md](CLAUDE.md); Svelte 5 guidance lives in
[skills/svelte-core-bestpractices](skills/svelte-core-bestpractices/SKILL.md)
and [skills/svelte-code-writer](skills/svelte-code-writer/SKILL.md).
