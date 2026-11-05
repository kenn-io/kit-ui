<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import SunMoon from "@lucide/svelte/icons/sun-moon";
  import Layers from "@lucide/svelte/icons/layers";
  import {
    appShortcuts,
    Checkbox,
    CommandPalette,
    formatShortcutKeys,
    initShortcuts,
    KbdBadge,
    showFlash,
    type PaletteCommand,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let open = $state(false);
  let initialQuery = $state("");
  let fallbackCommands = $state(false);
  let recent = $state<string[]>([]);
  let pageShortcutFires = $state(0);

  const commands: PaletteCommand[] = [
    { id: "new-session", label: "New session", section: "Sessions", combo: "mod+n", icon: Plus },
    {
      id: "find-session",
      label: "Find session…",
      section: "Sessions",
      keywords: "search filter",
      icon: Search,
    },
    { id: "archive", label: "Archive session", section: "Sessions", disabled: true },
    {
      id: "toggle-theme",
      label: "Toggle theme",
      section: "View",
      combo: "mod+shift+l",
      icon: SunMoon,
    },
    { id: "toggle-sidebar", label: "Toggle sidebar", section: "View", keywords: "collapse panel" },
    { id: "goto-usage", label: "Go to Usage", section: "Navigate", keywords: "metrics tokens" },
    { id: "goto-trends", label: "Go to Trends", section: "Navigate" },
    { id: "sources", label: "Sources", section: "Navigate" },
    {
      id: "group-by",
      label: "Group by…",
      section: "View",
      icon: Layers,
      children: [
        { id: "group-account", label: "account", disabled: true },
        { id: "group-source", label: "Source" },
        { id: "group-date", label: "Date", keywords: "timestamp" },
      ],
    },
    { id: "copy-link", label: "Copy link to page", section: "Share", combo: "mod+shift+c" },
  ];

  function run(command: PaletteCommand, typed: string): void {
    if (
      commands.some(
        (c) => c.id === command.id || c.children?.some((child) => child.id === command.id),
      )
    ) {
      recent = [command.id, ...recent.filter((id) => id !== command.id)].slice(0, 3);
      showFlash(`Ran: ${command.label}`);
    } else {
      showFlash(`Searched for "${typed}"`);
    }
  }

  function openPalette(seed = ""): void {
    initialQuery = seed;
    open = true;
  }

  // App wiring: one initShortcuts() at startup, then register combos.
  $effect(() => {
    const detach = initShortcuts();
    const offOpen = appShortcuts.register("mod+k", () => openPalette(), {
      description: "Open command palette",
    });
    // A page-level shortcut to demonstrate scope suspension: it counts
    // while the palette is closed, and stops while it's open.
    const offPage = appShortcuts.register("g", () => (pageShortcutFires += 1), {
      description: "Page shortcut (demo)",
    });
    return () => {
      offOpen();
      offPage();
      detach();
    };
  });
</script>

<DemoSection
  title="Command palette"
  description="Press ⌘K (or the button) to open. Type to filter (label prefix > label substring > keywords), ↑/↓ + Enter to run. Escape clears, returns to the full list, then closes. Ran commands populate a Recent section. While the palette is open it pushes a shortcut scope — the page-level 'g' shortcut below stops counting."
  code={`import { appShortcuts, CommandPalette, initShortcuts, showFlash, type PaletteCommand } from "@kenn-io/kit-ui";

let open = $state(false);
let initialQuery = $state("");

function openPalette(seed = ""): void {
  initialQuery = seed;
  open = true;
}

function run(command: PaletteCommand, typed: string): void {
  if (
    commands.some(
      (c) => c.id === command.id || c.children?.some((child) => child.id === command.id),
    )
  ) {
    recent = [command.id, ...recent.filter((id) => id !== command.id)].slice(0, 3);
    showFlash(\`Ran: \${command.label}\`);
  } else {
    showFlash(\`Searched for "\${typed}"\`);
  }
}

initShortcuts(); // once, at app startup
appShortcuts.register("mod+k", () => openPalette());

<button onclick={() => openPalette("theme")}>Search theme</button>
<CommandPalette
  bind:open
  {commands}
  {initialQuery}
  fallbacks={(q) => [{ id: "search", label: \`Search for "\${q}"\`, section: "Search", combo: "enter" }]}
  recentIds={recent}
  onrun={run}
/>`}
>
  <div class="row">
    <button class="open-btn kit-control-states" type="button" onclick={() => openPalette()}>
      Open palette <KbdBadge keys={formatShortcutKeys("mod+k")} />
    </button>
    <button class="open-btn kit-control-states" type="button" onclick={() => openPalette("theme")}>
      Search theme
    </button>
    <Checkbox bind:checked={fallbackCommands} label="Search action" />
    <span class="readout">
      page shortcut <code>g</code> fired: <code>{pageShortcutFires}</code>
      (suspended while the palette is open)
    </span>
  </div>
  <CommandPalette
    bind:open
    {commands}
    {initialQuery}
    fallbacks={fallbackCommands
      ? (q) => [
          {
            id: "search",
            label: `Search for "${q}"`,
            icon: Search,
            section: "Search",
            combo: "enter",
          },
        ]
      : undefined}
    recentIds={recent}
    onrun={run}
  />
</DemoSection>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .open-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    height: 28px;
    padding: 0 var(--space-4);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .open-btn:hover {
    background: var(--bg-surface-hover);
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
