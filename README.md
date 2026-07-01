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

| Component | Origin | Purpose |
| --- | --- | --- |
| [Button](docs/components/button.md) | middleman `ActionButton` | Action button with tone × surface × size variants |
| [Chip](docs/components/chip.md) | middleman `Chip` | Status/label badge, optionally interactive |
| [ChipStack](docs/components/chip-stack.md) | new (middleman mobile-view pattern) | Collapsing chip/button row with "+N" expansion |
| [CollapsibleSidebar](docs/components/collapsible-sidebar.md) | middleman | Resizable, collapsible sidebar + main layout (includes `SidebarToggle`) |
| [CopyButton](docs/components/copy-button.md) | agentsview | Copy-to-clipboard icon button with success feedback |
| [FilterDropdown](docs/components/filter-dropdown.md) | both (consolidated) | Sectioned multi-select filter menu with search, counts, bulk actions |
| [FlashBanner](docs/components/flash-banner.md) | middleman | Transient toast banner driven by the `showFlash` store |
| [KbdBadge](docs/components/kbd-badge.md) | middleman | Keyboard-shortcut badge, hidden on touch devices |
| [Modal](docs/components/modal.md) | both (consolidated) | Dialog primitive: overlay, header, body, footer snippet |
| [RefreshControl](docs/components/refresh-control.md) | agentsview | Refresh button + "Updated Xm ago" label with auto-refresh |
| [SegmentedControl](docs/components/segmented-control.md) | middleman (inline pattern) | "All / PRs / Issues" style value selector |
| [SelectDropdown](docs/components/select-dropdown.md) | middleman | Accessible single-select combobox |
| [Spinner](docs/components/spinner.md) | agentsview | Loading spinner |
| [SplitResizeHandle](docs/components/split-resize-handle.md) | middleman | Keyboard-accessible pane divider |
| [StatusDot](docs/components/status-dot.md) | agentsview | Session/presence indicator (working/waiting/stale/…) |
| [Table](docs/components/table.md) | both (consolidated) | Table shell + sortable `TableHeaderCell` with aria-sort |
| [Typeahead](docs/components/typeahead.md) | agentsview `OptionTypeahead` | Filterable select with match highlighting |

Also exported: [utilities](docs/utilities.md) (`copyToClipboard`,
`formatRelativeTime`, `formatTimestamp`, `truncate`, `createRefreshScheduler`,
`floatingPopoverStyle`), shared breakpoints (`BREAKPOINTS`/`MEDIA` — see the
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
programmatic API.

## Demo gallery

```bash
bun install
bun run dev     # interactive gallery at http://localhost:5173
```

Every component has a live page with usage snippets and a light/dark toggle.

## Development

```bash
bun run check   # svelte-check (must stay at 0 errors/warnings)
bun run build   # builds the demo gallery
bun run svelte-mcp list-sections   # Svelte 5 docs lookup (see skills/)
```

Conventions live in [CLAUDE.md](CLAUDE.md); Svelte 5 guidance lives in
[skills/svelte-core-bestpractices](skills/svelte-core-bestpractices/SKILL.md)
and [skills/svelte-code-writer](skills/svelte-code-writer/SKILL.md).
