<script lang="ts">
  import {
    appShortcuts,
    CommandPalette,
    formatShortcutKeys,
    initShortcuts,
    KbdBadge,
    showFlash,
    type PaletteCommand,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let open = $state(false);
  let recent = $state<string[]>([]);
  let pageShortcutFires = $state(0);

  const commands: PaletteCommand[] = [
    { id: "new-session", label: "New session", section: "Sessions", combo: "mod+n" },
    { id: "find-session", label: "Find session…", section: "Sessions", keywords: "search filter" },
    { id: "archive", label: "Archive session", section: "Sessions", disabled: true },
    { id: "toggle-theme", label: "Toggle theme", section: "View", combo: "mod+shift+l" },
    { id: "toggle-sidebar", label: "Toggle sidebar", section: "View", keywords: "collapse panel" },
    { id: "goto-usage", label: "Go to Usage", section: "Navigate", keywords: "metrics tokens" },
    { id: "goto-trends", label: "Go to Trends", section: "Navigate" },
    { id: "copy-link", label: "Copy link to page", section: "Share", combo: "mod+shift+c" },
  ];

  function run(command: PaletteCommand): void {
    recent = [command.id, ...recent.filter((id) => id !== command.id)].slice(0, 3);
    showFlash(`Ran: ${command.label}`);
  }

  // App wiring: one initShortcuts() at startup, then register combos.
  $effect(() => {
    const detach = initShortcuts();
    const offOpen = appShortcuts.register("mod+k", () => (open = true), {
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
  description="Press ⌘K (or the button) to open. Type to filter (label prefix > label substring > keywords), ↑/↓ + Enter to run, Escape clears then closes. Ran commands populate a Recent section. While the palette is open it pushes a shortcut scope — the page-level 'g' shortcut below stops counting."
  code={`import { appShortcuts, CommandPalette, initShortcuts } from "@kenn-io/kit-ui";

let open = $state(false);
initShortcuts(); // once, at app startup
appShortcuts.register("mod+k", () => (open = true));

<CommandPalette bind:open {commands} recentIds={recent} onrun={run} />`}
>
  <div class="row">
    <button class="open-btn" type="button" onclick={() => (open = true)}>
      Open palette <KbdBadge keys={formatShortcutKeys("mod+k")} />
    </button>
    <span class="readout">
      page shortcut <code>g</code> fired: <code>{pageShortcutFires}</code>
      (suspended while the palette is open)
    </span>
  </div>
  <CommandPalette bind:open {commands} recentIds={recent} onrun={run} />
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

  .open-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
